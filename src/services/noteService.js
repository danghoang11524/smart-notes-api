import { randomUUID } from "crypto";
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NoteRepository } from "../repositories/noteRepository.js";
import { validateNoteInput } from "../utils/validation.js";
import { NotFoundError, UpstreamServiceError } from "../utils/errors.js";
import { ValidationError } from "../utils/validation.js";
import { s3Client, BUCKET_NAME, IMAGE_PREFIX } from "../config/s3.js";

const MAX_S3_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 300;

// Thời gian sống của presigned URL trả về cho client (giây).
const IMAGE_URL_EXPIRY_SECONDS = 900;

// Giới hạn số ảnh tối đa mỗi note.
const MAX_IMAGES_PER_NOTE = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs an async operation with simple exponential backoff retry.
 * Used to make S3 uploads/deletes resilient to transient failures.
 * @param {() => Promise<any>} operation
 * @param {string} operationName - used for logging only
 */
const withRetry = async (operation, operationName) => {
  let lastError;

  for (let attempt = 1; attempt <= MAX_S3_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      console.log(
        `[S3 Retry] ${operationName} - attempt ${attempt}/${MAX_S3_RETRIES} failed: ${err.message}`
      );
      if (attempt < MAX_S3_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }

  throw new UpstreamServiceError(
    `${operationName} thất bại sau ${MAX_S3_RETRIES} lần thử: ${lastError.message}`
  );
};

/**
 * Maps a DynamoDB ConditionalCheckFailedException to a domain NotFoundError.
 */
const rethrowAsNotFoundIfMissing = (err) => {
  if (err.name === "ConditionalCheckFailedException") {
    throw new NotFoundError("Note not found");
  }
  throw err;
};

/**
 * NoteService contains all business rules for notes.
 * Controllers call this layer; this layer calls the repository (DynamoDB)
 * and S3 client directly - it never talks HTTP.
 *
 * Image model: each note stores `images: [{ id, key }]` in DynamoDB.
 * We never persist a public/canonical S3 URL - only the object key. The
 * client always receives freshly presigned URLs, generated on every read,
 * because the bucket is private. `id` (separate from the S3 `key`) is what
 * the client uses to target a specific image for deletion, since S3 keys
 * contain "/" and don't survive as a clean URL path param.
 */
export class NoteService {
  constructor(noteRepository = new NoteRepository()) {
    this.noteRepository = noteRepository;
  }

  /**
   * Creates a new note after validating input.
   */
  async createNote({ title, content }) {
    validateNoteInput({ title, content });
    console.log("[NoteService] Creating note", { title });
    return this.noteRepository.create({ title, content });
  }

  /**
   * Returns all notes, with each note's images[] converted to fresh
   * presigned URLs (the bucket is private, so a static S3 URL would
   * always 403 in the browser).
   */
  async getAllNotes() {
    console.log("[NoteService] Fetching all notes");
    const notes = await this.noteRepository.findAll();
    return this._withPresignedImages(notes);
  }

  /**
   * Returns a single note by id, or throws NotFoundError.
   */
  async getNoteById(id) {
    const note = await this.noteRepository.findById(id);
    if (!note) {
      throw new NotFoundError("Note not found");
    }
    return this._withPresignedImageList(note);
  }

  /**
   * Updates title/content of an existing note.
   */
  async updateNote(id, { title, content }) {
    validateNoteInput({ title, content });

    const existing = await this.noteRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Note not found");
    }

    try {
      const updated = await this.noteRepository.update(id, {
        title,
        content,
        updatedAt: new Date().toISOString(),
      });
      return this._withPresignedImageList(updated);
    } catch (err) {
      rethrowAsNotFoundIfMissing(err);
    }
  }

  /**
   * Deletes a note. Any images attached are removed from S3 first so we
   * never leak orphaned objects.
   */
  async deleteNote(id) {
    const existing = await this.noteRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Note not found");
    }

    const images = existing.images || [];
    for (const image of images) {
      await this._deleteImageObjectFromS3(image.key);
    }

    try {
      await this.noteRepository.delete(id);
    } catch (err) {
      rethrowAsNotFoundIfMissing(err);
    }
  }

  /**
   * Uploads one or more images for a note, appending to any existing images.
   * Rejects if the note would end up with more than MAX_IMAGES_PER_NOTE.
   * @param {string} id
   * @param {Array<{buffer: Buffer, originalname: string, mimetype: string}>} files - multer files
   */
  async uploadImages(id, files) {
    if (!files || files.length === 0) {
      throw new ValidationError("Không có file được upload (field name: images)");
    }

    const existing = await this.noteRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Note not found");
    }

    const currentImages = existing.images || [];
    if (currentImages.length + files.length > MAX_IMAGES_PER_NOTE) {
      throw new ValidationError(
        `Mỗi note chỉ được tối đa ${MAX_IMAGES_PER_NOTE} ảnh ` +
          `(hiện có ${currentImages.length}, đang thêm ${files.length})`
      );
    }

    const uploaded = [];
    for (const file of files) {
      const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `${IMAGE_PREFIX}${randomUUID()}_${safeFileName}`;

      await withRetry(
        () =>
          s3Client.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key,
              Body: file.buffer,
              ContentType: file.mimetype,
            })
          ),
        "Upload image lên S3"
      );

      uploaded.push({ id: randomUUID(), key });
    }

    console.log("[NoteService] Uploaded images", { id, count: uploaded.length });

    const images = [...currentImages, ...uploaded];

    try {
      const updated = await this.noteRepository.update(id, {
        images,
        updatedAt: new Date().toISOString(),
      });
      return this._withPresignedImageList(updated);
    } catch (err) {
      rethrowAsNotFoundIfMissing(err);
    }
  }

  /**
   * Deletes a single image (identified by its own `id`, not the S3 key)
   * from a note - both from S3 and from the note's images[] in DynamoDB.
   */
  async deleteImage(id, imageId) {
    const existing = await this.noteRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Note not found");
    }

    const images = existing.images || [];
    const target = images.find((img) => img.id === imageId);
    if (!target) {
      throw new ValidationError("Ảnh không tồn tại trên note này");
    }

    await this._deleteImageObjectFromS3(target.key);
    const remaining = images.filter((img) => img.id !== imageId);

    try {
      const updated = await this.noteRepository.update(id, {
        images: remaining,
        updatedAt: new Date().toISOString(),
      });
      return this._withPresignedImageList(updated);
    } catch (err) {
      rethrowAsNotFoundIfMissing(err);
    }
  }

  /**
   * Signs a single S3 key into a short-lived GET URL.
   * @private
   */
  async _toPresignedUrl(key) {
    return getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
      { expiresIn: IMAGE_URL_EXPIRY_SECONDS }
    );
  }

  /**
   * Returns a copy of `note` with images[] replaced by { id, url } pairs
   * carrying fresh presigned URLs. The raw S3 key is never sent to the client.
   * @private
   */
  async _withPresignedImageList(note) {
    if (!note) return note;
    if (!note.images || note.images.length === 0) {
      return { ...note, images: [] };
    }
    const images = await Promise.all(
      note.images.map(async (img) => ({
        id: img.id,
        url: await this._toPresignedUrl(img.key),
      }))
    );
    return { ...note, images };
  }

  /**
   * Batch version of _withPresignedImageList for note lists.
   * @private
   */
  async _withPresignedImages(notesList) {
    return Promise.all(notesList.map((note) => this._withPresignedImageList(note)));
  }

  /**
   * Internal helper: deletes a single S3 object by key.
   * @private
   */
  async _deleteImageObjectFromS3(key) {
    if (!key) return;
    await withRetry(
      () =>
        s3Client.send(
          new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
          })
        ),
      "Xóa ảnh khỏi S3"
    );
    console.log("[NoteService] Deleted image from S3", { key });
  }
}