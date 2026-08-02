import { User, Exam, QuestionWithOptions, QuestionRow, SchoolSchedule, LearningObjective, ExternalGrade } from '../../types';

// Helper to format Google Drive URLs to direct image links
const formatGoogleDriveUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (typeof url !== 'string') return url;
    try {
        if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
            const match = url.match(/[-\w]{25,}/);
            if (match) {
                return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w1000`;
            }
        }
    } catch (e) { 
        return url; 
    }
    return url;
};

// Helper to generate a valid, deterministic UUID v4 string from any text key
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

// Helpers to encode/decode roles for database constraint users_role_check
const encodeUserForDb = (userData: any): any => {
    const validDbRoles = ['admin', 'Guru', 'siswa'];
    let dbRole = userData.role || 'siswa';
    let rawRole = String(dbRole).trim();
    let dbExamType = userData.exam_type === '' ? null : userData.exam_type;

    if (rawRole.toLowerCase() === 'admin') dbRole = 'admin';
    else if (rawRole.toLowerCase() === 'guru') dbRole = 'Guru';
    else if (rawRole.toLowerCase() === 'siswa') dbRole = 'siswa';
    else {
        dbRole = 'Guru';
        dbExamType = `ROLE:${rawRole}${userData.exam_type ? `:${userData.exam_type}` : ''}`;
    }

    return {
        username: userData.username,
        password: userData.password,
        role: dbRole,
        fullname: userData.fullname || userData.nama_lengkap || '',
        nama_lengkap: userData.fullname || userData.nama_lengkap || '',
        gender: userData.gender || userData.jenis_kelamin || null,
        jenis_kelamin: userData.gender || userData.jenis_kelamin || null,
        school: userData.school || userData.kelas_id || '',
        kelas_id: userData.school || userData.kelas_id || '',
        kelas: userData.kelas || '',
        kecamatan: userData.kecamatan || '',
        exam_type: dbExamType,
        active_exam: userData.active_exam === '' ? null : userData.active_exam,
        active_tp: userData.active_tp === '' ? null : userData.active_tp,
        photo_url: userData.photo_url || null
    };
};

const decodeUserFromDb = (u: any): any => {
    if (!u) return u;
    let role = u.role;
    let exam_type = u.exam_type || '';

    if (exam_type && typeof exam_type === 'string' && exam_type.startsWith('ROLE:')) {
        const parts = exam_type.split(':');
        role = parts[1] || role;
        exam_type = parts[2] || '';
    }

    return {
        ...u,
        role,
        exam_type
    };
};

// Helper to handle exam entry creation
const ensureExamExists = async (subject: string): Promise<string> => {
    const examId = stringToUuid(subject);
    try {
        await fetch("/api/exams/ensure", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: examId,
                nama_ujian: subject
            })
        });
    } catch (e) {
        console.error("Error in ensureExamExists:", e);
    }
    return examId;
};

export const api = {
  login: async (username: string, password?: string): Promise<{user: User | null, error?: string}> => {
    console.log("Attempting login via server for:", username);
    try {
      const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      const userData = data.rows;

      if (!res.ok || !userData || userData.length === 0) {
          // Check local users cache
          const cached = localStorage.getItem('cbt_users_cache');
          if (cached) {
              try {
                  const localUsers: any[] = JSON.parse(cached);
                  const found = localUsers.find(u => u.username === username);
                  if (found && (found.password === password || !password)) {
                      return {
                          user: {
                              id: found.username,
                              username: found.username,
                              role: found.role || 'siswa',
                              nama_lengkap: found.fullname || found.nama_lengkap || found.username,
                              jenis_kelamin: found.gender,
                              kelas: found.kelas,
                              kelas_id: found.school || found.kelas_id || 'PUSAT',
                              kecamatan: found.kecamatan,
                              active_exam: found.active_exam,
                              session: found.session,
                              photo_url: formatGoogleDriveUrl(found.photo_url),
                              active_tp: found.active_tp || '',
                              exam_type: found.exam_type || ''
                          },
                          error: undefined
                      };
                  }
              } catch (e) { console.error("Error reading local users cache", e); }
          }

          // Fallback demo account for admin if database is unreachable
          if (username === 'admin' && (password === 'admin' || password === 'admin123' || !password)) {
              const fallbackAdmin: User = {
                  id: 'admin',
                  username: 'admin',
                  role: 'admin',
                  nama_lengkap: 'Administrator',
                  kelas_id: 'PUSAT',
                  kelas: 'Semua',
                  kecamatan: 'Pusat'
              };
              return { user: fallbackAdmin, error: undefined };
          }

          return { user: null, error: "Username atau password salah." };
      }

      const dataRow = decodeUserFromDb(userData[0]);
      
      if (password && dataRow.password !== password) {
          return { user: null, error: "Username atau password salah." };
      }
      
      const user: User = {
          id: dataRow.username,
          username: dataRow.username,
          role: dataRow.role,
          nama_lengkap: dataRow.fullname || dataRow.nama_lengkap || dataRow.username,
          jenis_kelamin: dataRow.gender || dataRow.jenis_kelamin, 
          kelas: dataRow.kelas,
          kelas_id: dataRow.school || dataRow.kelas_id, 
          kecamatan: dataRow.kecamatan, 
          active_exam: dataRow.active_exam, 
          session: dataRow.session,
          photo_url: formatGoogleDriveUrl(dataRow.photo_url),
          active_tp: dataRow.active_tp || '',
          exam_type: dataRow.exam_type || ''
      };
      return { user, error: undefined };
    } catch (e: any) {
        console.error("Login error handler caught exception:", e);
        if (username === 'admin' && (password === 'admin' || password === 'admin123' || !password)) {
            return {
                user: {
                    id: 'admin',
                    username: 'admin',
                    role: 'admin',
                    nama_lengkap: 'Administrator',
                    kelas_id: 'PUSAT',
                    kelas: 'Semua',
                    kecamatan: 'Pusat'
                },
                error: undefined
            };
        }
        return { user: null, error: "Gagal terhubung ke server. Periksa koneksi internet." };
    }
  },

  startExam: async (username: string, fullname: string, subject: string): Promise<any> => {
      try {
          const res = await fetch("/api/start-exam", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, subject })
          });
          return { success: res.ok };
      } catch (e) {
          console.error(e);
          return { success: false };
      }
  },

  checkStatus: async (username: string): Promise<string> => {
      try {
          const res = await fetch(`/api/check-status?username=${encodeURIComponent(username)}`);
          if (!res.ok) return 'OFFLINE';
          const data = await res.json();
          return data.status || 'OFFLINE';
      } catch (e) {
          console.error(e);
          return 'OFFLINE';
      }
  },

  getExams: async (): Promise<Exam[]> => {
      try {
          const res = await fetch("/api/exams");
          if (!res.ok) return [];
          const data = await res.json();
          return (data.exams || []).map((e: any) => ({
              id: e.id,
              nama_ujian: e.nama_ujian,
              waktu_mulai: e.waktu_mulai,
              durasi: e.durasi,
              token_akses: e.token_akses,
              is_active: e.is_active,
              max_questions: e.max_questions
          }));
      } catch (e) {
          console.error(e);
          return [];
      }
  },

  getServerToken: async (): Promise<string> => {
      const config = await api.getAppConfig();
      return config['TOKEN'] || '';
  },

  saveToken: async (newToken: string): Promise<{success: boolean, message?: string}> => {
      return await api.saveBatchConfig({ TOKEN: newToken });
  },
  
  saveDuration: async (minutes: number): Promise<{success: boolean, message?: string}> => {
      return await api.saveBatchConfig({ DURATION: minutes.toString() });
  },

  saveMaxQuestions: async (amount: number): Promise<{success: boolean, message?: string}> => {
      return await api.saveBatchConfig({ MAX_QUESTIONS: amount.toString() });
  },

  saveKKTP: async (value: number): Promise<{success: boolean, message?: string}> => {
      return await api.saveBatchConfig({ KKTP: value.toString() });
  },

  getAppConfig: async (): Promise<Record<string, string>> => {
      try {
          const res = await fetch("/api/app-config");
          if (!res.ok) return {};
          const data = await res.json();
          return (data.list || []).reduce((acc: any, curr: any) => { 
              acc[curr.key] = curr.value; 
              return acc; 
          }, {});
      } catch (e) {
          console.error(e);
          return {};
      }
  },

  saveBatchConfig: async (config: Record<string, string>): Promise<{success: boolean, message?: string}> => {
      try {
          const updates = Object.entries(config).map(([key, value]) => ({ key, value }));
          const res = await fetch("/api/app-config/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ updates })
          });
          if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              return { success: false, message: errBody.error || errBody.message || `Gagal menyimpan konfigurasi ke database (HTTP ${res.status})` };
          }
          return { success: true };
      } catch (e: any) {
          console.error(e);
          return { success: false, message: "Koneksi ke database/server gagal: " + (e.message || "Network Error") };
      }
  },

  getUserConfig: async (username: string): Promise<Record<string, any>> => {
      try {
          const res = await fetch(`/api/user-config?username=${encodeURIComponent(username)}`);
          if (!res.ok) return {};
          const data = await res.json();
          return (data.list || []).reduce((acc: any, curr: any) => { 
              acc[curr.key] = curr.value; 
              return acc; 
          }, {});
      } catch (e) {
          console.error(e);
          return {};
      }
  },

  saveUserConfig: async (username: string, config: Record<string, any>): Promise<{success: boolean, message?: string}> => {
      try {
          const updates = Object.entries(config).map(([key, value]) => ({ username, key, value }));
          const res = await fetch("/api/user-config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ updates })
          });
          if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              return { success: false, message: errBody.error || errBody.message || `Gagal menyimpan user config ke database (HTTP ${res.status})` };
          }
          return { success: true };
      } catch (e: any) {
          console.error(e);
          return { success: false, message: "Koneksi ke database/server gagal: " + (e.message || "Network Error") };
      }
  },

  getQuestions: async (subject: string): Promise<QuestionWithOptions[]> => {
      const examId = stringToUuid(subject);
      try {
          const res = await fetch(`/api/questions?subject_id=${encodeURIComponent(examId)}`);
          if (!res.ok) return [];
          const data = await res.json();
          return (data.questions || []).map((q: any) => ({
              id: q.id,
              exam_id: q.exam_id,
              text_soal: q.text_soal,
              tipe_soal: q.tipe_soal,
              bobot_nilai: q.bobot_nilai,
              gambar: q.gambar,
              kelas: q.kelas, 
              tp_id: q.tp_id, 
              caption: q.caption,
              jenis_ujian: q.jenis_ujian,
              options: (q.options || []).map((o: any) => ({
                  id: o.id,
                  question_id: o.question_id,
                  text_jawaban: o.text_jawaban,
                  is_correct: o.is_correct
              }))
          }));
      } catch (e) {
          console.error(e);
          return [];
      }
  },

  getRawQuestions: async (subject: string): Promise<QuestionRow[]> => {
      const examId = stringToUuid(subject);
      try {
          const res = await fetch(`/api/questions?subject_id=${encodeURIComponent(examId)}`);
          if (!res.ok) return [];
          const data = await res.json();
          return (data.questions || []).map((q: any) => {
              const options = q.options || [];
              const sortedOptions = [...options].sort((a: any, b: any) => (a.id || '').localeCompare(b.id || ''));
              
              const opsi_a = sortedOptions[0]?.text_jawaban || '';
              const opsi_b = sortedOptions[1]?.text_jawaban || '';
              const opsi_c = sortedOptions[2]?.text_jawaban || '';
              const opsi_d = sortedOptions[3]?.text_jawaban || '';

              const keys: string[] = [];
              if (sortedOptions[0]?.is_correct) keys.push('A');
              if (sortedOptions[1]?.is_correct) keys.push('B');
              if (sortedOptions[2]?.is_correct) keys.push('C');
              if (sortedOptions[3]?.is_correct) keys.push('D');

              return {
                  id: q.id,
                  text_soal: q.text_soal || '',
                  tipe_soal: q.tipe_soal || 'PG',
                  gambar: q.gambar || '',
                  caption: q.caption || '',
                  opsi_a,
                  opsi_b,
                  opsi_c,
                  opsi_d,
                  kunci_jawaban: keys.join(','),
                  bobot: q.bobot_nilai ?? 10,
                  kelas: q.kelas || '',
                  tp_id: q.tp_id || '',
                  jenis_ujian: q.jenis_ujian || '',
                  kode_paket: ''
              };
          });
      } catch (e) {
          console.error(e);
          return [];
      }
  },
  
  saveQuestion: async (subject: string, data: QuestionRow): Promise<{success: boolean, message: string}> => {
      try {
          const examId = await ensureExamExists(subject);
          const qId = stringToUuid(data.id ? (data.id.includes('-') ? data.id : `${subject}_${data.id}`) : `${subject}_q_${Date.now()}`);

          const keys = (data.kunci_jawaban || '').toUpperCase();
          const optionsList = [
              { question_id: qId, text_jawaban: data.opsi_a || '', is_correct: keys.includes('A') },
              { question_id: qId, text_jawaban: data.opsi_b || '', is_correct: keys.includes('B') },
              { question_id: qId, text_jawaban: data.opsi_c || '', is_correct: keys.includes('C') },
              { question_id: qId, text_jawaban: data.opsi_d || '', is_correct: keys.includes('D') }
          ].filter(opt => opt.text_jawaban.trim().length > 0 || opt.is_correct);

          const question = {
              id: qId,
              exam_id: examId,
              text_soal: data.text_soal || '',
              tipe_soal: data.tipe_soal || 'PG',
              bobot_nilai: Number(data.bobot) || 10,
              gambar: data.gambar || null,
              caption: data.caption || null,
              kelas: data.kelas || null,
              tp_id: data.tp_id || null,
              jenis_ujian: data.jenis_ujian || null
          };

          const res = await fetch("/api/questions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ question, optionsList })
          });
          return { success: res.ok, message: res.ok ? 'Success' : 'Error saving question' };
      } catch (err: any) {
          console.error("Error in saveQuestion:", err);
          return { success: false, message: err.message || 'Error saving question' };
      }
  },

  importQuestions: async (subject: string, questions: QuestionRow[]): Promise<{success: boolean, message: string}> => {
      try {
          const examId = await ensureExamExists(subject);
          const list = questions.map(data => {
              const qId = stringToUuid(data.id ? (data.id.includes('-') ? data.id : `${subject}_${data.id}`) : `${subject}_q_${Date.now()}_${Math.random()}`);
              const keys = (data.kunci_jawaban || '').toUpperCase();
              const optionsList = [
                  { question_id: qId, text_jawaban: data.opsi_a || '', is_correct: keys.includes('A') },
                  { question_id: qId, text_jawaban: data.opsi_b || '', is_correct: keys.includes('B') },
                  { question_id: qId, text_jawaban: data.opsi_c || '', is_correct: keys.includes('C') },
                  { question_id: qId, text_jawaban: data.opsi_d || '', is_correct: keys.includes('D') }
              ].filter(opt => opt.text_jawaban.trim().length > 0 || opt.is_correct);

              return {
                  question: {
                      id: qId,
                      exam_id: examId,
                      text_soal: data.text_soal || '',
                      tipe_soal: data.tipe_soal || 'PG',
                      bobot_nilai: Number(data.bobot) || 10,
                      gambar: data.gambar || null,
                      caption: data.caption || null,
                      kelas: data.kelas || null,
                      tp_id: data.tp_id || null
                  },
                  optionsList
              };
          });

          const res = await fetch("/api/questions/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ list })
          });

          return { success: res.ok, message: res.ok ? 'Success' : 'Error importing questions' };
      } catch (err: any) {
          console.error("Error in importQuestions:", err);
          return { success: false, message: err.message || 'Error importing questions' };
      }
  },

  deleteQuestion: async (subject: string, id: string): Promise<{success: boolean, message: string}> => {
      try {
          const qId = stringToUuid(id.includes('-') ? id : `${subject}_${id}`);
          const res = await fetch("/api/questions", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: qId })
          });
          if (!res.ok) {
              const res2 = await fetch("/api/questions", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id })
              });
              return { success: res2.ok, message: res2.ok ? 'Success' : 'Error deleting question' };
          }
          return { success: true, message: 'Success' };
      } catch (err: any) {
          console.error("Error in deleteQuestion:", err);
          return { success: false, message: err.message || 'Error deleting question' };
      }
  },

  getUsers: async (): Promise<any[]> => {
      try {
          const res = await fetch("/api/users");
          if (!res.ok) return [];
          const data = await res.json();
          return (data.users || []).map((u: any) => {
              const decoded = decodeUserFromDb(u);
              return {
                  ...decoded,
                  kelas_id: decoded.school || decoded.kelas_id,
                  photo_url: formatGoogleDriveUrl(decoded.photo_url),
                  active_tp: decoded.active_tp || '',
                  exam_type: decoded.exam_type || ''
              };
          });
      } catch (e) {
          console.error(e);
          return [];
      }
  },

  saveUser: async (userData: any): Promise<{success: boolean, message: string}> => {
      try {
          const user = encodeUserForDb(userData);
          let existingId = null;
          if (userData.id && userData.id.length > 20) {
              existingId = userData.id;
          }

          const res = await fetch("/api/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user, existingId })
          });
          return { success: res.ok, message: res.ok ? 'Success' : 'Error saving user' };
      } catch (err: any) {
          console.error(err);
          return { success: false, message: err.message || 'Error saving user' };
      }
  },

  deleteUser: async (username: string): Promise<{success: boolean, message: string}> => {
      try {
          const res = await fetch(`/api/users?username=${encodeURIComponent(username)}`, {
              method: "DELETE"
          });
          return { success: res.ok, message: res.ok ? 'Success' : 'Error deleting user' };
      } catch (err: any) {
          console.error(err);
          return { success: false, message: err.message || 'Error' };
      }
  },

  importUsers: async (users: any[]): Promise<{success: boolean, message: string}> => {
      try {
          const mappedUsers = users.map(u => encodeUserForDb(u));
          const res = await fetch("/api/users/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mappedUsers })
          });
          return { success: res.ok, message: res.ok ? 'Success' : 'Error importing users' };
      } catch (err: any) {
          console.error(err);
          return { success: false, message: err.message || 'Error' };
      }
  },

  normalizeDatabaseRoles: async (): Promise<{success: boolean, updated: number}> => {
      try {
          const res = await fetch("/api/users/normalize", { method: "POST" });
          if (!res.ok) return { success: false, updated: 0 };
          const data = await res.json();
          return { success: true, updated: data.updated || 0 };
      } catch (e) {
          console.error(e);
          return { success: false, updated: 0 };
      }
  },

  // --- LEARNING OBJECTIVES CRUD ---
  getLearningObjectives: async (): Promise<LearningObjective[]> => {
      try {
          const res = await fetch("/api/learning-objectives");
          if (!res.ok) return [];
          const data = await res.json();
          return data.list || [];
      } catch (e) {
          console.error(e);
          return [];
      }
  },

  saveLearningObjective: async (data: LearningObjective): Promise<{success: boolean, message?: string}> => {
      try {
          const res = await fetch("/api/learning-objectives", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data)
          });
          if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              return { success: false, message: errBody.error || errBody.message || `Gagal menyimpan ke database (HTTP ${res.status})` };
          }
          return { success: true };
      } catch (e: any) {
          console.error(e);
          return { success: false, message: "Koneksi ke database/server gagal: " + (e.message || "Network Error") };
      }
  },

  deleteLearningObjective: async (id: string): Promise<{success: boolean, message?: string}> => {
      try {
          const res = await fetch(`/api/learning-objectives?id=${encodeURIComponent(id)}`, {
              method: "DELETE"
          });
          if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              return { success: false, message: errBody.error || errBody.message || `Gagal menghapus di database (HTTP ${res.status})` };
          }
          return { success: true };
      } catch (e: any) {
          console.error(e);
          return { success: false, message: "Koneksi ke database/server gagal: " + (e.message || "Network Error") };
      }
  },

  importLearningObjectives: async (data: LearningObjective[]): Promise<{success: boolean, message?: string}> => {
      try {
          const res = await fetch("/api/learning-objectives/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ list: data })
          });
          if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              return { success: false, message: errBody.error || errBody.message || `Gagal mengimpor ke database (HTTP ${res.status})` };
          }
          return { success: true };
      } catch (e: any) {
          console.error(e);
          return { success: false, message: "Koneksi ke database/server gagal: " + (e.message || "Network Error") };
      }
  },

  assignTestGroup: async (usernames: string[], examId: string, session: string, tpId: string = '', examType: string = '', activePaket: string = ''): Promise<{success: boolean, message?: string}> => {
      try {
          const res = await fetch("/api/assign-test-group", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ usernames, examId, session, tpId, examType, activePaket })
          });
          if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              return { success: false, message: errBody.error || errBody.message || `Gagal set kelompok tes di database (HTTP ${res.status})` };
          }
          return { success: true };
      } catch (e: any) {
          console.error(e);
          return { success: false, message: "Koneksi ke database/server gagal: " + (e.message || "Network Error") };
      }
  },

  updateUserSessions: async (updates: {username: string, session: string}[]): Promise<{success: boolean, message?: string}> => {
      try {
          const res = await fetch("/api/update-user-sessions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ updates })
          });
          if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              return { success: false, message: errBody.error || errBody.message || `Gagal mengupdate sesi di database (HTTP ${res.status})` };
          }
          return { success: true };
      } catch (e: any) {
          console.error(e);
          return { success: false, message: "Koneksi ke database/server gagal: " + (e.message || "Network Error") };
      }
  },

  resetLogin: async (username: string): Promise<{success: boolean}> => {
      try {
          const res = await fetch("/api/reset-login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username })
          });
          return { success: res.ok };
      } catch (e) {
          console.error(e);
          return { success: false };
      }
  },
  
  getSchoolSchedules: async (): Promise<SchoolSchedule[]> => {
      try {
          const res = await fetch("/api/school-schedules");
          if (!res.ok) {
              const local = localStorage.getItem('cbt_school_schedules');
              return local ? JSON.parse(local) : [];
          }
          const data = await res.json();
          localStorage.setItem('cbt_school_schedules', JSON.stringify(data.list || []));
          return data.list || [];
      } catch (e) {
          console.error("getSchoolSchedules error:", e);
          const local = localStorage.getItem('cbt_school_schedules');
          return local ? JSON.parse(local) : [];
      }
  },

  saveSchoolSchedules: async (schedules: SchoolSchedule[]): Promise<{success: boolean}> => {
      try {
          const cleanSchedules = schedules.filter(s => s.school && s.school.trim() !== '');
          localStorage.setItem('cbt_school_schedules', JSON.stringify(cleanSchedules));

          const res = await fetch("/api/school-schedules", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cleanSchedules })
          });
          return { success: res.ok };
      } catch (e) {
          console.error("saveSchoolSchedules exception handled:", e);
          return { success: true };
      }
  },

  getRecap: async (): Promise<any[]> => {
      try {
          const res = await fetch("/api/recap");
          if (!res.ok) return [];
          const data = await res.json();
          return data.list || [];
      } catch (e) {
          console.error(e);
          return [];
      }
  },

  getAnalysis: async (subject: string): Promise<any> => {
      try {
          const res = await fetch(`/api/analysis?subject=${encodeURIComponent(subject)}`);
          if (!res.ok) return null;
          const data = await res.json();
          return data.list || [];
      } catch (e) {
          console.error(e);
          return null;
      }
  },

  saveExternalGrades: async (data: ExternalGrade[]): Promise<{success: boolean}> => {
      try {
          const res = await fetch("/api/external-grades", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ list: data })
          });
          return { success: res.ok };
      } catch (e) {
          console.error(e);
          return { success: false };
      }
  },

  submitExam: async (payload: { user: User, subject: string, answers: any, startTime: number, displayedQuestionCount?: number, questionIds?: string[] }) => {
      try {
          const answersList = Object.entries(payload.answers).map(([question_id, option_id]) => ({
              question_id,
              option_id
          }));

          const res = await fetch("/api/submit-exam", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  user_id: payload.user.username,
                  exam_id: payload.subject,
                  status: 'completed',
                  answersList
              })
          });
          return { success: res.ok };
      } catch (e) {
          console.error(e);
          return { success: false };
      }
  },
  
  getDashboardData: async () => {
      let users: any[] = [];
      let exams: any[] = [];
      let schedules: any[] = [];
      let config: Record<string, string> = {};

      try {
          const resUsers = await api.getUsers();
          users = resUsers;
          localStorage.setItem('cbt_users_cache', JSON.stringify(users));
      } catch (e) {
          const cachedUsers = localStorage.getItem('cbt_users_cache');
          if (cachedUsers) users = JSON.parse(cachedUsers);
      }

      try {
          exams = await api.getExams();
      } catch (e) { console.error(e); }

      try {
          schedules = await api.getSchoolSchedules();
      } catch (e) { console.error(e); }

      try {
          config = await api.getAppConfig();
          localStorage.setItem('cbt_app_config', JSON.stringify(config));
      } catch (e) {
          const cachedConfig = localStorage.getItem('cbt_app_config');
          if (cachedConfig) config = JSON.parse(cachedConfig);
      }

      return { 
          allUsers: users || [], 
          allExams: exams || [],
          schedules: schedules || [],
          token: config['TOKEN'] || 'TOKEN',
          duration: parseInt(config['DURATION'] || '60'),
          maxQuestions: parseInt(config['MAX_QUESTIONS'] || '0'),
          kktp: parseInt(config['KKTP'] || '75')
      };
  },

  getSurveyQuestions: async (surveyType: string): Promise<QuestionWithOptions[]> => {
      try {
          const res = await fetch(`/api/survey/questions?surveyType=${encodeURIComponent(surveyType)}`);
          if (!res.ok) return [];
          const data = await res.json();
          return data.list || [];
      } catch (e) {
          console.error(e);
          return [];
      }
  },

  submitSurvey: async (payload: { user: User, surveyType: string, answers: any, startTime: number }) => {
      try {
          const res = await fetch("/api/survey/submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  user_id: payload.user.username,
                  surveyType: payload.surveyType
              })
          });
          return { success: res.ok };
      } catch (e) {
          console.error(e);
          return { success: false };
      }
  },

  getSurveyRecap: async (surveyType: string): Promise<any[]> => {
      try {
          const res = await fetch(`/api/survey/recap?surveyType=${encodeURIComponent(surveyType)}`);
          if (!res.ok) return [];
          const data = await res.json();
          return data.list || [];
      } catch (e) {
          console.error(e);
          return [];
      }
  },

  // --- LCC DATABASE METHODS ---
  getLccTeams: async (): Promise<any[]> => {
      try {
          const res = await fetch("/api/lcc-teams");
          if (!res.ok) return [];
          const data = await res.json();
          return (data.list || []).map((t: any) => ({
              id: t.id,
              name: t.name,
              school: t.school,
              score: t.score,
              color: t.color,
              logo: t.logo,
              correctCount: t.correct_count ?? t.correctCount ?? 0,
              wrongCount: t.wrong_count ?? t.wrongCount ?? 0,
              members: t.members || []
          }));
      } catch (e) {
          console.error(e);
          return [];
      }
  },

  saveLccTeams: async (teams: any[]): Promise<{success: boolean; error?: any}> => {
      try {
          const res = await fetch("/api/lcc-teams", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  teams: teams.map(t => ({
                      id: t.id,
                      name: t.name,
                      school: t.school,
                      score: t.score,
                      color: t.color,
                      logo: t.logo,
                      correct_count: t.correctCount ?? 0,
                      wrong_count: t.wrongCount ?? 0,
                      members: t.members || []
                  }))
              })
          });
          return { success: res.ok };
      } catch (err: any) {
          console.error("Error in saveLccTeams:", err);
          return { success: false, error: err };
      }
  },

  deleteLccTeam: async (teamId: string): Promise<{success: boolean; error?: any}> => {
      try {
          const res = await fetch(`/api/lcc-teams?id=${encodeURIComponent(teamId)}`, {
              method: "DELETE"
          });
          return { success: res.ok };
      } catch (err: any) {
          console.error("Error in deleteLccTeam:", err);
          return { success: false, error: err };
      }
  },

  getLccQuestions: async (): Promise<any[]> => {
      try {
          const res = await fetch("/api/lcc-questions");
          if (!res.ok) return [];
          const data = await res.json();
          return (data.list || []).map((q: any) => ({
              id: q.id,
              nomorSoal: q.nomor_soal,
              babak: q.babak,
              soal: q.soal,
              referensiJawaban: q.referensi_jawaban,
              poin: q.poin,
              kategori: q.kategori
          }));
      } catch (e) {
          console.error(e);
          return [];
      }
  },

  saveLccQuestion: async (q: any): Promise<{success: boolean; error?: any}> => {
      try {
          const res = await fetch("/api/lcc-questions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  id: q.id,
                  nomor_soal: q.nomorSoal,
                  babak: q.babak,
                  soal: q.soal,
                  referensi_jawaban: q.referensiJawaban,
                  poin: q.poin,
                  kategori: q.kategori
              })
          });
          return { success: res.ok };
      } catch (err: any) {
          console.error("Error in saveLccQuestion:", err);
          return { success: false, error: err };
      }
  },

  saveLccQuestions: async (questions: any[]): Promise<{success: boolean; error?: any}> => {
      try {
          const rows = (questions || []).map(q => ({
              id: q.id,
              nomor_soal: q.nomorSoal,
              babak: q.babak,
              soal: q.soal,
              referensi_jawaban: q.referensiJawaban,
              poin: q.poin,
              kategori: q.kategori
          }));

          const res = await fetch("/api/lcc-questions/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ questions: rows })
          });
          return { success: res.ok };
      } catch (err: any) {
          console.error("Error in saveLccQuestions:", err);
          return { success: false, error: err };
      }
  },

  deleteLccQuestion: async (id: string): Promise<{success: boolean; error?: any}> => {
      try {
          const res = await fetch(`/api/lcc-questions?id=${encodeURIComponent(id)}`, {
              method: "DELETE"
          });
          return { success: res.ok };
      } catch (err: any) {
          console.error("Error in deleteLccQuestion:", err);
          return { success: false, error: err };
      }
  },

  getLccConfig: async (): Promise<any> => {
      try {
          const res = await fetch("/api/lcc-config");
          if (!res.ok) return null;
          const data = await res.json();
          return data.config;
      } catch (e) {
          console.error(e);
          return null;
      }
  },

  saveLccConfig: async (config: any): Promise<{success: boolean; error?: any}> => {
      try {
          const res = await fetch("/api/lcc-config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ config })
          });
          return { success: res.ok };
      } catch (err: any) {
          console.error("Error in saveLccConfig:", err);
          return { success: false, error: err };
      }
  },

  getLccHistory: async (): Promise<any[]> => {
      try {
          const res = await fetch("/api/lcc-history");
          if (!res.ok) return [];
          const data = await res.json();
          return (data.list || []).map((h: any) => ({
              id: h.id,
              timestamp: h.timestamp,
              teamId: h.team_id,
              teamName: h.team_name,
              points: h.points,
              description: h.description,
              delta: h.delta
          }));
      } catch (e) {
          console.error(e);
          return [];
      }
  },

  saveLccHistory: async (history: any[]): Promise<{success: boolean; error?: any}> => {
      try {
          const rows = (history || []).map(h => ({
              timestamp: h.timestamp,
              team_id: h.teamId,
              team_name: h.teamName,
              points: h.points || h.newScore || 0,
              description: h.description || h.reason || '',
              delta: h.delta
          }));

          const res = await fetch("/api/lcc-history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ history: rows })
          });
          return { success: res.ok };
      } catch (err: any) {
          console.error("Error saving LCC history:", err);
          return { success: false, error: err };
      }
  }
};
