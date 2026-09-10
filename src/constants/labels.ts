/**
 * Japanese labels used by the global Zod error map (`src/lib/zod/zod-config.ts`).
 * The key must match the field name used in the schema — add an entry whenever
 * a form introduces a new field, otherwise messages fall back to "対象の項目".
 */
export const FIELD_LABELS = {
  id: "ドキュメントID",
  title: "タイトル",
  content: "コンテンツ",
  name: "氏名",
  email: "メールアドレス",
  password: "パスワード",
  message: "メッセージ",
} as const
