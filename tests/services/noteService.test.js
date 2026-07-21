import { jest } from "@jest/globals";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NoteService } from "../../src/services/noteService.js";
import { NotFoundError } from "../../src/utils/errors.js";
import { ValidationError } from "../../src/utils/validation.js";

const s3Mock = mockClient(S3Client);

const buildRepositoryMock = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  removeImageUrl: jest.fn(),
});

describe("NoteService", () => {
  let repositoryMock;
  let service;

  beforeEach(() => {
    s3Mock.reset();
    repositoryMock = buildRepositoryMock();
    service = new NoteService(repositoryMock);

    // Bucket là private, nên trong code thật imageUrl luôn được ký lại
    // (presigned) trước khi trả về client. Trong unit test ta không muốn
    // gọi getSignedUrl() thật (cần network/credentials AWS thật), nên spy
    // thẳng vào helper nội bộ và trả về URL y nguyên - các test dưới đây
    // vẫn kiểm tra đúng toàn bộ business logic (S3 upload/delete/retry,
    // validation...), chỉ bỏ qua bước ký URL.
    jest.spyOn(service, "_toPresignedUrl").mockImplementation(async (url) => url);
  });

  describe("createNote", () => {
    test("throws ValidationError when title is missing", async () => {
      await expect(
        service.createNote({ content: "no title" })
      ).rejects.toThrow(ValidationError);
      expect(repositoryMock.create).not.toHaveBeenCalled();
    });

    test("throws ValidationError when content exceeds 5000 chars", async () => {
      await expect(
        service.createNote({ title: "ok", content: "a".repeat(5001) })
      ).rejects.toThrow(ValidationError);
    });

    test("delegates to repository when input is valid", async () => {
      repositoryMock.create.mockResolvedValue({ id: "1", title: "ok", content: "ok" });
      const result = await service.createNote({ title: "ok", content: "ok" });
      expect(repositoryMock.create).toHaveBeenCalledWith({ title: "ok", content: "ok" });
      expect(result.id).toBe("1");
    });
  });

  describe("getAllNotes", () => {
    test("returns notes unchanged when none have an image", async () => {
      repositoryMock.findAll.mockResolvedValue([{ id: "1" }, { id: "2" }]);
      const result = await service.getAllNotes();
      expect(result).toEqual([{ id: "1" }, { id: "2" }]);
      expect(service._toPresignedUrl).not.toHaveBeenCalled();
    });

    test("presigns imageUrl for every note that has one", async () => {
      repositoryMock.findAll.mockResolvedValue([
        { id: "1", imageUrl: "https://smart-notes-storage.s3.amazonaws.com/images/a.png" },
        { id: "2" },
      ]);

      const result = await service.getAllNotes();

      expect(service._toPresignedUrl).toHaveBeenCalledTimes(1);
      expect(service._toPresignedUrl).toHaveBeenCalledWith(
        "https://smart-notes-storage.s3.amazonaws.com/images/a.png"
      );
      expect(result[0].imageUrl).toBe(
        "https://smart-notes-storage.s3.amazonaws.com/images/a.png"
      );
      expect(result[1].imageUrl).toBeUndefined();
    });
  });

  describe("getNoteById", () => {
    test("throws NotFoundError when note does not exist", async () => {
      repositoryMock.findById.mockResolvedValue(null);
      await expect(service.getNoteById("missing")).rejects.toThrow(NotFoundError);
    });

    test("returns the note when found (no image)", async () => {
      repositoryMock.findById.mockResolvedValue({ id: "1" });
      const result = await service.getNoteById("1");
      expect(result).toEqual({ id: "1" });
      expect(service._toPresignedUrl).not.toHaveBeenCalled();
    });

    test("presigns imageUrl when the note has an image", async () => {
      repositoryMock.findById.mockResolvedValue({
        id: "1",
        imageUrl: "https://smart-notes-storage.s3.amazonaws.com/images/pic.png",
      });
      const result = await service.getNoteById("1");
      expect(service._toPresignedUrl).toHaveBeenCalledWith(
        "https://smart-notes-storage.s3.amazonaws.com/images/pic.png"
      );
      expect(result.imageUrl).toBe(
        "https://smart-notes-storage.s3.amazonaws.com/images/pic.png"
      );
    });
  });

  describe("deleteNote", () => {
    test("throws NotFoundError when note does not exist", async () => {
      repositoryMock.findById.mockResolvedValue(null);
      await expect(service.deleteNote("missing")).rejects.toThrow(NotFoundError);
      expect(repositoryMock.delete).not.toHaveBeenCalled();
    });

    test("deletes associated S3 image before deleting the note", async () => {
      repositoryMock.findById.mockResolvedValue({
        id: "1",
        imageUrl: "https://smart-notes-storage.s3.amazonaws.com/images/abc_pic.png",
      });
      repositoryMock.delete.mockResolvedValue();
      s3Mock.on(DeleteObjectCommand).resolves({});

      await service.deleteNote("1");

      expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(1);
      expect(repositoryMock.delete).toHaveBeenCalledWith("1");
    });
  });

  describe("uploadImage", () => {
    const fakeFile = {
      buffer: Buffer.from("fake-image-bytes"),
      originalname: "photo.png",
      mimetype: "image/png",
    };

    test("throws ValidationError when no file is provided", async () => {
      repositoryMock.findById.mockResolvedValue({ id: "1" });
      await expect(service.uploadImage("1", null)).rejects.toThrow(ValidationError);
    });

    test("throws NotFoundError when note does not exist", async () => {
      repositoryMock.findById.mockResolvedValue(null);
      await expect(service.uploadImage("missing", fakeFile)).rejects.toThrow(
        NotFoundError
      );
    });

    test("uploads to S3 and updates the note with imageUrl", async () => {
      repositoryMock.findById.mockResolvedValue({ id: "1" });
      repositoryMock.update.mockResolvedValue({ id: "1", imageUrl: "https://..." });
      s3Mock.on(PutObjectCommand).resolves({});

      const result = await service.uploadImage("1", fakeFile);

      expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(1);
      expect(repositoryMock.update).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({ imageUrl: expect.stringContaining("https://") })
      );
      // Kết quả trả về đã đi qua bước "presign" (ở đây được spy trả nguyên
      // giá trị đầu vào), nên vẫn phải có imageUrl dạng https://
      expect(result.imageUrl).toBeDefined();
      expect(result.imageUrl).toEqual(expect.stringContaining("https://"));
      expect(service._toPresignedUrl).toHaveBeenCalledWith("https://...");
    });

    test("retries S3 upload on transient failure and eventually succeeds", async () => {
      repositoryMock.findById.mockResolvedValue({ id: "1" });
      repositoryMock.update.mockResolvedValue({ id: "1", imageUrl: "https://..." });

      s3Mock
        .on(PutObjectCommand)
        .rejectsOnce(new Error("Transient network error"))
        .resolves({});

      const result = await service.uploadImage("1", fakeFile);

      expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(2);
      expect(result.imageUrl).toBeDefined();
    });
  });
});