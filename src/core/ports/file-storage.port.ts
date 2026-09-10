export interface StoredFile {
  key: string
  size: number
  contentType: string
}

export interface PresignedUpload {
  /** PUT the file here. Expires. */
  url: string
  key: string
  expiresInSeconds: number
}

/**
 * File Storage Port.
 *
 * Presigned URLs rather than proxying bytes: a Route Handler that streams
 * uploads through the server burns memory and hits serverless body limits.
 * The browser talks to the object store directly; the server only signs.
 */
export interface IFileStorage {
  createUploadUrl(input: {
    key: string
    contentType: string
    maxBytes?: number
  }): Promise<PresignedUpload>

  createDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>

  delete(key: string): Promise<void>
}
