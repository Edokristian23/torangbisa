import { object, string, nativeEnum, boolean } from 'zod';
import { AssessmentStatus, UserRole } from '@prisma/client';

const strongPassword = string()
  .min(12, '*Password minimal 12 karakter')
  .max(72, '*Password maksimal 72 karakter')
  .regex(/[A-Z]/, '*Password wajib memiliki huruf besar')
  .regex(/[a-z]/, '*Password wajib memiliki huruf kecil')
  .regex(/[0-9]/, '*Password wajib memiliki angka')
  .regex(/[^A-Za-z0-9]/, '*Password wajib memiliki simbol');

export const SignInSchema = object({
  username: string()
    .trim()
    .min(3, '*Username minimal 3 karakter')
    .max(50, '*Username maksimal 50 karakter')
    .regex(/^[a-zA-Z0-9._-]+$/, '*Username hanya boleh huruf, angka, titik, underscore, dan dash'),
  password: string().min(1, '*Password wajib diisi').max(72, '*Password maksimal 72 karakter'),
});

export const RegisterSchema = object({
  username: string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/),
  email: string().trim().email('*Format email tidak valid').optional().or(string().length(0)),
  name: string().trim().min(3, '*Nama minimal 3 karakter').max(120, '*Nama maksimal 120 karakter'),
  password: strongPassword,
  confirmPassword: string().min(1, '*Konfirmasi password wajib diisi'),
  role: nativeEnum(UserRole).optional(),
  bludId: string().optional().nullable(),
}).superRefine(({ confirmPassword, password }, ctx) => {
  if (confirmPassword !== password) {
    ctx.addIssue({
      code: 'custom',
      message: '*Konfirmasi password tidak sama',
      path: ['confirmPassword'],
    });
  }
});

export const UserUpsertSchema = object({
  username: string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/),
  email: string().trim().email('*Format email tidak valid').optional().or(string().length(0)),
  name: string().trim().min(3).max(120),
  password: strongPassword,
  role: nativeEnum(UserRole),
  bludId: string().trim().optional().nullable(),
  isActive: boolean().optional(),
  mustChangePassword: boolean().optional(),
});

export const UserPatchSchema = object({
  email: string().trim().email('*Format email tidak valid').optional().or(string().length(0)),
  name: string().trim().min(3).max(120).optional(),
  password: strongPassword.optional(),
  role: nativeEnum(UserRole).optional(),
  bludId: string().trim().optional().nullable(),
  isActive: boolean().optional(),
  mustChangePassword: boolean().optional(),
});

export const AssessmentWorkflowSchema = object({
  assessmentPeriodId: string().min(1),
  action: string().trim().min(1),
  reviewerNotes: string().trim().max(5000).optional(),
  targetStatus: nativeEnum(AssessmentStatus).optional(),
});
