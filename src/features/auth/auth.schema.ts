import { z } from "zod"
import "@/lib/zod/zod-config"

export const PASSWORD_MIN_LENGTH = 8

const password = z.string().min(PASSWORD_MIN_LENGTH)

/**
 * The credentials contract. `auth.ts` validates against it inside the
 * Credentials provider and the sign-in form reuses it, so the two cannot
 * drift. Safe on the client: a plain schema with no server imports.
 */
export const credentialsSchema = z.object({
  email: z.email(),
  password,
})

export const signUpSchema = z
  .object({
    name: z.string().min(1),
    email: z.email(),
    password,
    passwordConfirmation: password,
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: "パスワードが一致しません",
    path: ["passwordConfirmation"],
  })

export const forgotPasswordSchema = z.object({
  email: z.email(),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password,
    passwordConfirmation: password,
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: "パスワードが一致しません",
    path: ["passwordConfirmation"],
  })

export type CredentialsInput = z.infer<typeof credentialsSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

/** Anonymous quotas — these endpoints create accounts and send email. */
export const SIGN_UP_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }
export const PASSWORD_RESET_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }
