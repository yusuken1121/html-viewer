import { apiPost, apiPostStream } from "@/lib/api/api-client"
import type {
  ChatCompletionResponse,
  SendChatMessageInput,
} from "../chat.schema"

const CHAT_ENDPOINT = "/api/chat"

export const chatApi = {
  /** Send a message and wait for the whole answer. */
  sendMessageComplete: (input: SendChatMessageInput) =>
    apiPost<ChatCompletionResponse>(CHAT_ENDPOINT, {
      ...input,
      stream: false,
    }),

  /** Send a message and get the raw `Response` so the body can be streamed. */
  sendMessageStream: (input: SendChatMessageInput) =>
    apiPostStream(CHAT_ENDPOINT, { ...input, stream: true }),
}
