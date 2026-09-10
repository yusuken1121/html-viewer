"use client"

import { useState, type KeyboardEvent } from "react"
import { Loader2, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type ChatComposerProps = {
  onSubmit: (content: string) => void
  isPending: boolean
}

export function ChatComposer({ onSubmit, isPending }: ChatComposerProps) {
  const [value, setValue] = useState("")
  const canSubmit = value.trim().length > 0 && !isPending

  const submit = () => {
    if (!canSubmit) return
    onSubmit(value)
    setValue("")
  }

  /** Enter sends; Shift+Enter inserts a newline. */
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="bg-background p-4">
      <div className="relative mx-auto flex max-w-3xl items-end gap-2">
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          className="max-h-[200px] min-h-[50px] resize-none rounded-xl border-muted-foreground/20 py-3 pr-12 shadow-sm focus-visible:ring-primary/20"
          rows={1}
          disabled={isPending}
        />

        <Button
          onClick={submit}
          disabled={!canSubmit}
          size="icon"
          aria-label="Send message"
          className={cn(
            "absolute right-2 bottom-2 rounded-lg transition-all duration-200",
            value.trim()
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-90 opacity-0",
          )}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <p className="mt-3 text-center text-[10px] text-muted-foreground">
        AI can make mistakes. Please check important information.
      </p>
    </div>
  )
}
