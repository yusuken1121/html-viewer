import { ENGLISH_API } from "@/features/english/english.api.config"
import { collectionContentRoute } from "@/lib/collections/collection.routes"

export const dynamic = "force-dynamic"

export const { GET } = collectionContentRoute(ENGLISH_API)
