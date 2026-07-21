import { randomUUID } from "crypto";
import {
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDocClient, TABLE_NAME } from "../config/dynamodb.js";

/**
 * NoteRepository is the ONLY layer allowed to talk to DynamoDB directly.
 * It knows nothing about HTTP, validation rules or business logic -
 * it simply persists/retrieves plain Note objects.
 */
export class NoteRepository {
  /**
   * Creates a new note item.
   * @param {{title: string, content: string}} note
   * @returns {Promise<object>} the created note
   */
  async create({ title, content }) {
    const now = new Date().toISOString();
    const item = {
      id: randomUUID(),
      title,
      content,
      createdAt: now,
      updatedAt: now,
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );

    return item;
  }

  /**
   * Returns every note in the table.
   * NOTE: Scan is used here for simplicity, matching the small-scale
   * nature of this project. For large datasets, prefer Query + GSI/pagination.
   * @returns {Promise<object[]>}
   */
  async findAll() {
    const items = [];
    let lastEvaluatedKey;

    do {
      const result = await ddbDocClient.send(
        new ScanCommand({
          TableName: TABLE_NAME,
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );
      items.push(...(result.Items || []));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items;
  }

  /**
   * Finds a single note by id.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { id },
      })
    );
    return result.Item || null;
  }

  /**
   * Updates arbitrary fields on an existing note.
   * Throws (ConditionalCheckFailedException) if the note does not exist.
   * @param {string} id
   * @param {object} updates - key/value pairs to set
   * @returns {Promise<object>} the updated note
   */
  async update(id, updates) {
    const expressionParts = [];
    const attributeNames = {};
    const attributeValues = {};

    for (const [key, value] of Object.entries(updates)) {
      expressionParts.push(`#${key} = :${key}`);
      attributeNames[`#${key}`] = key;
      attributeValues[`:${key}`] = value;
    }

    const result = await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id },
        UpdateExpression: `SET ${expressionParts.join(", ")}`,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: attributeValues,
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_NEW",
      })
    );

    return result.Attributes;
  }

  /**
   * Removes the imageUrl attribute from a note (used when deleting an image).
   * @param {string} id
   * @returns {Promise<object>} the updated note
   */
  async removeImageUrl(id) {
    const result = await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id },
        UpdateExpression: "REMOVE imageUrl SET updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":updatedAt": new Date().toISOString(),
        },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_NEW",
      })
    );
    return result.Attributes;
  }

  /**
   * Deletes a note by id.
   * Throws (ConditionalCheckFailedException) if the note does not exist.
   * @param {string} id
   */
  async delete(id) {
    await ddbDocClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id },
        ConditionExpression: "attribute_exists(id)",
      })
    );
  }
}
