# JJ CAPCUT WEB

Website berbasis Vercel yang memakai endpoint CapCut dari plugin JS yang diberikan.

## Deploy
1. Upload folder ini ke GitHub.
2. Import repository ke Vercel.
3. Framework: Other.
4. Build command: kosong.
5. Deploy.

## Lokal
npm install
npx vercel dev

## Catatan
Endpoint render menggunakan layanan pihak ketiga `cc.fgsi.dpdns.org`, sesuai source JS yang diberikan. Ketersediaan dan aturan layanan tersebut berada di luar website ini.

Versi website ini tidak memakai FFmpeg karena fungsi serverless Vercel tidak cocok untuk proses FFmpeg seperti pada plugin Termux. Foto dikirim langsung ke endpoint render.
