import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import {
  authApi,
  type MessageResponse,
  type RegisterResponse,
} from "./auth.api"
import type {
  ForgotPasswordInput,
  ResetPasswordInput,
  SignUpInput,
} from "../auth.schema"

export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
}

export function useRegister(
  options?: UseMutationOptions<RegisterResponse, Error, SignUpInput>,
) {
  return useMutation({ mutationFn: authApi.register, ...options })
}

export function useRequestPasswordReset(
  options?: UseMutationOptions<MessageResponse, Error, ForgotPasswordInput>,
) {
  return useMutation({ mutationFn: authApi.requestPasswordReset, ...options })
}

export function useResetPassword(
  options?: UseMutationOptions<MessageResponse, Error, ResetPasswordInput>,
) {
  return useMutation({ mutationFn: authApi.resetPassword, ...options })
}
