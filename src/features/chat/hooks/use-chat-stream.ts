"use client"

import { useCallback, useState } from "react"
import { createMessage, type Message } from "@/core/domain/message.entity"
import { logger } from "@/lib/logger"
import { useSendMessageStream } from "../api/use-chat"
import { CHAT_MODEL, CHAT_TEMPERATURE } from "../chat.config"

/**
 * Owns the conversation state and the token-by-token stream reading, so the
 * chat components stay purely presentational.
 */
export function useChatStream() {
  const [messages, setMessages] = useState<Message[]>([])
  const { mutateAsync, isPending } = useSendMessageStream()

  /** Rewrites the placeholder assistant turn as chunks arrive. */
  const updateMessage = useCallback((id: string, content: string) => {
    setMessages((previous) =>
      previous.map((message) =>
        message.id === id ? { ...message, content } : message,
      ),
    )
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || isPending) return

      const userMessage = createMessage("user", trimmed)
      const history = [...messages, userMessage]
      const placeholder = createMessage("assistant", "")

      setMessages([...history, placeholder])

      try {
        const response = await mutateAsync({
          messages: history,
          options: { model: CHAT_MODEL, temperature: CHAT_TEMPERATURE },
        })

        if (!response.body) {
          throw new Error("Response body is not readable")
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let answer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          answer += decoder.decode(value, { stream: true })
          updateMessage(placeholder.id, answer)
        }
      } catch (error) {
        logger.error("Failed to send chat message", error)

        const reason =
          error instanceof Error ? error.message : "Unknown error occurred"

        // Drop the empty placeholder, then report the failure in its place.
        setMessages((previous) => [
          ...previous.filter((message) => message.id !== placeholder.id),
          createMessage("system", reason),
        ])
      }
    },
    [isPending, messages, mutateAsync, updateMessage],
  )

  return { messages, isPending, sendMessage }
}
