import { HISTORY_API } from "@/features/history/history.api.config"
import { collectionRoutes } from "@/lib/collections/collection.routes"

export const dynamic = "force-dynamic"

export const { GET, POST } = collectionRoutes(HISTORY_API)
