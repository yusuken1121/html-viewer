import axios, { AxiosError } from "axios"

/**
 * Base URL for client-side requests.
 * Empty string = same origin, which is the default for this template.
 * Set NEXT_PUBLIC_USE_MOCK=true to point every call at a mock server instead.
 */
const isMockEnabled = process.env.NEXT_PUBLIC_USE_MOCK === "true"

export const API_BASE_URL =
  (isMockEnabled
    ? process.env.NEXT_PUBLIC_MOCK_API_URL
    : process.env.NEXT_PUBLIC_API_URL) ?? ""

/** Normalized client-side error carrying the server's own message. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = "ApiError"
  }
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
})

/**
 * Route Handlers answer failures with `{ error: string }` (see
 * `handleRouteError`). Surface that message instead of Axios' generic
 * "Request failed with status code 4xx", which is what reaches `toast.error`.
 */
function toApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const body: unknown = error.response?.data
    const serverMessage =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : undefined

    return new ApiError(
      serverMessage ?? error.message,
      error.response?.status,
      {
        cause: error,
      },
    )
  }

  return new ApiError(
    error instanceof Error ? error.message : "Unknown network error",
    undefined,
    { cause: error },
  )
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
)

export async function apiGet<TResponse>(url: string): Promise<TResponse> {
  const response = await apiClient.get<TResponse>(url)
  return response.data
}

export async function apiPost<TResponse, TBody = unknown>(
  url: string,
  body: TBody,
): Promise<TResponse> {
  const response = await apiClient.post<TResponse>(url, body)
  return response.data
}

/**
 * POST that returns the raw `Response` so the caller can read a stream.
 * Axios buffers the whole body, so streaming endpoints use `fetch` directly —
 * error normalization stays identical to `apiPost`.
 */
export async function apiPostStream<TBody = unknown>(
  url: string,
  body: TBody,
): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/plain" },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response
      .json()
      .then((data: unknown) =>
        typeof data === "object" && data !== null && "error" in data
          ? String((data as { error: unknown }).error)
          : undefined,
      )
      .catch(() => undefined)

    throw new ApiError(
      detail ?? `Request failed with status ${response.status}`,
      response.status,
    )
  }

  return response
}
