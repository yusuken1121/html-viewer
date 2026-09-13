"use client"

import { KeyRound } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * The shared-secret field, shown only once a write has come back 401.
 *
 * Every write verb needs the key, so the field lives next to whichever action
 * discovered it was missing — asking the user to go to the upload page just
 * to register a key would strand them mid-edit.
 */
export function UploadKeyField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4">
      <Label htmlFor={id} className="flex items-center gap-2">
        <KeyRound className="size-4" aria-hidden="true" />
        アップロードキー
      </Label>
      <Input
        id={id}
        type="password"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="サーバーの DOCS_UPLOAD_SECRET"
      />
      <p className="text-xs text-muted-foreground">
        一度通ればこのブラウザに記憶されます。
      </p>
    </div>
  )
}
