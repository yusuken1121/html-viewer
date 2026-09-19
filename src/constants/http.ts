/**
 * HTTP header names shared between the Edge middleware, Node Route Handlers
 * and the browser. Kept free of any runtime-specific import so all three can
 * use it.
 */
export const REQUEST_ID_HEADER = "x-request-id"
export const NONCE_HEADER = "x-nonce"

/**
 * The shared secret that guards every write — uploading, editing, deleting a
 * document, and registering news. One header, so one key in one place lets a
 * script do all of them.
 */
export const WRITE_KEY_HEADER = "x-upload-key"
