import { Router } from "express";
import multer from "multer";
import {
  createNote,
  getAllNotes,
  getNoteById,
  updateNote,
  deleteNote,
  uploadImages,
  deleteImage,
} from "../controllers/noteController.js";

// Store uploaded files in memory so we can stream their buffers straight to
// S3 (no local disk writes - important since Lambda's /tmp is limited and
// ephemeral). .array("images", 5) accepts up to 5 files in one multipart
// request, all under the same field name "images".
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max mỗi ảnh
});

const router = Router();

router.post("/", createNote);
router.get("/", getAllNotes);
router.get("/:id", getNoteById);
router.put("/:id", updateNote);
router.delete("/:id", deleteNote);
router.post("/:id/images", upload.array("images", 5), uploadImages);
router.delete("/:id/images/:imageId", deleteImage);

export default router;