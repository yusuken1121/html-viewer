export type NotionFieldType =
  | "title"
  | "rich_text"
  | "number"
  | "date"
  | "select"
  | "files"
  | "checkbox"
  | "url"

export type NotionFieldMapping<TRecord> = {
  /** Omit when using transform-only fields (e.g. derived title). */
  recordKey?: keyof TRecord & string
  propertyName: string
  type: NotionFieldType
  transform?: (value: unknown, record: TRecord) => unknown
}

export type NotionDatabaseConfig<TRecord> = {
  /** The id in the database URL. Used for writes and to find the data source. */
  databaseId: string
  /**
   * Notion API v5 splits a database into one or more **data sources**, and
   * queries address the data source, not the database. The repository resolves
   * this from `databaseId` on first use, which is right for the ordinary
   * one-data-source database. Set it explicitly only when a database has
   * several and you mean a particular one.
   */
  dataSourceId?: string
  fields: Array<NotionFieldMapping<TRecord>>
}
