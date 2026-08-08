-- ============================================================================
-- SKEMA DATABASE SUPABASE UNTUK CBT-TKA SYSTEM
-- ============================================================================
-- Buka Dashboard Supabase (https://supabase.com) -> pilih proyek Anda -> SQL Editor
-- Tempelkan seluruh isi skrip ini lalu klik "Run".
-- ============================================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabel Users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'siswa',
  fullname TEXT,
  nama_lengkap TEXT,
  gender TEXT,
  jenis_kelamin TEXT,
  school TEXT,
  kelas_id TEXT,
  kelas TEXT,
  kecamatan TEXT,
  active_exam TEXT,
  session TEXT,
  photo_url TEXT,
  active_tp TEXT,
  active_paket TEXT,
  exam_type TEXT,
  status TEXT DEFAULT 'OFFLINE',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Tabel Ujian (Exams)
CREATE TABLE IF NOT EXISTS public.exams (
  id TEXT PRIMARY KEY,
  nama_ujian TEXT NOT NULL,
  waktu_mulai TEXT,
  durasi INTEGER DEFAULT 60,
  token_akses TEXT,
  is_active BOOLEAN DEFAULT false,
  max_questions INTEGER DEFAULT 0
);

-- 3. Tabel Soal (Questions)
CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY,
  exam_id TEXT REFERENCES public.exams(id) ON DELETE CASCADE,
  text_soal TEXT NOT NULL,
  tipe_soal TEXT DEFAULT 'Pilihan Ganda',
  bobot_nilai DOUBLE PRECISION DEFAULT 1,
  gambar TEXT,
  kelas TEXT,
  tp_id TEXT,
  caption TEXT,
  jenis_ujian TEXT,
  kode_paket TEXT
);

-- Pastikan kolom tambahan pada tabel questions jika tabel sudah ada sebelumnya
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS caption TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS jenis_ujian TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS kode_paket TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS tp_id TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS kelas TEXT;

-- 4. Tabel Opsi Jawaban (Options)
CREATE TABLE IF NOT EXISTS public.options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id TEXT REFERENCES public.questions(id) ON DELETE CASCADE,
  text_jawaban TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false
);

-- 5. Tabel Ujian Siswa (Student Exams)
CREATE TABLE IF NOT EXISTS public.student_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  exam_id TEXT,
  status TEXT DEFAULT 'ongoing',
  waktu_submit TIMESTAMPTZ DEFAULT NOW(),
  nilai DOUBLE PRECISION DEFAULT 0
);

-- 6. Tabel Jawaban Siswa (Answers)
CREATE TABLE IF NOT EXISTS public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_exam_id UUID REFERENCES public.student_exams(id) ON DELETE CASCADE,
  question_id TEXT,
  option_id UUID
);

-- 7. Tabel Jadwal Sekolah (School Schedules)
CREATE TABLE IF NOT EXISTS public.school_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school TEXT NOT NULL UNIQUE,
  wave TEXT,
  session TEXT,
  time_slot TEXT
);

-- 8. Tabel Konfigurasi Aplikasi (App Config)
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 9. Tabel Konfigurasi User (User Config)
CREATE TABLE IF NOT EXISTS public.user_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT,
  key TEXT,
  value TEXT
);

-- 10. Tabel Tujuan Pembelajaran (Learning Objectives / TP)
CREATE TABLE IF NOT EXISTS public.learning_objectives (
  id TEXT PRIMARY KEY,
  mapel TEXT,
  tp_code TEXT,
  description TEXT,
  kelas TEXT
);

-- 11. Tabel Nilai Eksternal (External Grades)
CREATE TABLE IF NOT EXISTS public.external_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT,
  mapel TEXT,
  nilai DOUBLE PRECISION
);

-- 12. Tabel Tim LCC (LCC Teams)
CREATE TABLE IF NOT EXISTS public.lcc_teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  school TEXT,
  score DOUBLE PRECISION DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  logo TEXT,
  correct_count INTEGER DEFAULT 0,
  wrong_count INTEGER DEFAULT 0,
  members JSONB DEFAULT '[]'::jsonb
);

-- 13. Tabel Soal LCC (LCC Questions)
CREATE TABLE IF NOT EXISTS public.lcc_questions (
  id TEXT PRIMARY KEY,
  nomor_soal INTEGER,
  babak TEXT,
  soal TEXT,
  referensi_jawaban TEXT,
  poin DOUBLE PRECISION DEFAULT 100,
  kategori TEXT
);

-- 14. Tabel Pengaturan LCC (LCC Config)
CREATE TABLE IF NOT EXISTS public.lcc_config (
  key TEXT PRIMARY KEY,
  config JSONB NOT NULL
);

-- 15. Tabel Riwayat Poin LCC (LCC History)
CREATE TABLE IF NOT EXISTS public.lcc_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TEXT,
  team_id TEXT,
  team_name TEXT,
  points DOUBLE PRECISION,
  description TEXT,
  delta DOUBLE PRECISION
);

-- ============================================================================
-- INDEX UNTUK PERFORMA QUERY SUPABASE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON public.questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_options_question_id ON public.options(question_id);
CREATE INDEX IF NOT EXISTS idx_student_exams_user_id ON public.student_exams(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_student_exam_id ON public.answers(student_exam_id);

-- ============================================================================
-- SEED USER ADMIN DEFAULT (JIKA BELUM ADA)
-- Username: admin | Password: adminpassword (atau sesuaikan)
-- ============================================================================
INSERT INTO public.users (username, password, role, fullname, nama_lengkap)
VALUES ('admin', 'adminpassword', 'admin', 'Administrator Utama', 'Administrator Utama')
ON CONFLICT (username) DO NOTHING;
