"use client"

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useChatStream } from "../hooks/use-chat-stream"
import { ChatComposer } from "./chat-composer"
import { ChatEmptyState } from "./chat-empty-state"
import { ChatMessage } from "./chat-message"
import { ChatPanelHeader } from "./chat-panel-header"

export function ChatInterface() {
  const { messages, isPending, sendMessage } = useChatStream()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isPending])

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
      <ChatPanelHeader />

      <ScrollArea className="flex-1 p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 ? (
            <ChatEmptyState />
          ) : (
            messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <Separator />

      <ChatComposer onSubmit={sendMessage} isPending={isPending} />
    </div>
  )
}
