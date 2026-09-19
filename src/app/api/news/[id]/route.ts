import { NEWS_API } from "@/features/news/news.api.config"
import { collectionItemRoutes } from "@/lib/collections/collection.routes"

export const dynamic = "force-dynamic"

export const { GET, PATCH, DELETE } = collectionItemRoutes(NEWS_API)
