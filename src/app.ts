import express from "express";
import { db, createPool } from "./db/index";
import { initDbTables } from "./db/init";
import { 
  users, 
  exams, 
  questions, 
  options, 
  studentExams, 
  answers, 
  schoolSchedules, 
  appConfig, 
  userConfig, 
  learningObjectives, 
  externalGrades, 
  lccTeams, 
  lccQuestions, 
  lccConfig, 
  lccHistory 
} from "./db/schema";
import { eq, and, inArray, ne, desc, asc } from "drizzle-orm";

export const app = express();

app.use(express.json({ limit: "50mb" }));

// Lazy DB Table Initializer (Prevents lambda cold-start blocking)
let dbTablesInitialized = false;
let dbInitPromise: Promise<any> | null = null;

// Ensure DB tables lazily when needed without dangling un-awaited background promises in Express middleware
async function ensureDbTables() {
  let hasEnv = false;
  if (process.env.DATABASE_URL) {
    const url = process.env.DATABASE_URL.trim().replace(/^["'<]+|["'>]+$/g, '');
    if (url && url !== '""' && url !== "''") {
      hasEnv = true;
    }
  }
  if (process.env.SQL_HOST) {
    const host = process.env.SQL_HOST.trim().replace(/^["'<]+|["'>]+$/g, '');
    if (host && host !== '""' && host !== "''") {
      hasEnv = true;
    }
  }

  if (!hasEnv || dbTablesInitialized) return;

  if (!dbInitPromise) {
    dbInitPromise = initDbTables()
      .then((success) => {
        if (success) {
          dbTablesInitialized = true;
        } else {
          dbInitPromise = null;
        }
      })
      .catch((e) => {
        console.error("Lazy table init failed:", e);
        dbInitPromise = null;
      });
  }
  try {
    await dbInitPromise;
  } catch (e) {
    // Ignore error to avoid blocking execution
  }
}

// Global safety handler middleware for DB auto-check
app.use((req, res, next) => {
  // Only trigger table check if env exists and not initialized yet, without floating unhandled rejections
  if (!dbTablesInitialized && (process.env.DATABASE_URL || process.env.SQL_HOST)) {
    ensureDbTables().catch((err) => {
      console.warn("Auto-table init warning:", err?.message || err);
    });
  }
  next();
});

// --- API ROUTES ---

// Health & DB Connection Check Endpoint
app.get(["/api/health", "/health", "/api/health/"], async (req, res) => {
  let connectionString = process.env.DATABASE_URL?.trim() || "";
  if (connectionString) {
    connectionString = connectionString.replace(/^["'<]+|["'>]+$/g, '').trim();
  }

  const hasEnv = !!(connectionString || process.env.SQL_HOST?.trim());

  if (!hasEnv) {
    return res.status(200).json({
      status: "error",
      database: "disconnected",
      hasEnv: false,
      error: "DATABASE_URL belum diisi di Environment Variables Vercel.",
      message: "DATABASE_URL belum disetting di Vercel Dashboard. Silakan tambahkan variabel DATABASE_URL di Settings > Environment Variables di Vercel."
    });
  }

  try {
    const pool = createPool();
    // 4-second query timeout safeguard so health checks never hang or time out in Vercel
    const result = await Promise.race([
      pool.query("SELECT NOW()"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Koneksi database timeout (4 detik). Pastikan database Neon Anda aktif.")), 4000))
    ]) as any;

    return res.status(200).json({
      status: "ok",
      database: "connected",
      hasEnv: true,
      time: result.rows?.[0]?.now || new Date().toISOString()
    });
  } catch (err: any) {
    console.error("Database connection health check failed:", err?.message || err);
    return res.status(200).json({
      status: "error",
      database: "disconnected",
      hasEnv: true,
      error: err?.message || "Gagal terhubung ke database Neon / PostgreSQL",
      message: "Gagal terhubung ke database Neon: " + (err?.message || "Koneksi terputus")
    });
  }
});

// 1. Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const rows = await db.select().from(users).where(eq(users.username, username));
    res.json({ rows });
  } catch (err: any) {
    console.error("Login route failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Start Exam
app.post("/api/start-exam", async (req, res) => {
  const { username, subject } = req.body;
  try {
    await db.insert(studentExams).values({
      user_id: username,
      exam_id: subject,
      status: "ongoing"
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Start exam failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Check Status
app.get("/api/check-status", async (req, res) => {
  const username = req.query.username as string;
  try {
    const row = await db.select({ status: users.status }).from(users).where(eq(users.username, username)).limit(1);
    res.json({ status: row[0]?.status || "OFFLINE" });
  } catch (err: any) {
    console.error("Check status failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Exams
app.get("/api/exams", async (req, res) => {
  try {
    const list = await db.select().from(exams);
    res.json({ exams: list });
  } catch (err: any) {
    console.error("Get exams failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4.1. Ensure Exam Exists
app.post("/api/exams/ensure", async (req, res) => {
  const { id, nama_ujian, waktu_mulai, durasi, token_akses, is_active } = req.body;
  try {
    await db.insert(exams).values({
      id,
      nama_ujian,
      waktu_mulai: waktu_mulai || new Date().toISOString(),
      durasi: durasi || 60,
      token_akses: token_akses || "123456",
      is_active: is_active !== undefined ? is_active : true
    }).onConflictDoUpdate({
      target: exams.id,
      set: {
        nama_ujian,
        waktu_mulai: waktu_mulai || new Date().toISOString(),
        durasi: durasi || 60,
        token_akses: token_akses || "123456",
        is_active: is_active !== undefined ? is_active : true
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Ensure exam failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Get App Config
app.get("/api/app-config", async (req, res) => {
  try {
    const list = await db.select().from(appConfig);
    res.json({ list });
  } catch (err: any) {
    console.error("Get app config failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Batch / Single Save App Config
const saveAppConfigHandler = async (req: express.Request, res: express.Response) => {
  let updates = req.body.updates;
  if (!updates && req.body.key) {
    updates = [{ key: req.body.key, value: req.body.value }];
  }
  if (!Array.isArray(updates)) {
    updates = [];
  }
  try {
    for (const item of updates) {
      if (!item || !item.key) continue;
      await db.insert(appConfig).values({ key: item.key, value: item.value || "" }).onConflictDoUpdate({
        target: appConfig.key,
        set: { value: item.value || "" }
      });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Config save failed:", err);
    res.status(500).json({ error: err.message });
  }
};

app.post("/api/app-config", saveAppConfigHandler);
app.post("/api/app-config/batch", saveAppConfigHandler);

// 7. Get User Config
app.get("/api/user-config", async (req, res) => {
  const username = req.query.username as string;
  try {
    const list = await db.select().from(userConfig).where(eq(userConfig.username, username));
    res.json({ list });
  } catch (err: any) {
    console.error("Get user config failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 8. Save User Config
app.post("/api/user-config", async (req, res) => {
  const { updates } = req.body;
  try {
    for (const item of updates) {
      const existing = await db.select().from(userConfig).where(
        and(
          eq(userConfig.username, item.username),
          eq(userConfig.key, item.key)
        )
      ).limit(1);

      if (existing.length > 0) {
        await db.update(userConfig).set({ value: item.value }).where(eq(userConfig.id, existing[0].id));
      } else {
        await db.insert(userConfig).values(item);
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Save user config failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 9. Get Questions & Options
app.get("/api/questions", async (req, res) => {
  const examId = req.query.subject_id as string;
  try {
    const qList = await db.select().from(questions).where(eq(questions.exam_id, examId));
    if (qList.length === 0) {
      return res.json({ questions: [] });
    }

    const qIds = qList.map(q => q.id);
    const optList = await db.select().from(options).where(inArray(options.question_id, qIds));

    const merged = qList.map(q => ({
      ...q,
      options: optList.filter(o => o.question_id === q.id)
    }));

    res.json({ questions: merged });
  } catch (err: any) {
    console.error("Get questions failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 10. Save Question
app.post("/api/questions", async (req, res) => {
  const { question, optionsList } = req.body;
  try {
    await db.insert(questions).values(question).onConflictDoUpdate({
      target: questions.id,
      set: {
        exam_id: question.exam_id,
        text_soal: question.text_soal,
        tipe_soal: question.tipe_soal,
        bobot_nilai: question.bobot_nilai,
        gambar: question.gambar,
        caption: question.caption,
        kelas: question.kelas,
        tp_id: question.tp_id,
        jenis_ujian: question.jenis_ujian
      }
    });

    await db.delete(options).where(eq(options.question_id, question.id));

    if (optionsList && optionsList.length > 0) {
      await db.insert(options).values(optionsList);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Save question failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 11. Import Questions (Batch)
app.post("/api/questions/import", async (req, res) => {
  const { list } = req.body;
  try {
    for (const item of list) {
      await db.insert(questions).values(item.question).onConflictDoUpdate({
        target: questions.id,
        set: {
          exam_id: item.question.exam_id,
          text_soal: item.question.text_soal,
          tipe_soal: item.question.tipe_soal,
          bobot_nilai: item.question.bobot_nilai,
          gambar: item.question.gambar,
          caption: item.question.caption,
          kelas: item.question.kelas,
          tp_id: item.question.tp_id
        }
      });

      await db.delete(options).where(eq(options.question_id, item.question.id));
      if (item.optionsList && item.optionsList.length > 0) {
        await db.insert(options).values(item.optionsList);
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Import questions failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 12. Delete Question
app.delete("/api/questions", async (req, res) => {
  const { id } = req.body;
  try {
    await db.delete(options).where(eq(options.question_id, id));
    await db.delete(questions).where(eq(questions.id, id));
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete question failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 13. Get Users
app.get("/api/users", async (req, res) => {
  try {
    const list = await db.select().from(users);
    res.json({ users: list });
  } catch (err: any) {
    console.error("Get users failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 14. Save User
app.post("/api/users", async (req, res) => {
  const { user, existingId } = req.body;
  try {
    if (existingId) {
      await db.update(users).set(user).where(eq(users.id, existingId));
    } else {
      const check = await db.select().from(users).where(eq(users.username, user.username)).limit(1);
      if (check.length > 0) {
        await db.update(users).set(user).where(eq(users.id, check[0].id));
      } else {
        await db.insert(users).values(user);
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Save user failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 15. Delete User
app.delete("/api/users", async (req, res) => {
  const username = req.query.username as string;
  try {
    await db.delete(users).where(eq(users.username, username));
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete user failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 16. Import Users
app.post("/api/users/import", async (req, res) => {
  const { mappedUsers } = req.body;
  try {
    for (const u of mappedUsers) {
      await db.insert(users).values(u).onConflictDoUpdate({
        target: users.username,
        set: u
      });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Import users failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 17. Normalize Database Roles
app.post("/api/users/normalize", async (req, res) => {
  try {
    const list = await db.select({ id: users.id, role: users.role }).from(users);
    let updated = 0;
    for (const user of list) {
      const newRole = user.role === "Guru" ? "Guru" : "siswa";
      if (user.role !== newRole) {
        await db.update(users).set({ role: newRole }).where(eq(users.id, user.id));
        updated++;
      }
    }
    res.json({ success: true, updated });
  } catch (err: any) {
    console.error("Normalize failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 18. Get Learning Objectives
app.get("/api/learning-objectives", async (req, res) => {
  try {
    const list = await db.select().from(learningObjectives);
    res.json({ list });
  } catch (err: any) {
    console.error("Get LO failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 19. Save Learning Objective
app.post("/api/learning-objectives", async (req, res) => {
  const data = req.body;
  try {
    await db.insert(learningObjectives).values(data).onConflictDoUpdate({
      target: learningObjectives.id,
      set: data
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Save LO failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 20. Delete Learning Objective
app.delete("/api/learning-objectives", async (req, res) => {
  const id = req.query.id as string;
  try {
    await db.delete(learningObjectives).where(eq(learningObjectives.id, id));
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete LO failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 21. Import Learning Objectives
app.post("/api/learning-objectives/import", async (req, res) => {
  const { list } = req.body;
  try {
    for (const item of list) {
      await db.insert(learningObjectives).values(item).onConflictDoUpdate({
        target: learningObjectives.id,
        set: item
      });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Import LOs failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 22. Assign Test Group
app.post("/api/assign-test-group", async (req, res) => {
  const { usernames, examId, session, tpId, examType } = req.body;
  try {
    await db.update(users)
      .set({ active_exam: examId, session, active_tp: tpId, exam_type: examType })
      .where(inArray(users.username, usernames));
    res.json({ success: true });
  } catch (err: any) {
    console.error("Assign group failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 23. Update User Sessions
app.post("/api/update-user-sessions", async (req, res) => {
  const { updates } = req.body;
  try {
    for (const update of updates) {
      await db.update(users).set({ session: update.session }).where(eq(users.username, update.username));
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Update sessions failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 24. Reset Login
app.post("/api/reset-login", async (req, res) => {
  const { username } = req.body;
  try {
    await db.update(users).set({ status: "OFFLINE" }).where(eq(users.username, username));
    res.json({ success: true });
  } catch (err: any) {
    console.error("Reset login failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 25. Get School Schedules
app.get("/api/school-schedules", async (req, res) => {
  try {
    const list = await db.select().from(schoolSchedules);
    res.json({ list });
  } catch (err: any) {
    console.error("Get schedules failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 26. Save School Schedules
app.post("/api/school-schedules", async (req, res) => {
  const { cleanSchedules } = req.body;
  try {
    await db.delete(schoolSchedules).where(ne(schoolSchedules.school, ""));

    if (cleanSchedules && cleanSchedules.length > 0) {
      await db.insert(schoolSchedules).values(cleanSchedules);
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Save schedules failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 27. Get Recap
app.get("/api/recap", async (req, res) => {
  try {
    const seList = await db.select().from(studentExams);
    const uList = await db.select().from(users);
    const eList = await db.select().from(exams);

    const merged = seList.map(se => {
      const userRow = uList.find(u => u.username === se.user_id);
      const examRow = eList.find(e => e.id === se.exam_id);
      return {
        ...se,
        users: userRow || null,
        exams: examRow || null
      };
    });

    res.json({ list: merged });
  } catch (err: any) {
    console.error("Get recap failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 28. Get Analysis
app.get("/api/analysis", async (req, res) => {
  const subject = req.query.subject as string;
  try {
    const seList = await db.select().from(studentExams).where(eq(studentExams.exam_id, subject));
    if (seList.length === 0) {
      return res.json({ list: [] });
    }

    const seIds = seList.map(se => se.id);
    const ansList = await db.select().from(answers).where(inArray(answers.student_exam_id, seIds));
    const qList = await db.select().from(questions).where(eq(questions.exam_id, subject));

    const merged = seList.map(se => {
      const seAnswers = ansList.filter(a => a.student_exam_id === se.id).map(a => {
        const qRow = qList.find(q => q.id === a.question_id);
        return {
          ...a,
          questions: qRow || null
        };
      });

      return {
        ...se,
        answers: seAnswers
      };
    });

    res.json({ list: merged });
  } catch (err: any) {
    console.error("Get analysis failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 29. Save External Grades
app.post("/api/external-grades", async (req, res) => {
  const { list } = req.body;
  try {
    for (const item of list) {
      if (item.id) {
        await db.insert(externalGrades).values(item).onConflictDoUpdate({
          target: externalGrades.id,
          set: item
        });
      } else {
        await db.insert(externalGrades).values(item);
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Save grades failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 30. Submit Exam
app.post("/api/submit-exam", async (req, res) => {
  const { user_id, exam_id, status, answersList } = req.body;
  try {
    const inserted = await db.insert(studentExams).values({
      user_id,
      exam_id,
      status,
      waktu_submit: new Date()
    }).returning();

    const studentExam = inserted[0];

    if (answersList && answersList.length > 0) {
      const answersToInsert = answersList.map((a: any) => ({
        student_exam_id: studentExam.id,
        question_id: a.question_id,
        option_id: a.option_id
      }));
      await db.insert(answers).values(answersToInsert);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Submit exam failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 31. Get Survey Questions
app.get("/api/survey/questions", async (req, res) => {
  const surveyType = req.query.surveyType as string;
  try {
    const qList = await db.select().from(questions).where(eq(questions.exam_id, surveyType));
    if (qList.length === 0) {
      return res.json({ list: [] });
    }

    const qIds = qList.map(q => q.id);
    const optList = await db.select().from(options).where(inArray(options.question_id, qIds));

    const merged = qList.map(q => ({
      ...q,
      options: optList.filter(o => o.question_id === q.id)
    }));

    res.json({ list: merged });
  } catch (err: any) {
    console.error("Get survey questions failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 32. Submit Survey
app.post("/api/survey/submit", async (req, res) => {
  const { user_id, surveyType } = req.body;
  try {
    await db.insert(studentExams).values({
      user_id,
      exam_id: surveyType,
      status: "completed",
      waktu_submit: new Date()
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Submit survey failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 33. Get Survey Recap
app.get("/api/survey/recap", async (req, res) => {
  const surveyType = req.query.surveyType as string;
  try {
    const seList = await db.select().from(studentExams).where(eq(studentExams.exam_id, surveyType));
    if (seList.length === 0) {
      return res.json({ list: [] });
    }

    const seIds = seList.map(se => se.id);
    const ansList = await db.select().from(answers).where(inArray(answers.student_exam_id, seIds));

    const merged = seList.map(se => ({
      ...se,
      answers: ansList.filter(a => a.student_exam_id === se.id)
    }));

    res.json({ list: merged });
  } catch (err: any) {
    console.error("Get survey recap failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 34. Get LCC Teams
app.get("/api/lcc-teams", async (req, res) => {
  try {
    const list = await db.select().from(lccTeams);
    res.json({ list });
  } catch (err: any) {
    console.error("Get LCC teams failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 35. Save LCC Teams
app.post("/api/lcc-teams", async (req, res) => {
  const { teams } = req.body;
  try {
    await db.delete(lccTeams).where(ne(lccTeams.id, ""));

    if (teams && teams.length > 0) {
      await db.insert(lccTeams).values(teams);
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Save LCC teams failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 36. Delete LCC Team
app.delete("/api/lcc-teams", async (req, res) => {
  const id = req.query.id as string;
  try {
    await db.delete(lccTeams).where(eq(lccTeams.id, id));
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete LCC team failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 37. Get LCC Questions
app.get("/api/lcc-questions", async (req, res) => {
  try {
    const list = await db.select().from(lccQuestions);
    res.json({ list });
  } catch (err: any) {
    console.error("Get LCC questions failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 38. Save Single LCC Question
app.post("/api/lcc-questions", async (req, res) => {
  const q = req.body;
  try {
    await db.insert(lccQuestions).values(q).onConflictDoUpdate({
      target: lccQuestions.id,
      set: q
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Save LCC question failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 39. Save Batch LCC Questions
app.post("/api/lcc-questions/batch", async (req, res) => {
  const { questions: list } = req.body;
  try {
    await db.delete(lccQuestions).where(ne(lccQuestions.id, ""));
    if (list && list.length > 0) {
      await db.insert(lccQuestions).values(list);
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Batch LCC questions failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 40. Delete LCC Question
app.delete("/api/lcc-questions", async (req, res) => {
  const id = req.query.id as string;
  try {
    await db.delete(lccQuestions).where(eq(lccQuestions.id, id));
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete LCC question failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 41. Get LCC Config
app.get("/api/lcc-config", async (req, res) => {
  try {
    const configRow = await db.select().from(lccConfig).where(eq(lccConfig.key, "main")).limit(1);
    res.json({ config: configRow[0]?.config || null });
  } catch (err: any) {
    console.error("Get LCC config failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 42. Save LCC Config
app.post("/api/lcc-config", async (req, res) => {
  const { config } = req.body;
  try {
    await db.insert(lccConfig).values({ key: "main", config }).onConflictDoUpdate({
      target: lccConfig.key,
      set: { config }
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Save LCC config failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 43. Get LCC History
app.get("/api/lcc-history", async (req, res) => {
  try {
    const list = await db.select().from(lccHistory).orderBy(desc(lccHistory.timestamp));
    res.json({ list });
  } catch (err: any) {
    console.error("Get LCC history failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 44. Save LCC History
app.post("/api/lcc-history", async (req, res) => {
  const { history } = req.body;
  try {
    await db.delete(lccHistory).where(ne(lccHistory.id, "00000000-0000-0000-0000-000000000000"));
    if (history && history.length > 0) {
      await db.insert(lccHistory).values(history);
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Save LCC history failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Global Express Error Handling Middleware for Serverless
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global Express Error Handler caught:", err);
  if (!res.headersSent) {
    res.status(500).json({
      status: "error",
      error: err?.message || "Internal Server Error",
      message: "Terjadi kesalahan internal server."
    });
  }
});

