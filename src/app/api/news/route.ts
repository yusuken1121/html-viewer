import { NEWS_API } from "@/features/news/news.api.config"
import { collectionRoutes } from "@/lib/collections/collection.routes"

export const dynamic = "force-dynamic"

export const { GET, POST } = collectionRoutes(NEWS_API)
