/**
 * Sends a standardized success response.
 *   { "success": true, "data": {...} }
 */
export const sendSuccess = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({ success: true, data });
};

/**
 * Sends a standardized error response.
 *   { "success": false, "message": "..." }
 */
export const sendError = (res, message, statusCode = 400) => {
  return res.status(statusCode).json({ success: false, message });
};
