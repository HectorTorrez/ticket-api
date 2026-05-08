import type { UserRole } from '../generated/prisma/enums';

declare global {
  namespace Express {
    interface UserPayload {
      userId: string;
      email: string;
      role: UserRole;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}

export {};
