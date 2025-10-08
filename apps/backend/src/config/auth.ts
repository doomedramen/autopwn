import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { db, users, sessions, accounts } from "@autopwn/shared";
import { env } from "./env.js";

console.log('Initializing better-auth with OpenAPI documentation enabled');

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      account: accounts,
      session: sessions,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  plugins: [
    openAPI(),
  ],
  debug: process.env.NODE_ENV === "development",
});

console.log('Better-auth initialized successfully');

export type Session = typeof auth.$Infer.Session;