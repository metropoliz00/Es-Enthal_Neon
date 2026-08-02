# Panduan Deployment & Koneksi Database Neon Vercel

Aplikasi ini telah diperbarui dengan driver khusus **`@neondatabase/serverless`** (koneksi PostgreSQL via WebSocket/HTTP Port 443) yang secara khusus dirancang oleh tim Neon untuk Vercel Serverless Function.

---

## Solusi Utama Error `FUNCTION_INVOCATION_FAILED` (HTTP 500) di Vercel

Ada **2 Penyebab Utama** mengapa koneksi bekerja di AI Studio tetapi belum terhubung / 500 di Vercel:

1. **Environment Variables Vercel Belum Dicentang untuk All Environments (Production, Preview, Development)**
   Saat membuka Vercel melalui link domain preview (misal `cbt-tka-xxx.vercel.app`), jika `DATABASE_URL` hanya disetting untuk *Production*, maka serverless preview function **tidak dapat membaca `DATABASE_URL`**.
2. **Belum Melakukan RE-DEPLOY Setelah Menambah Environment Variable**
   Di Vercel, menambahkan/mengedit `DATABASE_URL` di Settings **TIDAK** otomatis memperbarui deployment yang sedang aktif. Anda **WAJIB melakukan Redeploy** agar serverless function memuat variabel lingkungan yang baru.

---

## Langkah 1: Atur `DATABASE_URL` di Vercel Dashboard (WAJIB)

1. Buka dashboard Vercel Anda di [vercel.com](https://vercel.com) dan pilih proyek aplikasi Anda.
2. Masuk ke menu **Settings** > **Environment Variables**.
3. Tambahkan atau Edit variabel bernama `DATABASE_URL`:
   - **Key / Name**: `DATABASE_URL`
   - **Value**: Tempelkan Connection String Neon Anda **TANPA TANDA KUTIP** (`"` atau `'`)!
     - Contoh: `postgresql://neondb_owner:npg_xxx@ep-xyz-pooler.singapore.aws.neon.tech/neondb?sslmode=require`
   - **Target Environments** (PENTING!): Centang KETIGA opsi:
     - [x] **Production**
     - [x] **Preview**
     - [x] **Development**
4. Klik **Save**.

---

## Langkah 2: Lakukan REDEPLOY di Vercel (Sangat Penting!)

Setelah menyimpan `DATABASE_URL`:

1. Buka tab **Deployments** di bagian atas Vercel Dashboard.
2. Cari deployment paling atas (terbaru).
3. Klik tombol titik tiga (**`...`**) di sebelah kanan deployment tersebut.
4. Pilih **Redeploy** (lalu klik tombol **Redeploy** lagi pada konfirmasi pop-up).
5. Tunggu proses build selesai (~30-60 detik).

---

## Langkah 3: Tes Ulang Koneksi

1. Buka aplikasi Anda di Vercel.
2. Masuk ke menu Admin / Pengaturan di tab **Konfigurasi**.
3. Klik tombol **Cek Koneksi**.
4. Banner akan berubah menjadi **Connected** dengan lampu indikator hijau aktif!

---

## Pembaruan Sistem yang Telah Diterapkan Automatis

- **`@neondatabase/serverless`**: Menggantikan koneksi TCP port 5432 biasa dengan driver serverless WebSocket/HTTP port 443 yang tahan cold-start & bebas timeout.
- **`src/db/index.ts`**: Sanitasi string otomatis (menghapus tanda kutip `"` atau `'` jika pengguna tidak sengaja menyalinnya).
- **`api/index.ts`**: Serverless function wrapper dengan penanganan error internal agar tidak menyebabkan crash 500.

---

## Perintah Git Push ke GitHub (Jika Deploy via Git)

```bash
git add .
git commit -m "Upgrade to @neondatabase/serverless for Vercel deployment"
git push origin main
```


