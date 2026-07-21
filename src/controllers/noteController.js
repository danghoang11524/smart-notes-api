import { NoteService } from "../services/noteService.js";
import { sendSuccess } from "../utils/response.js";
import { validateIdParam } from "../utils/validation.js";

const noteService = new NoteService();

/**
 * POST /notes
 */
export const createNote = async (req, res, next) => {
  try {
    console.log("[Controller] POST /notes", { body: req.body });
    const note = await noteService.createNote(req.body || {});
    return sendSuccess(res, note, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /notes
 */
export const getAllNotes = async (req, res, next) => {
  try {
    console.log("[Controller] GET /notes");
    const notes = await noteService.getAllNotes();
    return sendSuccess(res, notes);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /notes/:id
 */
export const getNoteById = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateIdParam(id);
    console.log("[Controller] GET /notes/:id", { id });
    const note = await noteService.getNoteById(id);
    return sendSuccess(res, note);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /notes/:id
 */
export const updateNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateIdParam(id);
    console.log("[Controller] PUT /notes/:id", { id, body: req.body });
    const note = await noteService.updateNote(id, req.body || {});
    return sendSuccess(res, note);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /notes/:id
 */
export const deleteNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateIdParam(id);
    console.log("[Controller] DELETE /notes/:id", { id });
    await noteService.deleteNote(id);
    return sendSuccess(res, { id, message: "Note deleted successfully" });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /notes/:id/images
 * Nhận nhiều file cùng lúc qua multer .array("images", 5)
 */
export const uploadImages = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateIdParam(id);
    console.log("[Controller] POST /notes/:id/images", {
      id,
      files: (req.files || []).map((f) => f.originalname),
    });
    const note = await noteService.uploadImages(id, req.files);
    return sendSuccess(res, note);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /notes/:id/images/:imageId
 */
export const deleteImage = async (req, res, next) => {
  try {
    const { id, imageId } = req.params;
    validateIdParam(id);
    console.log("[Controller] DELETE /notes/:id/images/:imageId", { id, imageId });
    const note = await noteService.deleteImage(id, imageId);
    return sendSuccess(res, note);
  } catch (err) {
    next(err);
  }
};