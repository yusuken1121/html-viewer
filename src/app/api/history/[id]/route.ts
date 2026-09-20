import { HISTORY_API } from "@/features/history/history.api.config"
import { collectionItemRoutes } from "@/lib/collections/collection.routes"

export const dynamic = "force-dynamic"

export const { GET, PATCH, DELETE } = collectionItemRoutes(HISTORY_API)
