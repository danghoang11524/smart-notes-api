/**
 * Thrown when a requested Note (or Note image) does not exist.
 * Mapped to HTTP 404 by the global error handler.
 */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = 404;
  }
}

/**
 * Thrown when an upstream AWS operation (S3/DynamoDB) fails after retries.
 * Mapped to HTTP 502 by the global error handler.
 */
export class UpstreamServiceError extends Error {
  constructor(message = "Upstream service error") {
    super(message);
    this.name = "UpstreamServiceError";
    this.statusCode = 502;
  }
}
