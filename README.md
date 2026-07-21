# Smart Notes API

REST API quản lý ghi chú (notes), xây dựng theo kiến trúc **Serverless** trên AWS:

```
Client (Postman)
      │
      ▼
API Gateway
      │
      ▼
AWS Lambda (Express + serverless-http)
      │
   ┌──┴──┐
   ▼     ▼
DynamoDB  S3
```

- **Runtime**: Node.js 22 (AWS Lambda, ES Modules)
- **Framework**: Express + serverless-http
- **Database**: Amazon DynamoDB (bảng `Notes`)
- **Storage**: Amazon S3 (chứa ảnh đính kèm ghi chú)
- **IaC**: AWS SAM (`template.yaml`)
- **Kiến trúc code**: Clean Architecture (Controller → Service → Repository)

---

## 1. Cấu trúc thư mục

```
smart-notes-api/
├── template.yaml                 # AWS SAM template (Lambda, API GW, DynamoDB, S3, IAM)
├── package.json
├── jest.config.js
├── .env.example
├── README.md
├── src/
│   ├── app.js                    # Express app (routes + middlewares)
│   ├── lambda.js                 # Lambda handler (serverless-http wrapper)
│   ├── server.js                 # Local dev server (npm start)
│   ├── config/
│   │   ├── dynamodb.js
│   │   └── s3.js
│   ├── routes/
│   │   └── notes.js
│   ├── controllers/
│   │   └── noteController.js
│   ├── services/
│   │   └── noteService.js
│   ├── repositories/
│   │   └── noteRepository.js
│   ├── middlewares/
│   │   └── errorHandler.js
│   └── utils/
│       ├── response.js
│       ├── validation.js
│       └── errors.js
├── events/                       # sam local invoke test events
│   ├── post-note.json
│   ├── get-notes.json
│   ├── get-note-by-id.json
│   ├── put-note.json
│   └── delete-note.json
├── tests/                        # Jest unit tests
│   ├── repositories/noteRepository.test.js
│   ├── services/noteService.test.js
│   └── controllers/noteController.test.js
└── postman/
    └── Smart Notes API.postman_collection.json
```

---

## 2. Yêu cầu cài đặt (Prerequisites)

| Công cụ | Phiên bản tối thiểu | Cài đặt |
|---|---|---|
| Node.js | 22.x | https://nodejs.org |
| npm | đi kèm Node.js | - |
| AWS CLI | v2 | https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html |
| AWS SAM CLI | mới nhất | https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html |
| Docker (tùy chọn) | dùng cho `sam local invoke` | https://www.docker.com |

Cấu hình AWS CLI với tài khoản có quyền deploy (không cần AdministratorAccess, chỉ cần quyền tạo Lambda/API Gateway/DynamoDB/S3/IAM Role):

```bash
aws configure
```

---

## 3. Cài đặt dependencies

```bash
cd smart-notes-api
npm install
```

Sao chép file môi trường mẫu (chỉ dùng khi chạy local qua `npm start`, khi deploy lên AWS các biến này được SAM tự động inject qua `template.yaml`):

```bash
cp .env.example .env
```

---

## 4. Chạy local (tuỳ chọn, không cần Lambda)

```bash
npm start
```

Mặc định API chạy tại `http://localhost:3000`. Lưu ý: khi chạy theo cách này, Lambda/API Gateway không được dùng — đây chỉ là môi trường Express thuần để dev nhanh. Muốn test đúng với môi trường Lambda thật, dùng `sam local start-api` (mục 6).

---

## 5. Build với AWS SAM

```bash
sam build
```

Lệnh này sẽ đóng gói `src/` cùng `node_modules` vào `.aws-sam/build/`.

---

## 6. Deploy lên AWS

### Deploy lần đầu (guided – sẽ hỏi cấu hình và lưu vào `samconfig.toml`)

```bash
sam deploy --guided
```

Khi được hỏi, có thể chọn:
- **Stack Name**: `smart-notes-api`
- **AWS Region**: ví dụ `ap-southeast-1`
- **Confirm changes before deploy**: `Y`
- **Allow SAM CLI IAM role creation**: `Y` (SAM cần tạo IAM Role tối thiểu cho Lambda)
- **Save arguments to configuration file**: `Y`

### Các lần deploy sau

```bash
sam deploy
```

### Test local với Docker (giả lập Lambda + API Gateway)

```bash
sam local start-api
```

API sẽ chạy tại `http://127.0.0.1:3000`.

### Invoke Lambda trực tiếp bằng test events

```bash
sam local invoke SmartNotesFunction --event events/post-note.json
sam local invoke SmartNotesFunction --event events/get-notes.json
sam local invoke SmartNotesFunction --event events/get-note-by-id.json
sam local invoke SmartNotesFunction --event events/put-note.json
sam local invoke SmartNotesFunction --event events/delete-note.json
```

> Với các event `get-note-by-id.json`, `put-note.json`, `delete-note.json`: sửa giá trị `REPLACE_WITH_NOTE_ID` trong file JSON thành `id` thật của một note đã tạo trước đó.

Sau khi deploy thành công, SAM sẽ in ra **Outputs**, trong đó có `ApiUrl` — đây là base URL để gọi API thật trên AWS.

---

## 7. Test bằng Postman

1. Import file `postman/Smart Notes API.postman_collection.json` vào Postman.
2. Trong tab **Variables** của Collection, cập nhật biến `baseUrl` thành giá trị `ApiUrl` in ra sau khi `sam deploy` (ví dụ: `https://abc123.execute-api.ap-southeast-1.amazonaws.com/dev`).
3. Chạy lần lượt các request:
   - **Create Note** → tự động lưu `id` trả về vào biến `noteId` (qua Test script có sẵn).
   - **List Notes**, **Get Note By Id**, **Update Note** dùng `noteId` đó.
   - **Upload Note Image** → chọn file ảnh ở field `image` (form-data) trước khi Send.
   - **Delete Note Image**, **Delete Note** để dọn dẹp.

---

## 8. API Endpoints

| Method | Path | Mô tả |
|---|---|---|
| GET | `/` | Health check |
| POST | `/notes` | Tạo ghi chú mới |
| GET | `/notes` | Lấy danh sách toàn bộ ghi chú |
| GET | `/notes/{id}` | Lấy ghi chú theo id |
| PUT | `/notes/{id}` | Cập nhật ghi chú |
| DELETE | `/notes/{id}` | Xóa ghi chú (và ảnh đính kèm nếu có) |
| POST | `/notes/{id}/image` | Upload ảnh cho ghi chú (multipart/form-data, field `image`) |
| DELETE | `/notes/{id}/image` | Xóa ảnh của ghi chú |

### Request Body (Create/Update)

```json
{
  "title": "AWS Learning",
  "content": "Learning Lambda"
}
```

### Success Response

```json
{
  "success": true,
  "data": { }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Note not found"
}
```

### Validation

- `title`: bắt buộc, tối đa 100 ký tự
- `content`: bắt buộc, tối đa 5000 ký tự

---

## 9. DynamoDB

- **Table**: `Notes-<stage>` (ví dụ `Notes-dev`)
- **Partition key**: `id` (String)
- **Attributes**: `id`, `title`, `content`, `imageUrl`, `createdAt`, `updatedAt`
- **Billing mode**: PAY_PER_REQUEST (on-demand, không cần quản lý capacity)

## 10. Amazon S3

- **Bucket**: `smart-notes-storage-<account-id>-<stage>` (tên bucket phải unique toàn cầu nên có hậu tố account id)
- **Prefix lưu ảnh**: `images/`
- **Tên file**: `<uuid>_<tên-file-gốc>`
- DynamoDB **chỉ lưu URL ảnh** (`imageUrl`), không lưu binary.
- Upload/Delete lên S3 có **retry tối đa 3 lần** với backoff tăng dần (xem `src/services/noteService.js`).

---

## 11. IAM — Nguyên tắc least privilege

Lambda function chỉ được cấp:
- `DynamoDBCrudPolicy` (Read/Write) giới hạn trên đúng bảng `NotesTable`
- `S3CrudPolicy` giới hạn trên đúng bucket `NotesBucket`
- Quyền ghi CloudWatch Logs (`CreateLogGroup`, `CreateLogStream`, `PutLogEvents`) được SAM tự động cấp qua execution role mặc định

Không sử dụng `AdministratorAccess` ở bất kỳ đâu.

---

## 12. Logging

Toàn bộ log dùng `console.log` / `console.error`, có thể xem trực tiếp trên **CloudWatch Logs** (log group: `/aws/lambda/smart-notes-api-<stage>`):

```bash
sam logs -n SmartNotesFunction --stack-name smart-notes-api --tail
```

---

## 13. Unit Test (Jest)

Chạy toàn bộ test (Repository, Service, Controller) kèm coverage:

```bash
npm test
```

Test dùng:
- `aws-sdk-client-mock` để giả lập DynamoDB/S3 (không gọi AWS thật)
- `supertest` để test Controller/Route ở tầng HTTP
- Mock `NoteRepository`/`NoteService` để cô lập từng tầng theo đúng Clean Architecture

---

## 14. Xóa stack (dọn dẹp tài nguyên AWS)

> ⚠️ Lưu ý: S3 bucket cần rỗng trước khi CloudFormation có thể xóa. Xóa hết object trong bucket trước:

```bash
aws s3 rm s3://smart-notes-storage-<account-id>-<stage> --recursive
```

Sau đó xóa toàn bộ stack (Lambda, API Gateway, DynamoDB, S3, IAM Role):

```bash
sam delete
```

hoặc:

```bash
aws cloudformation delete-stack --stack-name smart-notes-api
```

---

## 15. Ghi chú kiến trúc

- **Clean Architecture**: Controller (HTTP) → Service (business logic, validation, S3 retry) → Repository (DynamoDB access). Mỗi tầng không biết chi tiết triển khai của tầng dưới nó ngoài interface đã thống nhất.
- **SOLID**: mỗi class có 1 trách nhiệm rõ ràng (`NoteRepository` chỉ lo persistence, `NoteService` chỉ lo business rule, `noteController` chỉ lo HTTP request/response).
- **Không hard-code thông tin AWS**: region, table name, bucket name đều đọc từ biến môi trường (`process.env`), được inject tự động bởi SAM khi deploy.
- **Error handling**: custom error classes (`ValidationError`, `NotFoundError`, `UpstreamServiceError`) + middleware `errorHandler` tập trung, tất cả lỗi đều trả về đúng format chuẩn.
