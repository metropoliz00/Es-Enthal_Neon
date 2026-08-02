# Panduan Deployment & Koneksi Database Neon (Vercel, Render & AI Studio)

Aplikasi ini telah dikonfigurasi secara **Full-Stack (Express API + React Vite)** dan mendukung penuh koneksi ke **Neon DB (PostgreSQL)** baik di AI Studio maupun saat di-deploy ke **Vercel** atau **Render**.

---

## Mengapa Sebelumnya Ditolak / Belum Connect di Vercel?

Ada 2 penyebab utama mengapa di AI Studio sudah connect namun di Vercel belum:

1. **Variabel Lingkungan (`DATABASE_URL`) Belum Diisi di Vercel Dashboard**
   Di AI Studio, `DATABASE_URL` sudah tersimpan di Secrets local environment. Vercel adalah server terpisah, sehingga Anda **harus mengisi `DATABASE_URL` di Vercel Dashboard**.
2. **Backend API Route Vercel (Serverless)**
   Secara bawaan, Vercel hanya menyajikan file statis (HTML/JS) frontend. Kami telah menambahkan file `/api/index.ts` dan `vercel.json` agar Vercel secara otomatis menjalankan Express backend API secara **Serverless Function**.

---

## Langkah 1: Tambahkan Environment Variable di Vercel (WAJIB)

Agar Vercel dapat terhubung ke Neon PostgreSQL:

1. Buka dashboard Vercel Anda di [vercel.com](https://vercel.com) dan pilih proyek aplikasi Anda.
2. Masuk ke menu **Settings** > **Environment Variables**.
3. Tambahkan variabel baru:
   - **Key / Name**: `DATABASE_URL`
   - **Value**: Tempelkan *Connection String* Neon Anda (contoh: `postgres://user:password@ep-xyz.neon.tech/neondb?sslmode=require`)
   - Centang opsi **Production**, **Preview**, dan **Development**.
4. Klik **Save**.

---

## Langkah 2: Deploy Ulang (Redeploy) di Vercel

Setelah menambahkan Environment Variable `DATABASE_URL`:

1. Buka tab **Deployments** di Vercel.
2. Klik titik tiga (`...`) di samping deployment terbaru, lalu pilih **Redeploy** (atau lakukan `git push` ulang dari repositori Anda).
3. Setelah redeploy selesai, buka aplikasi Anda di Vercel.

---

## Langkah 3: Verifikasi Koneksi di Vercel

1. Buka halaman Admin / Pengaturan di aplikasi Vercel Anda (`/admin`).
2. Masuk ke tab **Konfigurasi**.
3. Status koneksi di banner teratas akan otomatis menampilkan status hijau:
   `Database Connected` dengan indikator aktif!

---

## Struktur File Backend & Vercel yang Dibuat Automatis

- **`vercel.json`**: Mengarahkan semua request `/api/*` ke Serverless Function Vercel dan halaman lainnya ke SPA (`index.html`).
- **`api/index.ts`**: Entrypoint Serverless Function Express untuk Vercel.
- **`src/app.ts`**: Modul pusat API routing Express & koneksi Drizzle Neon DB.
- **`src/db/index.ts`**: Manajemen Connection Pool PostgreSQL dengan SSL otomatis `rejectUnauthorized: false` untuk Neon.

---

## Perintah Git Push ke GitHub (Jika Deploy via Git)

```bash
git add .
git commit -m "Add Vercel serverless API setup and Neon DB auto connection"
git push origin main
```
