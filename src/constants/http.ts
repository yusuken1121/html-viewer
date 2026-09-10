/**
 * HTTP header names shared between the Edge middleware, Node Route Handlers
 * and the browser. Kept free of any runtime-specific import so all three can
 * use it.
 */
export const REQUEST_ID_HEADER = "x-request-id"
export const NONCE_HEADER = "x-nonce"
