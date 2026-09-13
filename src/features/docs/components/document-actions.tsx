"use client"

import { useState } from "react"
import { MoreVertical, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { DocumentDto } from "../docs.schema"
import { DocumentDeleteDialog } from "./document-delete-dialog"
import { DocumentEditDialog } from "./document-edit-dialog"

/**
 * The edit/delete menu for one document, used both on a library card and in
 * the viewer header.
 *
 * It owns the two dialogs rather than the card does, so the menu can close
 * the moment an item is chosen while the dialog it opened stays mounted.
 */
export function DocumentActions({
  document,
  onDeleted,
  className,
}: {
  document: DocumentDto
  onDeleted?: () => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-8", className)}
            aria-label={`${document.title} の操作`}
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden="true" />
            編集
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleting(true)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DocumentEditDialog
        document={document}
        open={editing}
        onOpenChange={setEditing}
      />
      <DocumentDeleteDialog
        document={document}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={onDeleted}
      />
    </>
  )
}
