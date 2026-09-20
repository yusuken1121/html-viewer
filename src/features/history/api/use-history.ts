"use client"

import { createCollectionHooks } from "@/lib/collections/use-collection"
import { HISTORY_ENDPOINT } from "../history.config"

const hooks = createCollectionHooks("history", HISTORY_ENDPOINT)

export const historyKeys = hooks.keys
export const useHistory = hooks.useCollection
export const useHistoryItem = hooks.useCollectionItem
