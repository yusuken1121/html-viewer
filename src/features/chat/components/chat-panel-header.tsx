import { Bot, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CHAT_MODEL_LABEL } from "../chat.config"

export function ChatPanelHeader() {
  return (
    <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">AI Assistant</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            Online &amp; Ready
          </p>
        </div>
      </div>

      <Badge variant="outline" className="hidden gap-1 sm:flex">
        <Sparkles className="h-3 w-3 text-orange-400" />
        {CHAT_MODEL_LABEL}
      </Badge>
    </div>
  )
}
