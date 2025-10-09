import { Hono } from 'hono';

// Define User type directly here to avoid shared package import issues
export interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

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