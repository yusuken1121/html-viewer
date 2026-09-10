import type { NotionDatabaseConfig } from "@/infrastructure/notion"
import { serverEnv } from "@/lib/env"
import type { ContactSubmission } from "../domain/contact-submission.entity"

/**
 * Maps a `ContactSubmission` onto the columns of the Notion database.
 *
 * A function, not a constant: reading `process.env` at module scope would bake
 * the build-time value into the bundle and hide a missing variable until a
 * request fails.
 */
export function createContactNotionConfig(): NotionDatabaseConfig<ContactSubmission> {
  return {
    databaseId: serverEnv("NOTION_CONTACT_DATABASE_ID"),
    fields: [
      { recordKey: "name", propertyName: "Name", type: "title" },
      { recordKey: "email", propertyName: "Email", type: "rich_text" },
      { recordKey: "message", propertyName: "Message", type: "rich_text" },
    ],
  }
}
