# jariahkusvg

Galeri SVG sederhana yang bisa diekspor ke **PNG/JPG** langsung di browser. Dibuat dengan **Next.js + TypeScript** dan siap deploy di **Vercel**.

## Cara Pakai (tanpa dev lokal)

1. Buat repo GitHub kosong bernama `jariahkusvg` (opsional, nama bebas).
2. Upload semua file di folder ini ke repo tersebut (bisa lewat *Add file → Upload files*).
3. Di **Vercel Dashboard** → **Add New → Project** → pilih repo GitHub tadi → **Deploy**.
4. Setiap commit/push ke GitHub akan otomatis memicu **deployment** baru.

## Scripts

- `npm run dev` — pengembangan lokal (opsional)
- `npm run build` — build production
- `npm start` — menjalankan hasil build
- `npm run lint` — linting dengan `eslint-config-next`
- `npm run type-check` — cek TypeScript tanpa emit

## Catatan
- `next-env.d.ts` akan dibuat otomatis oleh Next.js saat build.
- Tidak perlu `vercel.json` untuk konfigurasi dasar Next.js.

