import { DefaultSession } from 'next-auth';
import { UserRole } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: UserRole;
      username: string;
      bludId?: string | null;
      mustChangePassword?: boolean;
    };
  }

  interface User {
    role: UserRole;
    username: string;
    bludId?: string | null;
    mustChangePassword?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: UserRole;
    username?: string;
    bludId?: string | null;
    mustChangePassword?: boolean;
  }
}
