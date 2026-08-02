import { createPool } from './index';

export async function initDbTables() {
  const hasEnv = !!(process.env.DATABASE_URL || process.env.SQL_HOST);
  if (!hasEnv) {
    console.log("DATABASE_URL or SQL_HOST environment variable is not set. Skipping automatic DB table initialization.");
    return false;
  }

  const pool = createPool();
  try {
    await pool.query(`
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

      CREATE TABLE IF NOT EXISTS "exams" (
          "id" TEXT PRIMARY KEY,
          "nama_ujian" TEXT NOT NULL,
          "waktu_mulai" TEXT,
          "durasi" INTEGER DEFAULT 60,
          "token_akses" TEXT,
          "is_active" BOOLEAN DEFAULT false,
          "max_questions" INTEGER DEFAULT 0
      );

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

      CREATE TABLE IF NOT EXISTS "options" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "question_id" TEXT REFERENCES "questions"("id") ON DELETE CASCADE,
          "text_jawaban" TEXT NOT NULL,
          "is_correct" BOOLEAN DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS "student_exams" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" TEXT,
          "exam_id" TEXT,
          "status" TEXT DEFAULT 'ongoing',
          "waktu_submit" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          "nilai" DOUBLE PRECISION DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS "answers" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "student_exam_id" UUID REFERENCES "student_exams"("id") ON DELETE CASCADE,
          "question_id" TEXT,
          "option_id" UUID
      );

      CREATE TABLE IF NOT EXISTS "school_schedules" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "school" TEXT NOT NULL UNIQUE,
          "wave" TEXT,
          "session" TEXT,
          "time_slot" TEXT
      );

      CREATE TABLE IF NOT EXISTS "app_config" (
          "key" TEXT PRIMARY KEY,
          "value" TEXT
      );

      CREATE TABLE IF NOT EXISTS "user_config" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "username" TEXT,
          "key" TEXT,
          "value" TEXT
      );

      CREATE TABLE IF NOT EXISTS "learning_objectives" (
          "id" TEXT PRIMARY KEY,
          "mapel" TEXT,
          "tp_code" TEXT,
          "description" TEXT,
          "kelas" TEXT
      );

      CREATE TABLE IF NOT EXISTS "external_grades" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "username" TEXT,
          "mapel" TEXT,
          "nilai" DOUBLE PRECISION
      );

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

      CREATE TABLE IF NOT EXISTS "lcc_questions" (
          "id" TEXT PRIMARY KEY,
          "nomor_soal" INTEGER,
          "babak" TEXT,
          "soal" TEXT,
          "referensi_jawaban" TEXT,
          "poin" DOUBLE PRECISION DEFAULT 100,
          "kategori" TEXT
      );

      CREATE TABLE IF NOT EXISTS "lcc_config" (
          "key" TEXT PRIMARY KEY,
          "config" JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "lcc_history" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "timestamp" TEXT,
          "team_id" TEXT,
          "team_name" TEXT,
          "points" DOUBLE PRECISION,
          "description" TEXT,
          "delta" DOUBLE PRECISION
      );
    `);
    console.log("Neon/PostgreSQL DB tables verified and initialized successfully.");
    return true;
  } catch (err: any) {
    console.error("Failed to auto-initialize DB tables:", err.message);
    return false;
  }
}
