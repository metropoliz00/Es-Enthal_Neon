import { pgTable, text, integer, boolean, doublePrecision, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';

// 1. Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  role: text('role').default('siswa'),
  fullname: text('fullname'),
  nama_lengkap: text('nama_lengkap'),
  gender: text('gender'),
  jenis_kelamin: text('jenis_kelamin'),
  school: text('school'),
  kelas_id: text('kelas_id'),
  kelas: text('kelas'),
  kecamatan: text('kecamatan'),
  active_exam: text('active_exam'),
  session: text('session'),
  photo_url: text('photo_url'),
  active_tp: text('active_tp'),
  active_paket: text('active_paket'),
  exam_type: text('exam_type'),
  status: text('status').default('OFFLINE'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// 2. Exams table
export const exams = pgTable('exams', {
  id: text('id').primaryKey(),
  nama_ujian: text('nama_ujian').notNull(),
  waktu_mulai: text('waktu_mulai'),
  durasi: integer('durasi').default(60),
  token_akses: text('token_akses'),
  is_active: boolean('is_active').default(false),
  max_questions: integer('max_questions').default(0)
});

// 3. Questions table
export const questions = pgTable('questions', {
  id: text('id').primaryKey(),
  exam_id: text('exam_id').references(() => exams.id, { onDelete: 'cascade' }),
  text_soal: text('text_soal').notNull(),
  tipe_soal: text('tipe_soal').default('Pilihan Ganda'),
  bobot_nilai: doublePrecision('bobot_nilai').default(1),
  gambar: text('gambar'),
  kelas: text('kelas'),
  tp_id: text('tp_id'),
  caption: text('caption'),
  jenis_ujian: text('jenis_ujian')
});

// 4. Options table
export const options = pgTable('options', {
  id: uuid('id').defaultRandom().primaryKey(),
  question_id: text('question_id').references(() => questions.id, { onDelete: 'cascade' }),
  text_jawaban: text('text_jawaban').notNull(),
  is_correct: boolean('is_correct').default(false)
});

// 5. Student Exams table
export const studentExams = pgTable('student_exams', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: text('user_id'),
  exam_id: text('exam_id'),
  status: text('status').default('ongoing'),
  waktu_submit: timestamp('waktu_submit', { withTimezone: true }).defaultNow(),
  nilai: doublePrecision('nilai').default(0)
});

// 6. Answers table
export const answers = pgTable('answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  student_exam_id: uuid('student_exam_id').references(() => studentExams.id, { onDelete: 'cascade' }),
  question_id: text('question_id'),
  option_id: uuid('option_id')
});

// 7. School Schedules table
export const schoolSchedules = pgTable('school_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  school: text('school').notNull().unique(),
  wave: text('wave'),
  session: text('session'),
  time_slot: text('time_slot')
});

// 8. App Config table
export const appConfig = pgTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value')
});

// 9. User Config table
export const userConfig = pgTable('user_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username'),
  key: text('key'),
  value: text('value')
});

// 10. Learning Objectives table
export const learningObjectives = pgTable('learning_objectives', {
  id: text('id').primaryKey(),
  mapel: text('mapel'),
  tp_code: text('tp_code'),
  description: text('description'),
  kelas: text('kelas')
});

// 11. External Grades table
export const externalGrades = pgTable('external_grades', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username'),
  mapel: text('mapel'),
  nilai: doublePrecision('nilai')
});

// 12. LCC Teams table
export const lccTeams = pgTable('lcc_teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  school: text('school'),
  score: doublePrecision('score').default(0),
  color: text('color').default('#3b82f6'),
  logo: text('logo'),
  correct_count: integer('correct_count').default(0),
  wrong_count: integer('wrong_count').default(0),
  members: jsonb('members').default('[]')
});

// 13. LCC Questions table
export const lccQuestions = pgTable('lcc_questions', {
  id: text('id').primaryKey(),
  nomor_soal: integer('nomor_soal'),
  babak: text('babak'),
  soal: text('soal'),
  referensi_jawaban: text('referensi_jawaban'),
  poin: doublePrecision('poin').default(100),
  kategori: text('kategori')
});

// 14. LCC Config table
export const lccConfig = pgTable('lcc_config', {
  key: text('key').primaryKey(),
  config: jsonb('config').notNull()
});

// 15. LCC History table
export const lccHistory = pgTable('lcc_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  timestamp: text('timestamp'),
  team_id: text('team_id'),
  team_name: text('team_name'),
  points: doublePrecision('points'),
  description: text('description'),
  delta: doublePrecision('delta')
});
