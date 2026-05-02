import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hash(password: string) {
  return bcrypt.hash(password, 12);
}

async function main() {
  const bluds = [
    { code: 'BLUD01', name: 'RSCB', region: 'Kota Ternate' },
    { code: 'BLUD02', name: 'RSUD Tidore', region: 'Kota Tidore Kepulauan' },
    { code: 'BLUD03', name: 'RSUD Labuha', region: 'Kabupaten Halmahera Selatan' },
    { code: 'BLUD04', name: 'RSUD Jailolo', region: 'Kabupaten Halmahera Barat' },
    { code: 'BLUD05', name: 'RSUD Tobelo', region: 'Kabupaten  Halmahera Utara' },
  ];

  for (const item of bluds) {
    await prisma.blud.upsert({
      where: { code: item.code },
      update: { name: item.name, region: item.region, isActive: true },
      create: item,
    });
  }

  const passwordMap = {
    superAdmin: await hash('SuperAdmin123!'),
    bpkpAdmin: await hash('AdminBPKP123!'),
    reviewer: await hash('ReviewerBPKP123!'),
    auditor: await hash('Auditor123!'),
    bludAdmin: await hash('BludAdmin123!'),
    bludOperator: await hash('BludOperator123!'),
  };

  await prisma.user.upsert({
    where: { username: 'super.admin' },
    update: {
      name: 'Super Admin Sistem',
      role: UserRole.SUPER_ADMIN,
      password: passwordMap.superAdmin,
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      username: 'super.admin',
      email: 'superadmin@bpkp.go.id',
      name: 'Super Admin Sistem',
      role: UserRole.SUPER_ADMIN,
      password: passwordMap.superAdmin,
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { username: 'admin.bpkp' },
    update: {
      name: 'Admin BPKP',
      role: UserRole.BPKP_ADMIN,
      password: passwordMap.bpkpAdmin,
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      username: 'admin.bpkp',
      email: 'admin.bpkp@bpkp.go.id',
      name: 'Admin BPKP',
      role: UserRole.BPKP_ADMIN,
      password: passwordMap.bpkpAdmin,
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { username: 'reviewer.bpkp' },
    update: {
      name: 'Reviewer BPKP',
      role: UserRole.BPKP_REVIEWER,
      password: passwordMap.reviewer,
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      username: 'reviewer.bpkp',
      email: 'reviewer.bpkp@bpkp.go.id',
      name: 'Reviewer BPKP',
      role: UserRole.BPKP_REVIEWER,
      password: passwordMap.reviewer,
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { username: 'auditor.internal' },
    update: {
      name: 'Auditor Internal',
      role: UserRole.AUDITOR,
      password: passwordMap.auditor,
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      username: 'auditor.internal',
      email: 'auditor.internal@bpkp.go.id',
      name: 'Auditor Internal',
      role: UserRole.AUDITOR,
      password: passwordMap.auditor,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const allBluds = await prisma.blud.findMany({ orderBy: { code: 'asc' } });
  for (const blud of allBluds) {
    const code = blud.code.toLowerCase();
    await prisma.user.upsert({
      where: { username: `${code}.admin` },
      update: {
        name: `${blud.name} Admin`,
        role: UserRole.BLUD_ADMIN,
        password: passwordMap.bludAdmin,
        bludId: blud.id,
        isActive: true,
        mustChangePassword: true,
      },
      create: {
        username: `${code}.admin`,
        email: `${code}.admin@blud.local`,
        name: `${blud.name} Admin`,
        password: passwordMap.bludAdmin,
        role: UserRole.BLUD_ADMIN,
        bludId: blud.id,
        isActive: true,
        mustChangePassword: true,
      },
    });

    await prisma.user.upsert({
      where: { username: `${code}.operator` },
      update: {
        name: `${blud.name} Operator`,
        role: UserRole.BLUD_OPERATOR,
        password: passwordMap.bludOperator,
        bludId: blud.id,
        isActive: true,
        mustChangePassword: true,
      },
      create: {
        username: `${code}.operator`,
        email: `${code}.operator@blud.local`,
        name: `${blud.name} Operator`,
        password: passwordMap.bludOperator,
        role: UserRole.BLUD_OPERATOR,
        bludId: blud.id,
        isActive: true,
        mustChangePassword: true,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
