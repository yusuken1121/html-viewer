import { ENGLISH_API } from "@/features/english/english.api.config"
import { collectionItemRoutes } from "@/lib/collections/collection.routes"

export const dynamic = "force-dynamic"

export const { GET, PATCH, DELETE } = collectionItemRoutes(ENGLISH_API)
