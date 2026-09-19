import type { Metadata } from "next"
import { UploadForm, type UploadDestination } from "@/components/upload-form"
import { PATH } from "@/constants/path"
import { DOCS_ENDPOINT } from "@/features/docs/docs.config"
import {
  ENGLISH_ENDPOINT,
  ENGLISH_LABEL,
} from "@/features/english/english.config"
import { NEWS_ENDPOINT, NEWS_LABEL } from "@/features/news/news.config"

export const metadata: Metadata = { title: "アップロード" }

/**
 * Where an upload may go.
 *
 * The page is the only place that knows every collection — the form takes
 * this list as data, and each feature contributes nothing but its own
 * constants, so neither feature imports the other.
 */
const DESTINATIONS: UploadDestination[] = [
  {
    key: "docs",
    label: "ライブラリ",
    endpoint: DOCS_ENDPOINT,
    viewerBase: PATH.DOCS,
    dated: false,
  },
  {
    key: "news",
    label: NEWS_LABEL,
    endpoint: NEWS_ENDPOINT,
    viewerBase: PATH.NEWS,
    dated: true,
  },
  {
    key: "english",
    label: ENGLISH_LABEL,
    endpoint: ENGLISH_ENDPOINT,
    viewerBase: PATH.ENGLISH,
    dated: true,
  },
]

export default function UploadPage() {
  return <UploadForm destinations={DESTINATIONS} />
}
