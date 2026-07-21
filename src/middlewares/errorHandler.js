import multer from "multer";

/**
 * Centralized error handler. Every controller forwards errors here via next(err).
 * Always returns the standard shape: { success: false, message: "..." }
 */
export const errorHandler = (err, req, res, next) => {
  // Multer-specific errors (e.g. file too large) -> 400
  if (err instanceof multer.MulterError) {
    console.error("[ErrorHandler] Multer error:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }

  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500 ? "Internal Server Error" : err.message || "Unexpected error";

  console.error(
    `[ErrorHandler] ${err.name || "Error"} (${statusCode}): ${err.message}`
  );
  if (statusCode === 500) {
    console.error(err.stack);
  }

  return res.status(statusCode).json({ success: false, message });
};
