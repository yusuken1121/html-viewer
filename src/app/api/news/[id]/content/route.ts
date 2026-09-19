import { NEWS_API } from "@/features/news/news.api.config"
import { collectionContentRoute } from "@/lib/collections/collection.routes"

export const dynamic = "force-dynamic"

export const { GET } = collectionContentRoute(NEWS_API)
