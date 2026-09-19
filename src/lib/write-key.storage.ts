/** Where the browser keeps it. Changing this logs every browser out of writes. */
const WRITE_KEY_STORAGE_KEY = "html-viewer.upload-key"

/**
 * The shared secret for writes, remembered in this browser.
 *
 * Every write — uploading a document, editing or deleting one, registering a
 * news or English item — needs it when the server sets a secret, so it is read
 * from one place instead of being kept inside whichever form asked first. Storage can throw
 * (private mode, blocked site data); the key then simply has to be typed
 * again, which is why nothing here reports an error.
 */
export function readUploadKey(): string {
  try {
    return window.localStorage.getItem(WRITE_KEY_STORAGE_KEY) ?? ""
  } catch {
    return ""
  }
}

export function storeUploadKey(key: string): void {
  try {
    if (key) window.localStorage.setItem(WRITE_KEY_STORAGE_KEY, key)
    else window.localStorage.removeItem(WRITE_KEY_STORAGE_KEY)
  } catch {
    // Nothing to do — the form asks for it again next time.
  }
}
