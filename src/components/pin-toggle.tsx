"use client"

import { Pin } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type PinControl = {
  pinned: boolean
  onToggle: () => void
  pending: boolean
}

/**
 * The pin in the viewer header. Pressed when the item is pinned; the label
 * says what pressing it will do, which is what a screen reader user needs.
 */
export function PinToggle({ pinned, onToggle, pending }: PinControl) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-pressed={pinned}
      aria-label={pinned ? "ピン留めを外す" : "ピン留めする"}
      title={pinned ? "ピン留めを外す" : "ピン留めする"}
      onClick={onToggle}
      disabled={pending}
    >
      {/* Filled when pinned, as on the list rows; outlined when not. */}
      <Pin
        className={cn("size-4", pinned && "fill-current text-amber-500")}
        aria-hidden="true"
      />
    </Button>
  )
}
