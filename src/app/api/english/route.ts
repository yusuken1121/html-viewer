import { ENGLISH_API } from "@/features/english/english.api.config"
import { collectionRoutes } from "@/lib/collections/collection.routes"

export const dynamic = "force-dynamic"

export const { GET, POST } = collectionRoutes(ENGLISH_API)
