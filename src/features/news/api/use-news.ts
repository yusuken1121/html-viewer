"use client"

import { createCollectionHooks } from "@/lib/collections/use-collection"
import { NEWS_ENDPOINT } from "../news.config"

const hooks = createCollectionHooks("news", NEWS_ENDPOINT)

export const newsKeys = hooks.keys
export const useNews = hooks.useCollection
export const useNewsItem = hooks.useCollectionItem
