/**
 * Thrown when incoming request data fails validation.
 * Mapped to HTTP 400 by the global error handler.
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

const TITLE_MAX_LENGTH = 100;
const CONTENT_MAX_LENGTH = 5000;

/**
 * Validates the payload used to create/update a Note.
 * - title: required, max 100 characters
 * - content: required, max 5000 characters
 *
 * @param {{title: string, content: string}} input
 * @throws {ValidationError} when validation fails
 */
export const validateNoteInput = ({ title, content } = {}) => {
  const errors = [];

  if (typeof title !== "string" || title.trim().length === 0) {
    errors.push("title là bắt buộc");
  } else if (title.length > TITLE_MAX_LENGTH) {
    errors.push(`title tối đa ${TITLE_MAX_LENGTH} ký tự`);
  }

  if (typeof content !== "string" || content.trim().length === 0) {
    errors.push("content là bắt buộc");
  } else if (content.length > CONTENT_MAX_LENGTH) {
    errors.push(`content tối đa ${CONTENT_MAX_LENGTH} ký tự`);
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join("; "));
  }
};

/**
 * Validates the :id route parameter is present.
 * @param {string} id
 */
export const validateIdParam = (id) => {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    throw new ValidationError("id là bắt buộc");
  }
};
