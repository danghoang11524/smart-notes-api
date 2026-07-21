import serverlessHttp from "serverless-http";
import app from "./app.js";

/**
 * AWS Lambda handler.
 * `binary` tells serverless-http which content types should be treated as
 * base64-encoded binary (needed for multipart/form-data image uploads).
 */
export const handler = serverlessHttp(app, {
  binary: ["multipart/form-data", "image/*", "application/octet-stream"],
});
