import express from "express";
import { getSupabaseClient } from "./lib/supabase";

export const app = express();

app.use(express.json({ limit: "50mb" }));

// Helper to execute DB queries directly via Supabase REST JS Client
async function runWithSupabaseFallback<T>(
  _dbFn: any,
  supabaseFn: (supabase: any) => Promise<T>
): Promise<T> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      return await supabaseFn(supabase);
    } catch (sbErr: any) {
      console.error("Supabase REST query error:", sbErr?.message || sbErr);
      throw sbErr;
    }
  }

  throw new Error("Supabase belum dikonfigurasi. Silakan atur SUPABASE_URL dan SUPABASE_ANON_KEY di Environment Variables.");
}

// Helper to safely upsert records into Supabase, automatically handling missing table columns in schema cache
async function safeUpsert(supabase: any, table: string, recordOrList: any, options?: any) {
  if (!recordOrList) return;
  let item = Array.isArray(recordOrList) 
    ? recordOrList.map(r => ({ ...r })) 
    : { ...recordOrList };
  
  // Strip undefined values
  if (Array.isArray(item)) {
    item.forEach(r => Object.keys(r).forEach(k => r[k] === undefined && delete r[k]));
  } else {
    Object.keys(item).forEach(k => item[k] === undefined && delete item[k]);
  }

  let { error } = await supabase.from(table).upsert(item, options);
  if (!error) return;

  let msg = String(error.message || error.details || error.hint || '');
  let retryCount = 0;

  while (error && retryCount < 5) {
    msg = String(error.message || error.details || error.hint || '');

    if (msg.includes("Could not find the") || msg.includes("column") || msg.includes("schema cache") || msg.includes("jenis_ujian")) {
      const match = msg.match(/Could not find the '([^']+)' column/i) || msg.match(/column "([^"]+)"/i) || msg.match(/Column '([^']+)'/i);
      const missingCol = match && match[1] ? match[1] : (msg.includes('jenis_ujian') ? 'jenis_ujian' : '');

      if (missingCol) {
        // Try RPC alter table if supported by Supabase setup
        try {
          const { error: rpcErr } = await supabase.rpc('exec_sql', { sql_query: `ALTER TABLE public.${table} ADD COLUMN IF NOT EXISTS ${missingCol} TEXT;` });
          if (!rpcErr) {
            let retryWithCol = await supabase.from(table).upsert(item, options);
            if (!retryWithCol.error) return;
          }
        } catch (_) {
          // ignore if rpc exec_sql is not available
        }

        // Strip the missing column from item (array or object) and retry
        if (Array.isArray(item)) {
          item.forEach(r => delete r[missingCol]);
        } else {
          delete item[missingCol];
        }

        let retry = await supabase.from(table).upsert(item, options);
        if (!retry.error) return;
        error = retry.error;
        retryCount++;
        continue;
      }
    }
    
    // Fallback for known optional columns if specific column name wasn't matched
    if (msg.includes('jenis_ujian') || (Array.isArray(item) ? item.some(r => 'jenis_ujian' in r) : 'jenis_ujian' in item)) {
      if (Array.isArray(item)) {
        item.forEach(r => delete r.jenis_ujian);
      } else {
        delete item.jenis_ujian;
      }
      let retry = await supabase.from(table).upsert(item, options);
      if (!retry.error) return;
      error = retry.error;
      retryCount++;
      continue;
    }

    break;
  }

  if (error) throw error;
}

// --- API ROUTES ---

// Health & DB Connection Check Endpoint
app.get(["/api/health", "/health", "/api/health/"], async (req, res) => {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/^["'<]+|["'>]+$/g, '');
  const supabaseKey = (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim().replace(/^["'<]+|["'>]+$/g, '');

  const hasEnv = !!(supabaseUrl && supabaseKey);

  if (!hasEnv) {
    return res.status(200).json({
      status: "error",
      database: "disconnected",
      hasEnv: false,
      error: "Variabel lingkungan Supabase belum diisi.",
      message: "Silakan atur SUPABASE_URL dan SUPABASE_ANON_KEY di Settings > Environment Variables."
    });
  }

  const supabaseClient = getSupabaseClient();
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('users').select('username').limit(1);
      if (!error || error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST301') {
        return res.status(200).json({
          status: "ok",
          database: "connected",
          hasEnv: true,
          time: new Date().toISOString(),
          info: "Terhubung ke Supabase (REST API URL & Anon Key)",
          message: "Berhasil terhubung ke Supabase via URL & Anon Key!"
        });
      }
    } catch (sbErr) {
      // continue to ping check
    }
  }

  if (supabaseKey) {
    try {
      const pingRes = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      });
      if (pingRes.ok || pingRes.status === 200 || pingRes.status === 204) {
        return res.status(200).json({
          status: "ok",
          database: "connected",
          hasEnv: true,
          time: new Date().toISOString(),
          info: "Terhubung ke Supabase (HTTP REST Endpoint)",
          message: "Supabase REST API Terhubung!"
        });
      } else {
        const text = await pingRes.text();
        return res.status(200).json({
          status: "error",
          database: "disconnected",
          hasEnv: true,
          error: `Supabase REST (HTTP ${pingRes.status}): ${text.slice(0, 120)}`,
          message: `Gagal otentikasi Supabase (HTTP ${pingRes.status}). Periksa SUPABASE_ANON_KEY Anda.`
        });
      }
    } catch (pingErr: any) {
      return res.status(200).json({
        status: "error",
        database: "disconnected",
        hasEnv: true,
        error: `Gagal menghubungi URL Supabase: ${pingErr.message}`,
        message: "Tidak dapat menghubungi SUPABASE_URL. Periksa kembali URL Supabase Anda."
      });
    }
  }

  return res.status(200).json({
    status: "error",
    database: "disconnected",
    hasEnv: true,
    error: "Gagal terhubung ke Supabase REST API",
    message: "Gagal terhubung ke Database Supabase."
  });
});

// 1. Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const rows = await runWithSupabaseFallback(null, async (supabase) => {
        const { data, error } = await supabase.from('users').select('*').eq('username', username);
        if (error) throw error;
        return data || [];
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        const { error } = await supabase.from('student_exams').insert({
          user_id: username,
          exam_id: subject,
          status: "ongoing"
        });
        if (error) throw error;
      }
    );
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
    const statusVal = await runWithSupabaseFallback(null, async (supabase) => {
        const { data } = await supabase.from('users').select('status').eq('username', username).single();
        return data?.status || "OFFLINE";
      }
    );
    res.json({ status: statusVal });
  } catch (err: any) {
    console.error("Check status failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Exams
app.get("/api/exams", async (req, res) => {
  try {
    const list = await runWithSupabaseFallback(null, async (supabase) => {
        const { data, error } = await supabase.from('exams').select('*');
        if (error) throw error;
        return data || [];
      }
    );
    res.json({ exams: list });
  } catch (err: any) {
    console.error("Get exams failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4.1. Ensure Exam Exists
app.post("/api/exams/ensure", async (req, res) => {
  const { id, nama_ujian, waktu_mulai, durasi, token_akses, is_active } = req.body;
  const examData = {
    id,
    nama_ujian,
    waktu_mulai: waktu_mulai || new Date().toISOString(),
    durasi: durasi || 60,
    token_akses: token_akses || "123456",
    is_active: is_active !== undefined ? is_active : true
  };
  try {
    await runWithSupabaseFallback(null, async (supabase) => {
        await safeUpsert(supabase, 'exams', examData, { onConflict: 'id' });
      }
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Ensure exam failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Get App Config
app.get("/api/app-config", async (req, res) => {
  try {
    const list = await runWithSupabaseFallback(null, async (supabase) => {
        const { data, error } = await supabase.from('app_config').select('*');
        if (error) throw error;
        return data || [];
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        const valid = updates.filter((item: any) => item && item.key).map((item: any) => ({ key: item.key, value: item.value || "" }));
        if (valid.length > 0) {
          await safeUpsert(supabase, 'app_config', valid, { onConflict: 'key' });
        }
      }
    );
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
    const list = await runWithSupabaseFallback(null, async (supabase) => {
        const { data, error } = await supabase.from('user_config').select('*').eq('username', username);
        if (error) throw error;
        return data || [];
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        if (updates && updates.length > 0) {
          await safeUpsert(supabase, 'user_config', updates);
        }
      }
    );
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
    const merged = await runWithSupabaseFallback(null, async (supabase) => {
        let query = supabase.from('questions').select('*');
        if (examId && examId.trim() !== '') {
          // Check if examId matches exam_id directly
          const { data: qListDirect } = await supabase.from('questions').select('*').eq('exam_id', examId);
          if (qListDirect && qListDirect.length > 0) {
            query = supabase.from('questions').select('*').eq('exam_id', examId);
          } else {
            // Otherwise attempt to match by exam_id or mapel if column exists, or get all questions
            query = supabase.from('questions').select('*');
          }
        }
        const { data: qList, error: qErr } = await query;
        if (qErr) throw qErr;
        if (!qList || qList.length === 0) return [];

        const qIds = qList.map((q: any) => q.id);
        const { data: optList, error: optErr } = await supabase.from('options').select('*').in('question_id', qIds);
        if (optErr && !optErr.message?.includes('column')) {
          console.warn("Fetch options warning:", optErr);
        }

        return qList.map((q: any) => ({
          ...q,
          options: (optList || []).filter((o: any) => o.question_id === q.id)
        }));
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        await safeUpsert(supabase, 'questions', question, { onConflict: 'id' });

        await supabase.from('options').delete().eq('question_id', question.id);

        if (optionsList && optionsList.length > 0) {
          const { error: optErr } = await supabase.from('options').insert(optionsList);
          if (optErr) throw optErr;
        }
      }
    );

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
    await runWithSupabaseFallback(null, async (supabase) => {
        for (const item of list) {
          await safeUpsert(supabase, 'questions', item.question, { onConflict: 'id' });

          await supabase.from('options').delete().eq('question_id', item.question.id);
          if (item.optionsList && item.optionsList.length > 0) {
            const { error: optErr } = await supabase.from('options').insert(item.optionsList);
            if (optErr) throw optErr;
          }
        }
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        await supabase.from('options').delete().eq('question_id', id);
        const { error } = await supabase.from('questions').delete().eq('id', id);
        if (error) throw error;
      }
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete question failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 13. Get Users
app.get("/api/users", async (req, res) => {
  try {
    const list = await runWithSupabaseFallback(null, async (supabase) => {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        return data || [];
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        await safeUpsert(supabase, 'users', user, { onConflict: 'username' });
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        const { error } = await supabase.from('users').delete().eq('username', username);
        if (error) throw error;
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        await safeUpsert(supabase, 'users', mappedUsers, { onConflict: 'username' });
      }
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Import users failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 17. Normalize Database Roles
app.post("/api/users/normalize", async (req, res) => {
  try {
    const updated = await runWithSupabaseFallback(null, async (supabase) => {
        const { data: list, error } = await supabase.from('users').select('id, role');
        if (error) throw error;
        let count = 0;
        for (const user of (list || [])) {
          const newRole = user.role === "Guru" ? "Guru" : "siswa";
          if (user.role !== newRole) {
            await supabase.from('users').update({ role: newRole }).eq('id', user.id);
            count++;
          }
        }
        return count;
      }
    );
    res.json({ success: true, updated });
  } catch (err: any) {
    console.error("Normalize failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 18. Get Learning Objectives
app.get("/api/learning-objectives", async (req, res) => {
  try {
    const list = await runWithSupabaseFallback(null, async (supabase) => {
        const { data, error } = await supabase.from('learning_objectives').select('*');
        if (error) throw error;
        return data || [];
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        await safeUpsert(supabase, 'learning_objectives', data, { onConflict: 'id' });
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        const { error } = await supabase.from('learning_objectives').delete().eq('id', id);
        if (error) throw error;
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        await safeUpsert(supabase, 'learning_objectives', list, { onConflict: 'id' });
      }
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Import LOs failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 22. Assign Test Group
app.post("/api/assign-test-group", async (req, res) => {
  const { usernames, examId, session, tpId, examType, activePaket } = req.body;
  try {
    await runWithSupabaseFallback(null, async (supabase) => {
        const updatePayload: any = { active_exam: examId, session, active_tp: tpId, exam_type: examType, active_paket: activePaket };
        let { error } = await supabase.from('users')
          .update(updatePayload)
          .in('username', usernames);
          
        if (error) {
          const msg = String(error.message || error.details || error.hint || '');
          if (msg.includes("Could not find the") || msg.includes("column") || msg.includes("schema cache") || msg.includes("active_paket")) {
            // Attempt to add column via exec_sql RPC
            try {
              await supabase.rpc('exec_sql', { sql_query: "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active_paket TEXT;" });
              // Retry update with active_paket
              const retry = await supabase.from('users')
                .update(updatePayload)
                .in('username', usernames);
              if (!retry.error) return;
              error = retry.error;
            } catch (_) {
              // ignore
            }
            
            // If still failing or RPC not supported, strip active_paket and update without it
            delete updatePayload.active_paket;
            const retryWithoutPaket = await supabase.from('users')
              .update(updatePayload)
              .in('username', usernames);
            if (!retryWithoutPaket.error) return;
            error = retryWithoutPaket.error;
          }
        }
        
        if (error) throw error;
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        for (const update of updates) {
          const { error } = await supabase.from('users').update({ session: update.session }).eq('username', update.username);
          if (error) throw error;
        }
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        const { error } = await supabase.from('users').update({ status: "OFFLINE" }).eq('username', username);
        if (error) throw error;
      }
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Reset login failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 25. Get School Schedules
app.get("/api/school-schedules", async (req, res) => {
  try {
    const list = await runWithSupabaseFallback(null, async (supabase) => {
        const { data, error } = await supabase.from('school_schedules').select('*');
        if (error) throw error;
        return data || [];
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        await supabase.from('school_schedules').delete().neq('school', '');
        if (cleanSchedules && cleanSchedules.length > 0) {
          const { error } = await supabase.from('school_schedules').insert(cleanSchedules);
          if (error) throw error;
        }
      }
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Save schedules failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 27. Get Recap
app.get("/api/recap", async (req, res) => {
  try {
    const merged = await runWithSupabaseFallback(null, async (supabase) => {
        const { data: seList, error: seErr } = await supabase.from('student_exams').select('*');
        if (seErr) throw seErr;
        const { data: uList } = await supabase.from('users').select('*');
        const { data: eList } = await supabase.from('exams').select('*');

        return (seList || []).map((se: any) => ({
          ...se,
          users: (uList || []).find((u: any) => u.username === se.user_id) || null,
          exams: (eList || []).find((e: any) => e.id === se.exam_id) || null
        }));
      }
    );
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
    const merged = await runWithSupabaseFallback(null, async (supabase) => {
        const { data: seList, error: seErr } = await supabase.from('student_exams').select('*').eq('exam_id', subject);
        if (seErr) throw seErr;
        if (!seList || seList.length === 0) return [];

        const seIds = seList.map((se: any) => se.id);
        const { data: ansList } = await supabase.from('answers').select('*').in('student_exam_id', seIds);
        const { data: qList } = await supabase.from('questions').select('*').eq('exam_id', subject);

        return seList.map((se: any) => ({
          ...se,
          answers: (ansList || []).filter((a: any) => a.student_exam_id === se.id).map((a: any) => ({
            ...a,
            questions: (qList || []).find((q: any) => q.id === a.question_id) || null
          }))
        }));
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        await safeUpsert(supabase, 'external_grades', list);
      }
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Save grades failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 29b. Grade Essay (Koreksi Soal Uraian)
app.post("/api/grade-essay", async (req, res) => {
  const { student_exam_id, user_id, exam_id, score, answers_scores } = req.body;
  try {
    await runWithSupabaseFallback(null, async (supabase) => {
      if (student_exam_id) {
        await supabase.from('student_exams').update({ nilai: score, nilai_akhir: score }).eq('id', student_exam_id);
      } else if (user_id && exam_id) {
        await supabase.from('student_exams').update({ nilai: score, nilai_akhir: score }).eq('user_id', user_id).eq('exam_id', exam_id);
      }

      if (user_id && exam_id) {
        await safeUpsert(supabase, 'external_grades', [{
          username: user_id,
          mapel: exam_id,
          exam_type: 'Sumatif Akhir Semester',
          nilai: score
        }]);
      }

      if (answers_scores && Array.isArray(answers_scores)) {
        for (const ans of answers_scores) {
          if (ans.id) {
            await supabase.from('answers').update({ score: ans.score, feedback: ans.feedback }).eq('id', ans.id);
          }
        }
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Grade essay failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 30. Submit Exam
app.post("/api/submit-exam", async (req, res) => {
  const { user_id, exam_id, status, answersList } = req.body;
  try {
    await runWithSupabaseFallback(null, async (supabase) => {
        const { data, error } = await supabase.from('student_exams').insert({
          user_id,
          exam_id,
          status,
          waktu_submit: new Date().toISOString()
        }).select();
        if (error) throw error;

        const se = data?.[0];
        if (se && answersList && answersList.length > 0) {
          const answersToInsert = answersList.map((a: any) => ({
            student_exam_id: se.id,
            question_id: a.question_id,
            option_id: a.option_id
          }));
          const { error: aErr } = await supabase.from('answers').insert(answersToInsert);
          if (aErr) throw aErr;
        }
      }
    );
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
    const merged = await runWithSupabaseFallback(null, async (supabase) => {
        const { data: qList, error: qErr } = await supabase.from('questions').select('*').eq('exam_id', surveyType);
        if (qErr) throw qErr;
        if (!qList || qList.length === 0) return [];

        const qIds = qList.map((q: any) => q.id);
        const { data: optList, error: optErr } = await supabase.from('options').select('*').in('question_id', qIds);
        if (optErr) throw optErr;

        return qList.map((q: any) => ({
          ...q,
          options: (optList || []).filter((o: any) => o.question_id === q.id)
        }));
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        const { error } = await supabase.from('student_exams').insert({
          user_id,
          exam_id: surveyType,
          status: "completed",
          waktu_submit: new Date().toISOString()
        });
        if (error) throw error;
      }
    );
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
    const merged = await runWithSupabaseFallback(null, async (supabase) => {
        const { data: seList, error: seErr } = await supabase.from('student_exams').select('*').eq('exam_id', surveyType);
        if (seErr) throw seErr;
        if (!seList || seList.length === 0) return [];

        const seIds = seList.map((se: any) => se.id);
        const { data: ansList } = await supabase.from('answers').select('*').in('student_exam_id', seIds);

        return seList.map((se: any) => ({
          ...se,
          answers: (ansList || []).filter((a: any) => a.student_exam_id === se.id)
        }));
      }
    );
    res.json({ list: merged });
  } catch (err: any) {
    console.error("Get survey recap failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 34. Get LCC Teams
app.get("/api/lcc-teams", async (req, res) => {
  try {
    const list = await runWithSupabaseFallback(null, async (supabase) => {
        const { data, error } = await supabase.from('lcc_teams').select('*');
        if (error) throw error;
        return data || [];
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        await supabase.from('lcc_teams').delete().neq('id', '');
        if (teams && teams.length > 0) {
          const { error } = await supabase.from('lcc_teams').insert(teams);
          if (error) throw error;
        }
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        const { error } = await supabase.from('lcc_teams').delete().eq('id', id);
        if (error) throw error;
      }
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete LCC team failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 37. Get LCC Questions
app.get("/api/lcc-questions", async (req, res) => {
  try {
    const list = await runWithSupabaseFallback(null, async (supabase) => {
        const { data, error } = await supabase.from('lcc_questions').select('*');
        if (error) throw error;
        return data || [];
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        await safeUpsert(supabase, 'lcc_questions', q, { onConflict: 'id' });
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        await supabase.from('lcc_questions').delete().neq('id', '');
        if (list && list.length > 0) {
          const { error } = await supabase.from('lcc_questions').insert(list);
          if (error) throw error;
        }
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        const { error } = await supabase.from('lcc_questions').delete().eq('id', id);
        if (error) throw error;
      }
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete LCC question failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 41. Get LCC Config
app.get("/api/lcc-config", async (req, res) => {
  try {
    const config = await runWithSupabaseFallback(null, async (supabase) => {
        const { data, error } = await supabase.from('lcc_config').select('*').eq('key', 'main').single();
        if (error && error.code !== 'PGRST116') throw error;
        return data?.config || null;
      }
    );
    res.json({ config });
  } catch (err: any) {
    console.error("Get LCC config failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 42. Save LCC Config
app.post("/api/lcc-config", async (req, res) => {
  const { config } = req.body;
  try {
    await runWithSupabaseFallback(null, async (supabase) => {
        await safeUpsert(supabase, 'lcc_config', { key: "main", config }, { onConflict: 'key' });
      }
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Save LCC config failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// 43. Get LCC History
app.get("/api/lcc-history", async (req, res) => {
  try {
    const list = await runWithSupabaseFallback(null, async (supabase) => {
        const { data, error } = await supabase.from('lcc_history').select('*').order('timestamp', { ascending: false });
        if (error) throw error;
        return data || [];
      }
    );
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
    await runWithSupabaseFallback(null, async (supabase) => {
        await supabase.from('lcc_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (history && history.length > 0) {
          const { error } = await supabase.from('lcc_history').insert(history);
          if (error) throw error;
        }
      }
    );
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

