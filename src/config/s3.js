import { S3Client } from "@aws-sdk/client-s3";

/**
 * S3 client used to upload/delete note images.
 * Region and bucket name are read from environment variables (never hard-coded).
 */
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-1",
  maxAttempts: 3, // built-in SDK retry on transient network errors
});

// Bucket name is injected via Lambda environment variables (see template.yaml)
export const BUCKET_NAME = process.env.NOTES_BUCKET_NAME || "smart-notes-storage";

// Prefix used to store note images inside the bucket
export const IMAGE_PREFIX = "images/";
