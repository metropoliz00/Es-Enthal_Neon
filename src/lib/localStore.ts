import fs from 'fs';
import path from 'path';

export interface LocalUser {
  id: string;
  username: string;
  password?: string;
  role: string;
  fullname?: string;
  nama_lengkap?: string;
  gender?: string;
  jenis_kelamin?: string;
  school?: string;
  kelas_id?: string;
  kelas?: string;
  kecamatan?: string;
  active_exam?: string | null;
  active_tp?: string | null;
  active_paket?: string | null;
  exam_type?: string | null;
  session?: string | null;
  photo_url?: string | null;
  status?: 'OFFLINE' | 'LOGGED_IN' | 'WORKING' | 'FINISHED';
  created_at?: string;
}

export interface LocalExam {
  id: string;
  nama_ujian: string;
  waktu_mulai?: string;
  durasi?: number;
  token_akses?: string;
  is_active?: boolean;
  max_questions?: number;
}

export interface LocalOption {
  id: string;
  question_id: string;
  text_jawaban: string;
  is_correct: boolean;
}

export interface LocalQuestion {
  id: string;
  exam_id: string;
  text_soal: string;
  tipe_soal: string;
  bobot_nilai: number;
  gambar?: string;
  caption?: string;
  kelas?: string;
  tp_id?: string;
  jenis_ujian?: string;
  kode_paket?: string;
  mapel?: string;
  options?: LocalOption[];
}

export interface LocalAppConfig {
  key: string;
  value: string;
}

export interface LocalUserConfig {
  id?: string;
  username: string;
  key: string;
  value: string;
}

export interface LocalStudentExam {
  id: string;
  user_id: string;
  exam_id: string;
  status: 'ongoing' | 'completed';
  nilai?: number;
  nilai_akhir?: number;
  waktu_submit?: string;
}

export interface LocalAnswer {
  id: string;
  student_exam_id: string;
  question_id: string;
  option_id?: string | null;
  answer_text?: string | null;
  score?: number;
  feedback?: string;
}

export interface LocalLO {
  id: string;
  mapel: string;
  materi: string;
  kelas: string;
  text_tujuan: string;
}

export interface LocalSchedule {
  school: string;
  gelombang: string;
  tanggal: string;
  tanggal_selesai?: string;
}

export interface LocalExternalGrade {
  id?: string;
  username: string;
  mapel: string;
  exam_type: string;
  nilai: number;
}

export interface LocalStoreData {
  users: LocalUser[];
  exams: LocalExam[];
  questions: LocalQuestion[];
  options: LocalOption[];
  app_config: LocalAppConfig[];
  user_config: LocalUserConfig[];
  student_exams: LocalStudentExam[];
  answers: LocalAnswer[];
  learning_objectives: LocalLO[];
  school_schedules: LocalSchedule[];
  external_grades: LocalExternalGrade[];
  lcc_teams: any[];
  lcc_questions: any[];
  lcc_config: any;
  lcc_history: any[];
}

const stringToUuid = (str: string): string => {
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str)) {
    return str;
  }
  let hash1 = 0, hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash1 = (hash1 << 5) - hash1 + ch;
    hash1 |= 0;
    hash2 = (hash2 << 7) - hash2 + ch;
    hash2 |= 0;
  }
  const h1 = Math.abs(hash1).toString(16).padStart(8, '0').slice(0, 8);
  const h2 = Math.abs(hash2).toString(16).padStart(12, '0').slice(0, 12);
  return `${h1}-4b3a-8c9d-a123-${h2}`;
};

const generateUuid = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const defaultSeedData: LocalStoreData = {
  users: [
    {
      id: stringToUuid('admin'),
      username: 'admin',
      password: 'admin',
      role: 'admin',
      fullname: 'Administrator Pusat',
      nama_lengkap: 'Administrator Pusat',
      school: 'PUSAT',
      kelas_id: 'PUSAT',
      kelas: 'Semua',
      kecamatan: 'Pusat',
      status: 'OFFLINE'
    },
    {
      id: stringToUuid('guru1'),
      username: 'guru1',
      password: '123',
      role: 'Guru',
      fullname: 'Bapak Guru Pembina',
      nama_lengkap: 'Bapak Guru Pembina',
      school: 'SDN 01 PUSAT',
      kelas_id: 'SDN 01 PUSAT',
      kelas: 'Kelas 5',
      kecamatan: 'Kecamatan 1',
      status: 'OFFLINE'
    },
    {
      id: stringToUuid('siswa1'),
      username: 'siswa1',
      password: '123',
      role: 'siswa',
      fullname: 'Ahmad Pratama',
      nama_lengkap: 'Ahmad Pratama',
      gender: 'L',
      jenis_kelamin: 'L',
      school: 'SDN 01 PUSAT',
      kelas_id: 'SDN 01 PUSAT',
      kelas: 'Kelas 5',
      kecamatan: 'Kecamatan 1',
      active_exam: 'Umum',
      session: 'Sesi 1',
      status: 'OFFLINE'
    },
    {
      id: stringToUuid('siswa2'),
      username: 'siswa2',
      password: '123',
      role: 'siswa',
      fullname: 'Siti Rahmawati',
      nama_lengkap: 'Siti Rahmawati',
      gender: 'P',
      jenis_kelamin: 'P',
      school: 'SDN 01 PUSAT',
      kelas_id: 'SDN 01 PUSAT',
      kelas: 'Kelas 5',
      kecamatan: 'Kecamatan 1',
      active_exam: 'Umum',
      session: 'Sesi 1',
      status: 'OFFLINE'
    },
    {
      id: stringToUuid('regu_a'),
      username: 'regu_a',
      password: '123',
      role: 'siswa',
      fullname: 'Regu A (SDN 01)',
      nama_lengkap: 'Regu A (SDN 01)',
      school: 'SDN 01 PUSAT',
      kelas_id: 'SDN 01 PUSAT',
      kelas: 'Kelas 5',
      kecamatan: 'Kecamatan 1',
      active_exam: 'Umum',
      exam_type: 'LCC Beregu',
      status: 'OFFLINE'
    },
    {
      id: stringToUuid('regu_b'),
      username: 'regu_b',
      password: '123',
      role: 'siswa',
      fullname: 'Regu B (SDN 02)',
      nama_lengkap: 'Regu B (SDN 02)',
      school: 'SDN 02 PUSAT',
      kelas_id: 'SDN 02 PUSAT',
      kelas: 'Kelas 5',
      kecamatan: 'Kecamatan 1',
      active_exam: 'Umum',
      exam_type: 'LCC Beregu',
      status: 'OFFLINE'
    }
  ],
  exams: [
    {
      id: stringToUuid('Umum'),
      nama_ujian: 'Umum',
      waktu_mulai: new Date().toISOString(),
      durasi: 60,
      token_akses: '123456',
      is_active: true,
      max_questions: 10
    },
    {
      id: stringToUuid('Matematika'),
      nama_ujian: 'Matematika',
      waktu_mulai: new Date().toISOString(),
      durasi: 60,
      token_akses: '123456',
      is_active: true,
      max_questions: 10
    },
    {
      id: stringToUuid('Bahasa Indonesia'),
      nama_ujian: 'Bahasa Indonesia',
      waktu_mulai: new Date().toISOString(),
      durasi: 60,
      token_akses: '123456',
      is_active: true,
      max_questions: 10
    }
  ],
  questions: [
    {
      id: stringToUuid('q1_umum'),
      exam_id: stringToUuid('Umum'),
      text_soal: 'Ibukota negara Indonesia adalah ...',
      tipe_soal: 'Pilihan Ganda',
      bobot_nilai: 10,
      kelas: 'Kelas 5',
      mapel: 'Umum'
    },
    {
      id: stringToUuid('q2_umum'),
      exam_id: stringToUuid('Umum'),
      text_soal: 'Pancasila sila pertama berbunyi ...',
      tipe_soal: 'Pilihan Ganda',
      bobot_nilai: 10,
      kelas: 'Kelas 5',
      mapel: 'Umum'
    },
    {
      id: stringToUuid('q3_umum'),
      exam_id: stringToUuid('Umum'),
      text_soal: 'Jelaskan pentingnya menjaga kebersihan lingkungan sekolah!',
      tipe_soal: 'Uraian',
      bobot_nilai: 20,
      kelas: 'Kelas 5',
      mapel: 'Umum'
    }
  ],
  options: [
    {
      id: stringToUuid('opt_q1_a'),
      question_id: stringToUuid('q1_umum'),
      text_jawaban: 'Jakarta / Nusantara',
      is_correct: true
    },
    {
      id: stringToUuid('opt_q1_b'),
      question_id: stringToUuid('q1_umum'),
      text_jawaban: 'Surabaya',
      is_correct: false
    },
    {
      id: stringToUuid('opt_q1_c'),
      question_id: stringToUuid('q1_umum'),
      text_jawaban: 'Bandung',
      is_correct: false
    },
    {
      id: stringToUuid('opt_q1_d'),
      question_id: stringToUuid('q1_umum'),
      text_jawaban: 'Medan',
      is_correct: false
    },
    {
      id: stringToUuid('opt_q2_a'),
      question_id: stringToUuid('q2_umum'),
      text_jawaban: 'Ketuhanan Yang Maha Esa',
      is_correct: true
    },
    {
      id: stringToUuid('opt_q2_b'),
      question_id: stringToUuid('q2_umum'),
      text_jawaban: 'Kemanusiaan yang adil dan beradab',
      is_correct: false
    },
    {
      id: stringToUuid('opt_q2_c'),
      question_id: stringToUuid('q2_umum'),
      text_jawaban: 'Persatuan Indonesia',
      is_correct: false
    },
    {
      id: stringToUuid('opt_q2_d'),
      question_id: stringToUuid('q2_umum'),
      text_jawaban: 'Keadilan sosial bagi seluruh rakyat Indonesia',
      is_correct: false
    }
  ],
  app_config: [
    { key: 'APP_TITLE', value: 'CBT System & Asesmen Digital' },
    { key: 'DEFAULT_TOKEN', value: '123456' },
    { key: 'EXAMBROWSER_MODE', value: 'off' },
    { key: 'ANNOUNCEMENT', value: 'Selamat datang di Aplikasi Ujian CBT & Asesmen' },
    { key: 'SHOW_EXAM_RESULTS', value: 'true' },
    { key: 'AUDIO_ENABLED', value: 'true' }
  ],
  user_config: [],
  student_exams: [],
  answers: [],
  learning_objectives: [
    {
      id: stringToUuid('lo_1'),
      mapel: 'Umum',
      materi: 'Wawasan Kebangsaan',
      kelas: 'Kelas 5',
      text_tujuan: 'Siswa mampu memahami simbol dan dasar negara Indonesia'
    }
  ],
  school_schedules: [
    {
      school: 'SDN 01 PUSAT',
      gelombang: 'Gelombang 1',
      tanggal: new Date().toISOString().split('T')[0]
    }
  ],
  external_grades: [],
  lcc_teams: [
    { id: '1', name: 'Regu A', score: 0, school: 'SDN 01 PUSAT' },
    { id: '2', name: 'Regu B', score: 0, school: 'SDN 02 PUSAT' },
    { id: '3', name: 'Regu C', score: 0, school: 'SDN 03 PUSAT' }
  ],
  lcc_questions: [],
  lcc_config: {
    title: 'Lomba Cerdas Cermat (LCC)',
    timerSeconds: 15,
    soundEnabled: true
  },
  lcc_history: []
};

class LocalStoreManager {
  private data: LocalStoreData;
  private filePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'cbt_store.json');
    this.data = this.loadData();
  }

  private loadData(): LocalStoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...defaultSeedData,
          ...parsed,
          users: parsed.users || defaultSeedData.users,
          exams: parsed.exams || defaultSeedData.exams,
          questions: parsed.questions || defaultSeedData.questions,
          options: parsed.options || defaultSeedData.options,
          app_config: parsed.app_config || defaultSeedData.app_config,
          user_config: parsed.user_config || defaultSeedData.user_config,
          student_exams: parsed.student_exams || defaultSeedData.student_exams,
          answers: parsed.answers || defaultSeedData.answers,
          learning_objectives: parsed.learning_objectives || defaultSeedData.learning_objectives,
          school_schedules: parsed.school_schedules || defaultSeedData.school_schedules,
          external_grades: parsed.external_grades || defaultSeedData.external_grades,
          lcc_teams: parsed.lcc_teams || defaultSeedData.lcc_teams,
          lcc_questions: parsed.lcc_questions || defaultSeedData.lcc_questions,
          lcc_config: parsed.lcc_config || defaultSeedData.lcc_config,
          lcc_history: parsed.lcc_history || defaultSeedData.lcc_history
        };
      }
    } catch (e) {
      console.warn("Could not read local store file, initializing with default data:", e);
    }

    this.saveDataImmediately(defaultSeedData);
    return JSON.parse(JSON.stringify(defaultSeedData));
  }

  private saveDataImmediately(data: LocalStoreData) {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error("Failed to write to local store file:", e);
    }
  }

  public save() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveDataImmediately(this.data);
    }, 100);
  }

  // --- Users ---
  public getUsers(): LocalUser[] {
    return this.data.users;
  }

  public findUser(username: string): LocalUser | undefined {
    return this.data.users.find(u => u.username === username);
  }

  public saveUser(user: any): LocalUser {
    const existingIndex = this.data.users.findIndex(u => u.username === user.username);
    const item: LocalUser = {
      id: user.id || (existingIndex >= 0 ? this.data.users[existingIndex].id : stringToUuid(user.username)),
      username: user.username,
      password: user.password !== undefined ? user.password : (existingIndex >= 0 ? this.data.users[existingIndex].password : '123456'),
      role: user.role || 'siswa',
      fullname: user.fullname || user.nama_lengkap || user.username,
      nama_lengkap: user.fullname || user.nama_lengkap || user.username,
      gender: user.gender || user.jenis_kelamin,
      jenis_kelamin: user.gender || user.jenis_kelamin,
      school: user.school || user.kelas_id || 'PUSAT',
      kelas_id: user.school || user.kelas_id || 'PUSAT',
      kelas: user.kelas || '',
      kecamatan: user.kecamatan || '',
      active_exam: user.active_exam,
      session: user.session,
      photo_url: user.photo_url,
      active_tp: user.active_tp,
      active_paket: user.active_paket,
      exam_type: user.exam_type,
      status: user.status || 'OFFLINE'
    };

    if (existingIndex >= 0) {
      this.data.users[existingIndex] = { ...this.data.users[existingIndex], ...item };
    } else {
      this.data.users.push(item);
    }
    this.save();
    return item;
  }

  public updateUser(username: string, updates: Partial<LocalUser>): boolean {
    const user = this.findUser(username);
    if (user) {
      Object.assign(user, updates);
      this.save();
      return true;
    }
    return false;
  }

  public deleteUser(username: string): boolean {
    const initialLen = this.data.users.length;
    this.data.users = this.data.users.filter(u => u.username !== username);
    if (this.data.users.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  public importUsers(usersList: any[]): number {
    let count = 0;
    for (const u of usersList) {
      if (u && u.username) {
        this.saveUser(u);
        count++;
      }
    }
    return count;
  }

  // --- Exams ---
  public getExams(): LocalExam[] {
    return this.data.exams;
  }

  public ensureExam(exam: any): LocalExam {
    const examId = exam.id || stringToUuid(exam.nama_ujian);
    const existing = this.data.exams.find(e => e.id === examId || e.nama_ujian === exam.nama_ujian);
    if (existing) {
      Object.assign(existing, exam, { id: examId });
      this.save();
      return existing;
    }
    const newExam: LocalExam = {
      id: examId,
      nama_ujian: exam.nama_ujian,
      waktu_mulai: exam.waktu_mulai || new Date().toISOString(),
      durasi: exam.durasi || 60,
      token_akses: exam.token_akses || '123456',
      is_active: exam.is_active !== undefined ? exam.is_active : true,
      max_questions: exam.max_questions || 0
    };
    this.data.exams.push(newExam);
    this.save();
    return newExam;
  }

  // --- App Config ---
  public getAppConfig(): LocalAppConfig[] {
    return this.data.app_config;
  }

  public saveAppConfig(updates: { key: string; value: string }[]): void {
    for (const u of updates) {
      if (!u || !u.key) continue;
      const existing = this.data.app_config.find(c => c.key === u.key);
      if (existing) {
        existing.value = String(u.value || '');
      } else {
        this.data.app_config.push({ key: u.key, value: String(u.value || '') });
      }
    }
    this.save();
  }

  // --- User Config ---
  public getUserConfig(username: string): LocalUserConfig[] {
    return this.data.user_config.filter(c => c.username === username);
  }

  public saveUserConfig(updates: any[]): void {
    for (const u of updates) {
      if (!u || !u.username || !u.key) continue;
      const idx = this.data.user_config.findIndex(c => c.username === u.username && c.key === u.key);
      if (idx >= 0) {
        this.data.user_config[idx] = { ...this.data.user_config[idx], ...u };
      } else {
        this.data.user_config.push({
          id: u.id || generateUuid(),
          username: u.username,
          key: u.key,
          value: u.value
        });
      }
    }
    this.save();
  }

  // --- Questions & Options ---
  public getQuestions(examId?: string): LocalQuestion[] {
    let list = this.data.questions;
    if (examId && examId.trim() !== '') {
      list = list.filter(q => q.exam_id === examId || q.mapel === examId || stringToUuid(q.mapel || '') === examId);
    }
    return list.map(q => ({
      ...q,
      options: this.data.options.filter(o => o.question_id === q.id)
    }));
  }

  public saveQuestion(question: any, optionsList?: any[]): void {
    const qId = question.id || generateUuid();
    const qItem: LocalQuestion = {
      id: qId,
      exam_id: question.exam_id,
      text_soal: question.text_soal || '',
      tipe_soal: question.tipe_soal || 'Pilihan Ganda',
      bobot_nilai: Number(question.bobot_nilai || question.bobot || 1),
      gambar: question.gambar,
      caption: question.caption,
      kelas: question.kelas,
      tp_id: question.tp_id,
      jenis_ujian: question.jenis_ujian,
      kode_paket: question.kode_paket,
      mapel: question.mapel
    };

    const qIdx = this.data.questions.findIndex(q => q.id === qId);
    if (qIdx >= 0) {
      this.data.questions[qIdx] = qItem;
    } else {
      this.data.questions.push(qItem);
    }

    // Replace options
    this.data.options = this.data.options.filter(o => o.question_id !== qId);
    if (optionsList && optionsList.length > 0) {
      for (const opt of optionsList) {
        this.data.options.push({
          id: opt.id || generateUuid(),
          question_id: qId,
          text_jawaban: opt.text_jawaban || '',
          is_correct: Boolean(opt.is_correct)
        });
      }
    }
    this.save();
  }

  public deleteQuestion(id: string): void {
    this.data.questions = this.data.questions.filter(q => q.id !== id);
    this.data.options = this.data.options.filter(o => o.question_id !== id);
    this.save();
  }

  public importQuestions(list: { question: any; optionsList: any[] }[]): void {
    for (const item of list) {
      if (item && item.question) {
        this.saveQuestion(item.question, item.optionsList);
      }
    }
  }

  // --- Learning Objectives ---
  public getLearningObjectives(): LocalLO[] {
    return this.data.learning_objectives;
  }

  public saveLearningObjective(lo: any): void {
    const id = lo.id || generateUuid();
    const item: LocalLO = {
      id,
      mapel: lo.mapel || '',
      materi: lo.materi || '',
      kelas: lo.kelas || '',
      text_tujuan: lo.text_tujuan || ''
    };
    const idx = this.data.learning_objectives.findIndex(l => l.id === id);
    if (idx >= 0) {
      this.data.learning_objectives[idx] = item;
    } else {
      this.data.learning_objectives.push(item);
    }
    this.save();
  }

  public deleteLearningObjective(id: string): void {
    this.data.learning_objectives = this.data.learning_objectives.filter(l => l.id !== id);
    this.save();
  }

  // --- School Schedules ---
  public getSchoolSchedules(): LocalSchedule[] {
    return this.data.school_schedules;
  }

  public saveSchoolSchedules(list: LocalSchedule[]): void {
    this.data.school_schedules = (list || []).filter(s => s && s.school);
    this.save();
  }

  // --- Student Exams & Answers ---
  public startExam(userId: string, examId: string): LocalStudentExam {
    const user = this.findUser(userId);
    const resolvedUserId = user ? user.id : userId;
    const se: LocalStudentExam = {
      id: generateUuid(),
      user_id: resolvedUserId,
      exam_id: examId,
      status: 'ongoing'
    };
    this.data.student_exams.push(se);
    this.save();
    return se;
  }

  public submitExam(userId: string, examId: string, status: 'ongoing' | 'completed', answersList: any[]): LocalStudentExam {
    const user = this.findUser(userId);
    const resolvedUserId = user ? user.id : userId;
    
    // Calculate basic score if options exist
    let totalScore = 0;
    const seId = generateUuid();
    const answersToInsert: LocalAnswer[] = [];

    if (answersList && answersList.length > 0) {
      for (const a of answersList) {
        if (typeof a.option_id === 'object' && a.option_id !== null) {
          // PGK
          for (const [optId, isSelected] of Object.entries(a.option_id)) {
            if (isSelected) {
              const opt = this.data.options.find(o => o.id === optId);
              if (opt?.is_correct) totalScore += 5;
              answersToInsert.push({
                id: generateUuid(),
                student_exam_id: seId,
                question_id: a.question_id,
                option_id: optId
              });
            }
          }
        } else if (typeof a.option_id === 'string') {
          const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(a.option_id);
          if (isUuid) {
            const opt = this.data.options.find(o => o.id === a.option_id);
            if (opt?.is_correct) totalScore += 10;
            answersToInsert.push({
              id: generateUuid(),
              student_exam_id: seId,
              question_id: a.question_id,
              option_id: a.option_id
            });
          } else {
            // Text answer / Essay
            answersToInsert.push({
              id: generateUuid(),
              student_exam_id: seId,
              question_id: a.question_id,
              option_id: null,
              answer_text: a.option_id
            });
          }
        }
      }
    }

    const se: LocalStudentExam = {
      id: seId,
      user_id: resolvedUserId,
      exam_id: examId,
      status: status || 'completed',
      nilai: totalScore,
      nilai_akhir: totalScore,
      waktu_submit: new Date().toISOString()
    };

    this.data.student_exams.push(se);
    this.data.answers.push(...answersToInsert);
    this.save();
    return se;
  }

  public getRecap(): any[] {
    return this.data.student_exams.map(se => {
      const u = this.data.users.find(user => user.id === se.user_id || user.username === se.user_id);
      const e = this.data.exams.find(exam => exam.id === se.exam_id || exam.nama_ujian === se.exam_id);
      return {
        ...se,
        users: u || null,
        exams: e || null
      };
    });
  }

  public getAnalysis(subjectUuidOrName: string): any[] {
    const seList = this.data.student_exams.filter(se => 
      se.exam_id === subjectUuidOrName || 
      se.exam_id === stringToUuid(subjectUuidOrName)
    );

    return seList.map(se => {
      const studentAnswers = this.data.answers
        .filter(a => a.student_exam_id === se.id)
        .map(a => {
          let qId = a.question_id;
          let textJawaban = a.answer_text;
          if (!textJawaban && qId && qId.includes(':::')) {
            const parts = qId.split(':::');
            qId = parts[0];
            textJawaban = parts.slice(1).join(':::');
          }
          const questionObj = this.data.questions.find(q => q.id === qId);
          return {
            ...a,
            question_id: qId,
            answer_text: textJawaban,
            questions: questionObj || null
          };
        });

      return {
        ...se,
        answers: studentAnswers
      };
    });
  }

  public gradeEssay(studentExamId: string | undefined, userId: string | undefined, examId: string | undefined, score: number, answersScores?: any[]): void {
    if (studentExamId) {
      const se = this.data.student_exams.find(s => s.id === studentExamId);
      if (se) {
        se.nilai = score;
        se.nilai_akhir = score;
      }
    } else if (userId && examId) {
      const user = this.findUser(userId);
      const resolvedUserId = user ? user.id : userId;
      const seList = this.data.student_exams.filter(s => 
        (s.user_id === resolvedUserId || s.user_id === userId) && 
        (s.exam_id === examId || s.exam_id === stringToUuid(examId))
      );
      for (const se of seList) {
        se.nilai = score;
        se.nilai_akhir = score;
      }
    }

    if (userId && examId) {
      this.saveExternalGrades([{
        username: userId,
        mapel: examId,
        exam_type: 'Sumatif Akhir Semester',
        nilai: score
      }]);
    }

    if (answersScores && Array.isArray(answersScores)) {
      for (const ans of answersScores) {
        if (ans.id) {
          const target = this.data.answers.find(a => a.id === ans.id);
          if (target) {
            target.score = ans.score;
            target.feedback = ans.feedback;
          }
        }
      }
    }
    this.save();
  }

  // --- External Grades ---
  public getExternalGrades(): LocalExternalGrade[] {
    return this.data.external_grades;
  }

  public saveExternalGrades(list: any[]): void {
    for (const item of list) {
      if (!item || !item.username) continue;
      const idx = this.data.external_grades.findIndex(g => g.username === item.username && g.mapel === item.mapel && g.exam_type === item.exam_type);
      if (idx >= 0) {
        this.data.external_grades[idx] = { ...this.data.external_grades[idx], ...item };
      } else {
        this.data.external_grades.push({
          id: item.id || generateUuid(),
          username: item.username,
          mapel: item.mapel,
          exam_type: item.exam_type,
          nilai: Number(item.nilai || 0)
        });
      }
    }
    this.save();
  }

  // --- LCC ---
  public getLccTeams(): any[] {
    return this.data.lcc_teams;
  }

  public saveLccTeams(teams: any[]): void {
    this.data.lcc_teams = teams || [];
    this.save();
  }

  public deleteLccTeam(id: string): void {
    this.data.lcc_teams = this.data.lcc_teams.filter(t => t.id !== id);
    this.save();
  }

  public getLccQuestions(): any[] {
    return this.data.lcc_questions;
  }

  public saveLccQuestion(q: any): void {
    const id = q.id || generateUuid();
    const idx = this.data.lcc_questions.findIndex(item => item.id === id);
    if (idx >= 0) {
      this.data.lcc_questions[idx] = { ...q, id };
    } else {
      this.data.lcc_questions.push({ ...q, id });
    }
    this.save();
  }

  public saveLccQuestionsBatch(list: any[]): void {
    this.data.lcc_questions = list || [];
    this.save();
  }

  public deleteLccQuestion(id: string): void {
    this.data.lcc_questions = this.data.lcc_questions.filter(q => q.id !== id);
    this.save();
  }

  public getLccConfig(): any {
    return this.data.lcc_config;
  }

  public saveLccConfig(config: any): void {
    this.data.lcc_config = config;
    this.save();
  }

  public getLccHistory(): any[] {
    return this.data.lcc_history;
  }

  public saveLccHistory(history: any[]): void {
    this.data.lcc_history = history || [];
    this.save();
  }
}

export const localStore = new LocalStoreManager();
