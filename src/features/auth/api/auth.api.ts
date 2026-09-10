import { apiPost } from "@/lib/api/api-client"
import type {
  ForgotPasswordInput,
  ResetPasswordInput,
  SignUpInput,
} from "../auth.schema"

export type RegisterResponse = {
  success: boolean
  user: { id: string; email: string; name: string }
}

export type MessageResponse = { success: boolean; message?: string }

export const authApi = {
  register: (data: SignUpInput) =>
    apiPost<RegisterResponse, SignUpInput>("/api/auth-actions/register", data),

  requestPasswordReset: (data: ForgotPasswordInput) =>
    apiPost<MessageResponse, ForgotPasswordInput>(
      "/api/auth-actions/forgot-password",
      data,
    ),

  resetPassword: (data: ResetPasswordInput) =>
    apiPost<MessageResponse, ResetPasswordInput>(
      "/api/auth-actions/reset-password",
      data,
    ),
}
