/** Reference to a page created in a Notion database. */
export type NotionPageRef = {
  id: string
  url: string
}

export function toNotionPageUrl(pageId: string): string {
  return `https://notion.so/${pageId.replace(/-/g, "")}`
}
