# Petunjuk Migrasi Neon DB & Panduan Deployment (GitHub & Vercel / Render)

Aplikasi ini telah berhasil dimigrasikan dari Supabase ke database relasional **Neon DB / PostgreSQL** menggunakan **Drizzle ORM**. Seluruh routing API, skema tabel, dan dev server telah disiapkan secara otomatis dan siap digunakan.

---

## 1. Konfigurasi Environment Variables (.env)

Untuk menjalankan aplikasi ini secara lokal maupun di server produksi, Anda memerlukan variabel lingkungan berikut. Buat file `.env` di root direktori Anda (atau isi langsung di platform hosting seperti Vercel/Render):

```env
# Database Credentials (Neon DB / PostgreSQL)
SQL_HOST=your-neon-db-hostname.neon.tech
SQL_DB_NAME=neondb
SQL_USER=your-database-username
SQL_PASSWORD=your-database-password
SQL_ADMIN_USER=your-database-username
SQL_ADMIN_PASSWORD=your-database-password
```

---

## 2. Struktur Skema Database (SQL)

Drizzle ORM secara otomatis menyusun skema relasional berikut pada database Anda. Jika Anda ingin membuat tabel secara manual di Console Neon DB, Anda dapat menggunakan perintah SQL berikut:

```sql
-- 1. Tabel Users
CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "username" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "role" TEXT DEFAULT 'siswa',
    "fullname" TEXT,
    "nama_lengkap" TEXT,
    "gender" TEXT,
    "jenis_kelamin" TEXT,
    "school" TEXT,
    "kelas_id" TEXT,
    "kelas" TEXT,
    "kecamatan" TEXT,
    "active_exam" TEXT,
    "session" TEXT,
    "photo_url" TEXT,
    "active_tp" TEXT,
    "active_paket" TEXT,
    "exam_type" TEXT,
    "status" TEXT DEFAULT 'OFFLINE',
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. Tabel Exams
CREATE TABLE IF NOT EXISTS "exams" (
    "id" TEXT PRIMARY KEY,
    "nama_ujian" TEXT NOT NULL,
    "waktu_mulai" TEXT,
    "durasi" INTEGER DEFAULT 60,
    "token_akses" TEXT,
    "is_active" BOOLEAN DEFAULT false,
    "max_questions" INTEGER DEFAULT 0
);

-- 3. Tabel Questions
CREATE TABLE IF NOT EXISTS "questions" (
    "id" TEXT PRIMARY KEY,
    "exam_id" TEXT REFERENCES "exams"("id") ON DELETE CASCADE,
    "text_soal" TEXT NOT NULL,
    "tipe_soal" TEXT DEFAULT 'Pilihan Ganda',
    "bobot_nilai" DOUBLE PRECISION DEFAULT 1,
    "gambar" TEXT,
    "kelas" TEXT,
    "tp_id" TEXT,
    "caption" TEXT,
    "jenis_ujian" TEXT
);

-- 4. Tabel Options
CREATE TABLE IF NOT EXISTS "options" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "question_id" TEXT REFERENCES "questions"("id") ON DELETE CASCADE,
    "text_jawaban" TEXT NOT NULL,
    "is_correct" BOOLEAN DEFAULT false
);

-- 5. Tabel Student Exams
CREATE TABLE IF NOT EXISTS "student_exams" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" TEXT,
    "exam_id" TEXT,
    "status" TEXT DEFAULT 'ongoing',
    "waktu_submit" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "nilai" DOUBLE PRECISION DEFAULT 0
);

-- 6. Tabel Answers
CREATE TABLE IF NOT EXISTS "answers" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "student_exam_id" UUID REFERENCES "student_exams"("id") ON DELETE CASCADE,
    "question_id" TEXT,
    "option_id" UUID
);

-- 7. Tabel School Schedules
CREATE TABLE IF NOT EXISTS "school_schedules" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "school" TEXT NOT NULL UNIQUE,
    "wave" TEXT,
    "session" TEXT,
    "time_slot" TEXT
);

-- 8. Tabel App Config
CREATE TABLE IF NOT EXISTS "app_config" (
    "key" TEXT PRIMARY KEY,
    "value" TEXT
);

-- 9. Tabel User Config
CREATE TABLE IF NOT EXISTS "user_config" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "username" TEXT,
    "key" TEXT,
    "value" TEXT
);

-- 10. Tabel Learning Objectives
CREATE TABLE IF NOT EXISTS "learning_objectives" (
    "id" TEXT PRIMARY KEY,
    "mapel" TEXT,
    "tp_code" TEXT,
    "description" TEXT,
    "kelas" TEXT
);

-- 11. Tabel External Grades
CREATE TABLE IF NOT EXISTS "external_grades" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "username" TEXT,
    "mapel" TEXT,
    "nilai" DOUBLE PRECISION
);

-- 12. Tabel LCC Teams
CREATE TABLE IF NOT EXISTS "lcc_teams" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "school" TEXT,
    "score" DOUBLE PRECISION DEFAULT 0,
    "color" TEXT DEFAULT '#3b82f6',
    "logo" TEXT,
    "correct_count" INTEGER DEFAULT 0,
    "wrong_count" INTEGER DEFAULT 0,
    "members" JSONB DEFAULT '[]'
);

-- 13. Tabel LCC Questions
CREATE TABLE IF NOT EXISTS "lcc_questions" (
    "id" TEXT PRIMARY KEY,
    "nomor_soal" INTEGER,
    "babak" TEXT,
    "soal" TEXT,
    "referensi_jawaban" TEXT,
    "poin" DOUBLE PRECISION DEFAULT 100,
    "kategori" TEXT
);

-- 14. Tabel LCC Config
CREATE TABLE IF NOT EXISTS "lcc_config" (
    "key" TEXT PRIMARY KEY,
    "config" JSONB NOT NULL
);

-- 15. Tabel LCC History
CREATE TABLE IF NOT EXISTS "lcc_history" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "timestamp" TEXT,
    "team_id" TEXT,
    "team_name" TEXT,
    "points" DOUBLE PRECISION,
    "description" TEXT,
    "delta" DOUBLE PRECISION
);
```

---

## 3. Langkah-Langkah Push ke GitHub

Untuk menyimpan kode ini ke repositori GitHub Anda:

1. **Inisialisasi Git** (jika belum dilakukan):
   ```bash
   git init
   ```
2. **Tambahkan semua file**:
   ```bash
   git add .
   ```
3. **Commit perubahan**:
   ```bash
   git commit -m "Migration to Neon DB with Full-Stack Express and React"
   ```
4. **Hubungkan ke GitHub**:
   Buat repositori baru di GitHub (jangan centang tambahkan README/gitignore). Hubungkan dengan perintah berikut:
   ```bash
   git remote add origin https://github.com/USERNAME_ANDA/NAMA_REPOS_ANDA.git
   git branch -M main
   git push -u origin main
   ```

---

## 4. Panduan Deployment (Rekomendasi)

Karena aplikasi ini berupa **Full-Stack (React/Vite Frontend + Express Backend)**, platform yang mendukung Server Stateful dan Service Node.js secara langsung adalah pilihan terbaik untuk menghindari pembatasan timeout serverless.

### Opsi A: Render.com / Railway.app (Sangat Direkomendasikan ⭐)
Platform ini menjalankan server Node.js 24/7 dengan sangat mudah:
1. Hubungkan akun **Render/Railway** ke repositori GitHub Anda.
2. Buat **Web Service** baru.
3. Gunakan konfigurasi berikut:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
4. Di bagian **Environment Variables**, masukkan seluruh kredensial database Neon Anda (sesuai langkah 1).

### Opsi B: Vercel Deployment
Vercel secara default ditujukan untuk situs web statis (SPA). Karena aplikasi kita memiliki backend Express (`server.ts`), Anda dapat men-deploy sisi Frontend statisnya langsung di Vercel, sementara file server Node.js di-deploy ke Render, lalu sesuaikan URL API di `/src/services/api.ts` agar mengarah ke server Render Anda.
