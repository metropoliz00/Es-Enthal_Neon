
// 1. Tabel Users
export type UserRole = 'admin' | 'Guru' | 'siswa' | 'Juri' | 'juri' | 'Operator Kecamatan' | 'Operator Gugus' | 'Proktor Sekolah';

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole; // Strict typing
  nama_lengkap: string; // Mapped from 'Fullname' in GAS
  jenis_kelamin?: string; // Mapped from 'Gender'
  kelas_id: string; // Used for School Name in this app context
  kelas?: string; // Mapped from 'Kelas' (Grade Level)
  kecamatan?: string; 
  active_exam?: string; 
  active_tp?: string; // New field for specific TP
  active_paket?: string; // New field for Paket Soal
  exam_type?: string; // NEW: Sumatif 1, 2, etc
  session?: string; 
  photo_url?: string; 
  status?: 'OFFLINE' | 'LOGGED_IN' | 'WORKING' | 'FINISHED';
}

// 2. Tabel Exams (Ujian)
export interface Exam {
  id: string;
  nama_ujian: string;
  waktu_mulai: string; // ISO String
  durasi: number; // in minutes
  token_akses: string;
  is_active: boolean;
  max_questions?: number; 
}

// 3. Tabel Questions (Bank Soal)
export type QuestionType = 'PG' | 'PGK' | 'BS' | 'LIKERT';

export interface Question {
  id: string;
  exam_id: string;
  text_soal: string;
  gambar?: string;
  caption?: string; // NEW: Keterangan Gambar
  tipe_soal: QuestionType;
  bobot_nilai: number;
  kelas?: string; 
  tp_id?: string; 
  jenis_ujian?: string; // NEW: Filter Jenis Ujian
  kode_paket?: string; // NEW: Kode Paket Soal
}

// Interface for Admin CRUD
export interface QuestionRow {
  id: string;
  text_soal: string;
  tipe_soal: QuestionType;
  gambar: string;
  caption?: string; // NEW
  opsi_a: string;
  opsi_b: string;
  opsi_c: string;
  opsi_d: string;
  kunci_jawaban: string;
  bobot: number;
  kelas?: string; 
  tp_id?: string; 
  jenis_ujian?: string; // NEW: Filter Jenis Ujian
  kode_paket?: string; // NEW: Kode Paket Soal
}

// 4. Tabel Options (Pilihan Jawaban)
export interface Option {
  id: string;
  question_id: string;
  text_jawaban: string;
  is_correct: boolean;
}

// 5. Tabel Student Exams (Hasil/Progres)
export interface StudentExam {
  id: string;
  user_id: string;
  exam_id: string;
  status: 'ongoing' | 'completed';
  nilai_akhir: number;
  waktu_submit?: string;
}

// 6. Tabel Answers (Jawaban Siswa)
export interface AnswerDB {
  id: string;
  student_exam_id: string;
  question_id: string;
  option_id: string; 
  answer_value?: string; 
  is_marked: boolean;
}

// 7. Jadwal Sekolah (Gelombang)
export interface SchoolSchedule {
  school: string;
  gelombang: string;
  tanggal: string; 
  tanggal_selesai?: string;
}

// 8. Tujuan Pembelajaran
export interface LearningObjective {
  id: string;
  mapel: string;
  materi: string; 
  kelas: string;
  text_tujuan: string;
}

// 9. External Grades (Manual Input/Import)
export interface ExternalGrade {
  id?: string;
  username: string;
  mapel: string;
  exam_type: string; // Sumatif 1, Sumatif 2, etc.
  nilai: number;
}

// UI State Helper Types
export interface QuestionWithOptions extends Question {
  options: Option[];
}

export type UserAnswerValue = string | string[] | Record<string, boolean> | number;

export interface ExamSessionState {
  answers: Record<string, UserAnswerValue>;
  doubtful: Record<string, boolean>;
  timeLeft: number;
  currentQuestionIndex: number;
}

// Google Apps Script Global Interface
declare global {
  interface Window {
    google?: {
      script: {
        run: {
          withSuccessHandler(callback: (data: any) => void): any;
          withFailureHandler(callback: (error: any) => void): any;
          [key: string]: any;
        };
      };
    };
  }
}
