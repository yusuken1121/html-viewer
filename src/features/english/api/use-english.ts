"use client"

import { createCollectionHooks } from "@/lib/collections/use-collection"
import { ENGLISH_ENDPOINT } from "../english.config"

const hooks = createCollectionHooks("english", ENGLISH_ENDPOINT)

export const englishKeys = hooks.keys
export const useEnglish = hooks.useCollection
export const useEnglishItem = hooks.useCollectionItem
