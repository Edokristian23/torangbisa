'use server';

import { AuthError } from 'next-auth';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

import { signIn } from '@/auth';
import { prisma } from '@/lib/prisma';
import { RegisterSchema, SignInSchema } from '@/lib/zod';
import { createAuditLog } from '@/lib/audit';

export type ActionState = {
  error?: Record<string, string[] | undefined>;
  message?: string;
};

export const signUpCredentials = async (
  _prevState: unknown,
  formData: FormData,
): Promise<ActionState | void> => {
  const validatedFields = RegisterSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { username, email, name, password } = validatedFields.data;
  const normalizedUsername = username.toLowerCase();

  try {
    const existingUser = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    if (existingUser) {
      return { message: 'Username sudah digunakan.' };
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const blud = await prisma.blud.findFirst({
      where: {
        OR: [{ code: normalizedUsername.toUpperCase() }, { name: { equals: name, mode: 'insensitive' } }],
      },
    });

    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        email: email || null,
        name,
        password: hashedPassword,
        role: UserRole.BLUD_OPERATOR,
        bludId: blud?.id,
        mustChangePassword: false,
      },
    });

    await createAuditLog({
      actorId: user.id,
      action: 'SELF_REGISTER',
      entityType: 'User',
      entityId: user.id,
      metadata: { username: normalizedUsername, bludId: blud?.id ?? null },
    });
  } catch {
    return { message: 'Gagal membuat user.' };
  }

  redirect('/login');
};

export const signInCredentials = async (
  _prevState: unknown,
  formData: FormData,
): Promise<ActionState | void> => {
  const validatedFields = SignInSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { username, password } = validatedFields.data;

  try {
    await signIn('credentials', {
      username: username.toLowerCase(),
      password,
      redirectTo: '/',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { message: 'Username atau password salah, akun nonaktif, atau akun sedang terkunci.' };
        default:
          return { message: 'Terjadi kesalahan saat login.' };
      }
    }

    throw error;
  }
};
