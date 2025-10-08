import { Hono } from 'hono';
import { User } from '@autopwn/shared';

interface Session {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
  };
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export type AppContext = {
  Variables: {
    user: User | null;
    session: Session | null;
  };
};

export function createHono(): Hono<AppContext> {
  return new Hono<AppContext>();
}