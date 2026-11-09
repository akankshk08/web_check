import { z } from "zod";
import { email, requiredText } from "./common";

export const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "Password is too long");

export const loginSchema = z.object({ email, password: z.string().min(1, "Password is required").max(200) }).strict();
export const registerSchema = z
  .object({
    fullName: requiredText("Your name", 120),
    agencyName: requiredText("Agency name", 120),
    email,
    password,
  })
  .strict();
export const forgotPasswordSchema = z.object({ email }).strict();
export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .strict()
  .refine((d) => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

/** Accepting an invitation as a brand-new user. */
export const acceptInviteSignupSchema = z
  .object({ token: z.string().min(20).max(200), fullName: requiredText("Your name", 120), password })
  .strict();
export const acceptInviteSchema = z.object({ token: z.string().min(20).max(200) }).strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export const createWorkspaceSchema = z.object({ agencyName: requiredText("Agency name", 120) }).strict();
