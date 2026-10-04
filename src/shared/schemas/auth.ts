import { z } from 'zod';
import { LOGIN_MAX_PASSWORD, LOGIN_MIN_PASSWORD, USERNAME_MAX, USERNAME_MIN } from '../limits.js';

/** Login accepts any non-empty password; the length rule applies only when one is set. */
export const loginSchema = z.strictObject({
  username: z.string().trim().toLowerCase().min(USERNAME_MIN).max(USERNAME_MAX),
  password: z.string().min(1).max(LOGIN_MAX_PASSWORD),
});
export type LoginInput = z.output<typeof loginSchema>;

/** Used by the admin CLI when creating or resetting the vendor login. */
export const adminCredentialsSchema = z.strictObject({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]+$/, 'Use letters, numbers and underscores only')
    .min(USERNAME_MIN)
    .max(USERNAME_MAX),
  password: z
    .string()
    .min(LOGIN_MIN_PASSWORD, `Use at least ${LOGIN_MIN_PASSWORD} characters`)
    .max(LOGIN_MAX_PASSWORD),
});
export type AdminCredentials = z.output<typeof adminCredentialsSchema>;
