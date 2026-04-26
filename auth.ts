import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';
import { SignInSchema } from '@/lib/zod';
import { createAuditLog } from '@/lib/audit';

const MAX_FAILED_LOGIN = 5;
const LOCK_MINUTES = 15;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 15,
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const validated = SignInSchema.safeParse(credentials);
        if (!validated.success) return null;

        const { username, password } = validated.data;
        const user = await prisma.user.findUnique({
          where: { username: username.toLowerCase() },
          include: { blud: true },
        });

        if (!user) {
          await createAuditLog({
            action: 'LOGIN_FAILED',
            entityType: 'User',
            entityId: username.toLowerCase(),
            severity: 'WARNING',
            metadata: { reason: 'USER_NOT_FOUND' },
          });
          return null;
        }

        if (!user.isActive) {
          await createAuditLog({
            actorId: user.id,
            action: 'LOGIN_BLOCKED',
            entityType: 'User',
            entityId: user.id,
            severity: 'WARNING',
            metadata: { reason: 'USER_INACTIVE' },
          });
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await createAuditLog({
            actorId: user.id,
            action: 'LOGIN_BLOCKED',
            entityType: 'User',
            entityId: user.id,
            severity: 'WARNING',
            metadata: { reason: 'ACCOUNT_LOCKED', lockedUntil: user.lockedUntil.toISOString() },
          });
          return null;
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          const failedLoginCount = user.failedLoginCount + 1;
          const lockedUntil = failedLoginCount >= MAX_FAILED_LOGIN ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null;
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginCount, lockedUntil },
          });
          await createAuditLog({
            actorId: user.id,
            action: 'LOGIN_FAILED',
            entityType: 'User',
            entityId: user.id,
            severity: failedLoginCount >= MAX_FAILED_LOGIN ? 'CRITICAL' : 'WARNING',
            metadata: { reason: 'INVALID_PASSWORD', failedLoginCount },
          });
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });

        await createAuditLog({
          actorId: user.id,
          action: 'LOGIN_SUCCESS',
          entityType: 'User',
          entityId: user.id,
          metadata: { role: user.role, bludId: user.bludId },
        });

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          bludId: user.bludId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const isProtected = !pathname.startsWith('/login') && !pathname.startsWith('/api/auth');

      if (!isLoggedIn && isProtected) {
        return Response.redirect(new URL('/login', nextUrl));
      }

      if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
        return Response.redirect(new URL('/', nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.username = user.username;
        token.bludId = user.bludId;
        token.mustChangePassword = (user as any).mustChangePassword ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.role = token.role as any;
        session.user.username = String(token.username ?? '');
        session.user.bludId = token.bludId ? String(token.bludId) : null;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
});
