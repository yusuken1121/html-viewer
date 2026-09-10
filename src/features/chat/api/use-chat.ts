import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { chatApi } from "./chat.api"
import type {
  ChatCompletionResponse,
  SendChatMessageInput,
} from "../chat.schema"

export const chatKeys = {
  all: ["chat"] as const,
}

/** Send a message to the AI assistant and wait for the complete answer. */
export function useSendMessageComplete(
  options?: UseMutationOptions<
    ChatCompletionResponse,
    Error,
    SendChatMessageInput
  >,
) {
  return useMutation({ mutationFn: chatApi.sendMessageComplete, ...options })
}

/**
 * Send a message to the AI assistant and receive a streaming `Response`.
 * Reading the body is the caller's job — see `useChatStream`.
 */
export function useSendMessageStream(
  options?: UseMutationOptions<Response, Error, SendChatMessageInput>,
) {
  return useMutation({ mutationFn: chatApi.sendMessageStream, ...options })
}
