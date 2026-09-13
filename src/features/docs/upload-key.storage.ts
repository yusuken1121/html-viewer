import { UPLOAD_KEY_STORAGE_KEY } from "./docs.config"

/**
 * The shared secret for writes, remembered in this browser.
 *
 * Every write verb — upload, edit, delete — needs it when the server sets
 * `DOCS_UPLOAD_SECRET`, so it is read from one place instead of being kept
 * inside whichever form happened to ask for it first. Storage can throw
 * (private mode, blocked site data); the key then simply has to be typed
 * again, which is why nothing here reports an error.
 */
export function readUploadKey(): string {
  try {
    return window.localStorage.getItem(UPLOAD_KEY_STORAGE_KEY) ?? ""
  } catch {
    return ""
  }
}

export function storeUploadKey(key: string): void {
  try {
    if (key) window.localStorage.setItem(UPLOAD_KEY_STORAGE_KEY, key)
    else window.localStorage.removeItem(UPLOAD_KEY_STORAGE_KEY)
  } catch {
    // Nothing to do — the form asks for it again next time.
  }
}
