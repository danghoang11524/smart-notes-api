import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import notesRouter from "./routes/notes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

// ES Module không có sẵn __dirname, phải tự dựng từ import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve giao diện tĩnh (index.html) từ src/public/
// Đặt TRƯỚC router /notes để "/" trả về HTML thay vì rơi vào 404 handler
app.use(express.static(path.join(__dirname, "public")));

// API routes
app.use("/notes", notesRouter);

// Health-check kỹ thuật, dùng cho curl/monitoring (không dùng "/" nữa vì
// "/" giờ đã được express.static trả về index.html)
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Smart Notes API is running" });
});

// 404 cho các route không khớp (kể cả không khớp static lẫn API)
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Phải đăng ký cuối cùng
app.use(errorHandler);

export default app;