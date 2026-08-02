# Panduan Deployment & Koneksi Database Neon (Vercel, Render & AI Studio)

Aplikasi ini telah dikonfigurasi secara **Full-Stack (Express API + React Vite)** dan mendukung penuh koneksi ke **Neon DB (PostgreSQL)** baik di AI Studio maupun saat di-deploy ke **Vercel** atau **Render**.

---

## Solusi Error `FUNCTION_INVOCATION_FAILED` (HTTP 500) di Vercel

Jika Anda mengalami error `FUNCTION_INVOCATION_FAILED` di Vercel, penyebab utamanya adalah:

1. **`DATABASE_URL` Belum Disetting / Terbungkus Tanda Kutip di Vercel**
   Jika `DATABASE_URL` diisi dengan tanda kutip (misal `"postgres://..."`), atau belum disetting, koneksi database akan gagal saat Serverless Function diinisialisasi.
2. **Timeout Inisialisasi Database Serverless**
   Batas waktu eksekusi Serverless Function di Vercel adalah 10 detik. Kami telah memperbarui kode backend dengan **Sanitasi String**, **Pool Connection Timeout 5s**, dan **Non-blocking Table Initialization** agar Serverless Function Vercel tidak pernah crash atau timeout.

---

## Langkah 1: Pasang / Periksa `DATABASE_URL` di Vercel (WAJIB)

Agar Vercel dapat terhubung ke Neon PostgreSQL:

1. Buka dashboard Vercel Anda di [vercel.com](https://vercel.com) dan pilih proyek aplikasi Anda.
2. Masuk ke menu **Settings** > **Environment Variables**.
3. Tambahkan (atau Edit) variabel bernama `DATABASE_URL`:
   - **Key / Name**: `DATABASE_URL`
   - **Value**: Tempelkan Connection String Neon Anda **TANPA TANDA KUTIP** di awal/akhir!
     - Contoh yang BENAR: `postgresql://neondb_owner:password@ep-xyz-pooler.singapore.aws.neon.tech/neondb?sslmode=require`
     - Pastikan terdapat `?sslmode=require` di akhir string koneksi.
   - Centang opsi **Production**, **Preview**, dan **Development**.
4. Klik **Save**.

---

## Langkah 2: Deploy Ulang (Redeploy) di Vercel

Setelah menambahkan / memperbarui Environment Variable `DATABASE_URL`:

1. Buka tab **Deployments** di Vercel.
2. Klik titik tiga (`...`) di samping deployment terbaru, lalu pilih **Redeploy** (centang *Use existing Build Cache* atau Uncheck jika ingin clean build).
3. Atau lakukan `git push` ulang dari repositori Anda jika dihubungkan dengan GitHub.

---

## Langkah 3: Verifikasi Koneksi di Vercel

1. Buka halaman Admin / Pengaturan di aplikasi Vercel Anda (`/admin`).
2. Masuk ke tab **Konfigurasi**.
3. Status koneksi di banner teratas akan otomatis menampilkan status hijau:
   `Database Connected` dengan indikator aktif!

---

## Struktur File Backend & Vercel yang Diperbarui Automatis

- **`vercel.json`**: Mengarahkan semua request `/api/*` ke Serverless Function Vercel dan halaman lainnya ke SPA (`index.html`).
- **`api/index.ts`**: Express request handler serverless wrapper untuk Vercel Node runtime.
- **`src/app.ts`**: Express routing, health check dengan timeout safeguard 5 detik, & auto table initializer.
- **`src/db/index.ts`**: Manajemen Connection Pool PostgreSQL dengan sanitasi string otomatis & SSL `rejectUnauthorized: false` untuk Neon.

---

## Perintah Git Push ke GitHub (Jika Deploy via Git)

```bash
git add .
git commit -m "Fix Vercel FUNCTION_INVOCATION_FAILED and optimize Neon DB connection"
git push origin main
```

