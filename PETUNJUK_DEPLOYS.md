# Panduan Deployment & Koneksi Database Supabase (Netlify & Vercel)

Aplikasi ini telah dikonfigurasi penuh untuk mendukung deployment di **Netlify** maupun **Vercel** dengan database **Supabase PostgreSQL**.

---

## 🚀 Panduan Deployment di Netlify (Paling Direkomendasikan)

Jika Anda mendepositkan/mendeploy aplikasi ini ke **Netlify**, ikuti langkah-langkah berikut agar API backend dan koneksi database Supabase langsung terhubung sempurna:

### 1. Hubungkan Repositori ke Netlify
1. Buka [Netlify Dashboard](https://app.netlify.com).
2. Klik **Add new site** > **Import an existing project**.
3. Pilih penyedia Git Anda (GitHub / GitLab) dan pilih repositori proyek ini.
4. Pada pengaturan build (**Build settings**):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions` (sudah otomatis diset via `netlify.toml`).
5. Klik tombol **Show advanced** atau abaikan, karena konfigurasi `netlify.toml` sudah mencakup redirect API otomatis ke `/.netlify/functions/api`.

### 2. Set Environment Variables di Netlify (WAJIB)
1. Setelah proyek dibuat (atau sebelum deploy), masuk ke **Site configuration** > **Environment variables**.
2. Tambahkan 2 variabel utama Supabase Anda:
   - **`SUPABASE_URL`**: Project URL Supabase Anda (contoh: `https://xyz.supabase.co`)
   - **`SUPABASE_ANON_KEY`**: Anon / Public Key Supabase Anda
   *(Opsional: Jika menggunakan connection string langsung, Anda bisa menambahkan `DATABASE_URL`)*
3. Klik **Save**.

### 3. Deploy Ulang (Trigger Deploy)
1. Jika sudah terlanjur deploy dan mendapat 404/error, masuk ke tab **Deploys**.
2. Klik **Trigger deploy** > **Clear cache and deploy site**.
3. Setelah build selesai, buka URL Netlify Anda. Aplikasi dan API backend akan berfungsi 100%!

---

## 🛠️ Panduan Deployment di Vercel

Jika menggunakan **Vercel**:
1. Masuk ke **Settings** > **Environment Variables**.
2. Tambahkan `DATABASE_URL` dan pastikan mencentang **Production**, **Preview**, dan **Development**.
3. **PENTING**: Masuk ke tab **Deployments**, klik `...` pada deployment terakhir, lalu klik **Redeploy**.

---

## 🔍 Solusi Cepat Jika Masih Belum Connect:
1. **Pastikan Connection String Supabase benar**: Format harus dimulai dengan `postgresql://...` atau `postgres://...`.
2. **Isi password database dengan benar**: Pastikan mengganti placeholder `[YOUR-PASSWORD]` dengan password database Supabase yang dibuat saat membuat project.
3. **Jangan gunakan tanda kutip**: Saat memasukkan `DATABASE_URL` di Vercel atau Netlify, pastikan tidak ada tanda kutip ganda (`"`) atau tunggal (`'`) di awal/akhir string.
4. **Redeploy setelah ubah Environment Variable**: Baik di Vercel maupun Netlify, setiap kali Anda mengubah env var, Anda **wajib melakukan manual redeploy** agar variabel terbaca oleh serverless function.
