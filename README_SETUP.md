# MR BLUD Enterprise Setup (Database Document Storage)

## 1. Install dependency
```bash
npm install
```

## 2. Siapkan environment
Salin `.env.example` menjadi `.env`, lalu isi `DATABASE_URL` dan `AUTH_SECRET`.

## 3. Generate Prisma dan migrasi
```bash
npx prisma generate
npx prisma migrate dev --name enterprise_db_storage
```

## 4. Isi data awal
```bash
npm run seed
```

## 5. Jalankan aplikasi
```bash
npm run dev
```

## Akun seed
- `super.admin` / `SuperAdmin123!`
- `admin.bpkp` / `AdminBPKP123!`
- `reviewer.bpkp` / `ReviewerBPKP123!`
- `auditor.internal` / `Auditor123!`
- `blud01.admin` s.d. `blud05.admin` / `BludAdmin123!`
- `blud01.operator` s.d. `blud05.operator` / `BludOperator123!`

## Fitur enterprise yang sudah ditambahkan
- bcrypt password hashing dengan lockout percobaan gagal
- validasi Zod yang lebih ketat
- session JWT NextAuth dengan batas usia sesi
- penyimpanan dokumen di database PostgreSQL
- dashboard chart dengan Recharts
- export PDF laporan assessment
- approval workflow BPKP: submit, in review, revision requested, approved, rejected
- multi-role: super admin, BPKP admin, BPKP reviewer, BLUD admin, BLUD operator, auditor
- audit log detail: actor, action, severity, IP, user agent, previous state, next state, metadata

## Catatan
- Untuk production, jalankan migrasi via `npx prisma migrate deploy`.
- Karena dokumen disimpan di database, batasi ukuran file dan lakukan backup database rutin.
