import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import type {
  IFileStorage,
  PresignedUpload,
} from "@/core/ports/file-storage.port"
import { optionalEnv, serverEnv } from "@/lib/env"

const DEFAULT_UPLOAD_TTL_SECONDS = 300
const DEFAULT_DOWNLOAD_TTL_SECONDS = 900

/**
 * Object storage over the S3 API.
 *
 * Works unchanged against AWS S3, Cloudflare R2, MinIO and Backblaze B2 — set
 * S3_ENDPOINT for anything that is not AWS. R2 additionally needs
 * `forcePathStyle`, which is why it is configurable rather than assumed.
 */
export class S3FileStorage implements IFileStorage {
  private readonly client: S3Client
  private readonly bucket: string

  constructor() {
    const endpoint = optionalEnv("S3_ENDPOINT", "")

    this.bucket = serverEnv("S3_BUCKET")
    this.client = new S3Client({
      region: optionalEnv("S3_REGION", "auto"),
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: serverEnv("S3_ACCESS_KEY_ID"),
        secretAccessKey: serverEnv("S3_SECRET_ACCESS_KEY"),
      },
    })
  }

  /**
   * The browser PUTs straight to the bucket.
   *
   * `ContentLength` is part of the signature when maxBytes is given, so an
   * oversized upload is rejected by the object store itself — the server never
   * sees the bytes and cannot be made to buffer them.
   */
  async createUploadUrl(input: {
    key: string
    contentType: string
    maxBytes?: number
  }): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ContentType: input.contentType,
      ...(input.maxBytes ? { ContentLength: input.maxBytes } : {}),
    })

    const url = await getSignedUrl(this.client, command, {
      expiresIn: DEFAULT_UPLOAD_TTL_SECONDS,
    })

    return {
      url,
      key: input.key,
      expiresInSeconds: DEFAULT_UPLOAD_TTL_SECONDS,
    }
  }

  async createDownloadUrl(
    key: string,
    expiresInSeconds = DEFAULT_DOWNLOAD_TTL_SECONDS,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    )
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    )
  }
}

export function createFileStorage(): IFileStorage {
  return new S3FileStorage()
}
