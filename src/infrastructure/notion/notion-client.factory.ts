import { Client } from "@notionhq/client"
import { serverEnv } from "@/lib/env"

export class NotionClientFactory {
  static create(token?: string): Client {
    return new Client({ auth: token ?? serverEnv("NOTION_TOKEN") })
  }
}
