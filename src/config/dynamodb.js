import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * Low-level DynamoDB client.
 * Region is read from environment (never hard-coded).
 */
const dynamoDBClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
});

/**
 * Document client wraps the low-level client so we can work with
 * plain JavaScript objects instead of DynamoDB's AttributeValue format.
 */
export const ddbDocClient = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// Table name is injected via Lambda environment variables (see template.yaml)
export const TABLE_NAME = process.env.NOTES_TABLE_NAME || "Notes";
