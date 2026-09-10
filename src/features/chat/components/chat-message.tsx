import { Bot, User } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message } from "@/core/domain/message.entity"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user"
  const isSystem = message.role === "system"

  return (
    <div
      className={cn(
        "flex w-full items-start gap-3 duration-300 animate-in fade-in slide-in-from-bottom-2",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback
          className={cn(
            isUser ? "bg-primary text-primary-foreground" : "bg-muted border",
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "relative max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm",
          isUser
            ? "rounded-tr-none bg-primary text-primary-foreground"
            : "rounded-tl-none border bg-muted/50 text-foreground",
        )}
      >
        {isSystem ? (
          <p className="font-medium text-destructive">{message.content}</p>
        ) : (
          <div className="leading-relaxed whitespace-pre-wrap">
            {message.content || <span className="animate-pulse">...</span>}
          </div>
        )}

        <div
          className={cn(
            "mt-1 flex w-full text-[10px] opacity-50",
            isUser
              ? "justify-end text-primary-foreground/70"
              : "justify-start text-muted-foreground",
          )}
        >
          {message.createdAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  )
}
