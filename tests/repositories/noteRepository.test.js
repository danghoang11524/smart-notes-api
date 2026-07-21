import { jest } from "@jest/globals";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { NoteRepository } from "../../src/repositories/noteRepository.js";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe("NoteRepository", () => {
  let repository;

  beforeEach(() => {
    ddbMock.reset();
    repository = new NoteRepository();
  });

  test("create() should PutCommand with generated id and timestamps", async () => {
    ddbMock.on(PutCommand).resolves({});

    const note = await repository.create({
      title: "Test title",
      content: "Test content",
    });

    expect(note.id).toBeDefined();
    expect(note.title).toBe("Test title");
    expect(note.content).toBe("Test content");
    expect(note.createdAt).toBeDefined();
    expect(note.updatedAt).toBeDefined();

    const calls = ddbMock.commandCalls(PutCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.Item.title).toBe("Test title");
  });

  test("findAll() should return all items across pages", async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({
        Items: [{ id: "1" }],
        LastEvaluatedKey: { id: "1" },
      })
      .resolvesOnce({
        Items: [{ id: "2" }],
      });

    const notes = await repository.findAll();

    expect(notes).toHaveLength(2);
    expect(ddbMock.commandCalls(ScanCommand)).toHaveLength(2);
  });

  test("findById() should return null when item does not exist", async () => {
    ddbMock.on(GetCommand).resolves({});
    const note = await repository.findById("non-existent");
    expect(note).toBeNull();
  });

  test("findById() should return the item when found", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { id: "1", title: "Found" } });
    const note = await repository.findById("1");
    expect(note).toEqual({ id: "1", title: "Found" });
  });

  test("update() should build a valid UpdateExpression and return Attributes", async () => {
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { id: "1", title: "Updated" },
    });

    const result = await repository.update("1", { title: "Updated" });

    expect(result).toEqual({ id: "1", title: "Updated" });
    const calls = ddbMock.commandCalls(UpdateCommand);
    expect(calls[0].args[0].input.UpdateExpression).toContain("#title = :title");
  });

  test("delete() should propagate ConditionalCheckFailedException", async () => {
    const error = new Error("Conditional check failed");
    error.name = "ConditionalCheckFailedException";
    ddbMock.on(DeleteCommand).rejects(error);

    await expect(repository.delete("missing-id")).rejects.toThrow(
      "Conditional check failed"
    );
  });
});
