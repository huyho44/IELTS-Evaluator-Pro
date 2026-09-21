# IELTS-Evaluator-Pro
IELTS Evaluator Pro is a specialized online learning platform designed to optimize IELTS preparation. It provides end-to-end course management, automated grading for receptive skills, and an AI-driven evaluation engine that delivers instant, criteria-based feedback primarily for Writing Skill. The system continuously analyzes user performance metrics to generate personalized learning paths, targeting individual weaknesses to effectively improve overall band scores.


## 🛠 Prerequisites
Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt 3 công cụ sau:
1. **[Node.js](https://nodejs.org/)** (Khuyên dùng bản LTS - v20.x trở lên).
2. **[Git](https://git-scm.com/)** (Để clone code và quản lý phiên bản).
3. **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (Bắt buộc phải mở và chạy ngầm để bật Database & Redis).

---

## ⚙️ Setup Guide

### Bước 1: Clone mã nguồn về máy
Mở Terminal / Git Bash ở thư mục bạn muốn lưu dự án và chạy:
```bash
git clone https://github.com/huyho44/IELTS-Evaluator-Pro
cd ielts-evaluator-pro
```
### Bước 2: Khởi động Hạ tầng
Bật ứng dụng Docker Desktop lên. Sau đó, tại thư mục gốc của dự án, chạy lệnh:
```bash
docker-compose up -d
```

### Bước 3: Cài đặt thư viện cho Frontend

```bash
cd frontend
npm install
```

### Bước 4: Cài đặt thư viện và cấu hình Backend

```bash
cd backend
npm install
```

### Bước 5: Cấu hình biến môi trường Database

Tạo một file tên là `.env` nằm bên trong thư mục `backend/` (cùng cấp với file `package.json`).

Copy dòng sau dán vào file `.env` vừa tạo và lưu lại:
```env
DATABASE_URL="postgresql://root:rootpassword@localhost:5433/ielts_db?schema=public"
```

---

## 🚀 Cách chạy dự án

Bạn sẽ cần mở các cửa sổ Terminal riêng biệt để chạy song song các dịch vụ:

### 1. Chạy Frontend (React/Vite)
```bash
cd frontend
npm run dev
```
👉 Truy cập giao diện web tại: http://localhost:5173

### 2. Chạy Backend (NestJS)
```bash
cd backend
npm run start:dev
```
👉 API Server chạy tại: http://localhost:3000

### 3. Xem và Quản lý Database (Prisma Studio)
 bạn chỉ cần chạy lệnh sau ở thư mục `backend`:
```bash
cd backend
npx prisma studio
```
👉 Giao diện quản lý Database sẽ tự động mở tại: http://localhost:5555