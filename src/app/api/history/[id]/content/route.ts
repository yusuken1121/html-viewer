import { HISTORY_API } from "@/features/history/history.api.config"
import { collectionContentRoute } from "@/lib/collections/collection.routes"

export const dynamic = "force-dynamic"

export const { GET } = collectionContentRoute(HISTORY_API)
