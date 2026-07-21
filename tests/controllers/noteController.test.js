import { jest } from "@jest/globals";
import request from "supertest";

// NoteService methods we want to control per test
const mockCreateNote = jest.fn();
const mockGetAllNotes = jest.fn();
const mockGetNoteById = jest.fn();
const mockUpdateNote = jest.fn();
const mockDeleteNote = jest.fn();
const mockUploadImage = jest.fn();
const mockDeleteImage = jest.fn();

// Mock the service module BEFORE importing the app (ESM dynamic mocking)
jest.unstable_mockModule("../../src/services/noteService.js", () => {
  return {
    NoteService: jest.fn().mockImplementation(() => ({
      createNote: mockCreateNote,
      getAllNotes: mockGetAllNotes,
      getNoteById: mockGetNoteById,
      updateNote: mockUpdateNote,
      deleteNote: mockDeleteNote,
      uploadImage: mockUploadImage,
      deleteImage: mockDeleteImage,
    })),
  };
});

const { default: app } = await import("../../src/app.js");
const { NotFoundError } = await import("../../src/utils/errors.js");
const { ValidationError } = await import("../../src/utils/validation.js");

describe("Note Controller (HTTP layer)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /notes -> 201 with created note", async () => {
    mockCreateNote.mockResolvedValue({
      id: "1",
      title: "AWS Learning",
      content: "Learning Lambda",
    });

    const res = await request(app)
      .post("/notes")
      .send({ title: "AWS Learning", content: "Learning Lambda" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("1");
  });

  test("POST /notes -> 400 when validation fails", async () => {
    mockCreateNote.mockRejectedValue(new ValidationError("title là bắt buộc"));

    const res = await request(app).post("/notes").send({ content: "no title" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("GET /notes -> 200 with list", async () => {
    mockGetAllNotes.mockResolvedValue([{ id: "1" }, { id: "2" }]);

    const res = await request(app).get("/notes");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  test("GET /notes/:id -> 404 when not found", async () => {
    mockGetNoteById.mockRejectedValue(new NotFoundError("Note not found"));

    const res = await request(app).get("/notes/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Note not found" });
  });

  test("PUT /notes/:id -> 200 with updated note", async () => {
    mockUpdateNote.mockResolvedValue({ id: "1", title: "Updated" });

    const res = await request(app)
      .put("/notes/1")
      .send({ title: "Updated", content: "Updated content" });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Updated");
  });

  test("DELETE /notes/:id -> 200 on success", async () => {
    mockDeleteNote.mockResolvedValue();

    const res = await request(app).delete("/notes/1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("DELETE /notes/:id/image -> 200 with updated note", async () => {
    mockDeleteImage.mockResolvedValue({ id: "1" });

    const res = await request(app).delete("/notes/1/image");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("GET /unknown-route -> 404 route not found", async () => {
    const res = await request(app).get("/unknown-route");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Route not found");
  });
});
