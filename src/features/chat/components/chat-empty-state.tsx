import { Bot } from "lucide-react"

/**
 * `opacity-50` on the wrapper used to dim this whole block, which halved the
 * contrast of the text inside and failed WCAG AA at 2.05:1 — the colour tokens
 * were correct, the opacity was not. Dim the decorative icon instead; the
 * words stay readable.
 */
export function ChatEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-4 pt-20 text-center">
      <Bot className="h-16 w-16 text-muted-foreground/40" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-lg font-medium">No messages yet</p>
        <p className="text-sm text-muted-foreground">
          Start a conversation to see the magic happen.
        </p>
      </div>
    </div>
  )
}
