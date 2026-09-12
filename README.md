# HTML Viewer

Claude に作らせた HTML（講義スライド・ノート）を、スマホでもタブレットでも開けるようにする個人用アプリです。
保管庫は **Notion データベース**。行に HTML ファイルを添付すると、一覧に現れて iframe で表示されます。

```
Notion DB（1行 = 1ドキュメント、File 列に HTML）
   │  Notion API（サーバー側で取得・プロキシ）
   ▼
Next.js  /            一覧（検索・カテゴリ絞り込み）
         /docs/[id]   全画面ビューア（iframe）
         /api/docs/*  一覧・メタデータ・HTML 本体
```

認証はありません。個人利用前提で、公開 URL に置く場合は Vercel の
パスワード保護などを前に置いてください（`src/middleware.ts` 冒頭のコメント参照）。

## セットアップ

```bash
pnpm install
cp .env.example .env.local
```

1. Notion 側の準備は [docs/notion-setup.md](docs/notion-setup.md) の手順どおり（5 分ほど）
2. `.env.local` に `NOTION_TOKEN` と `NOTION_DOCS_DATABASE_ID` を入れる
3. `pnpm dev` → http://localhost:3000

### Notion なしで試す

```bash
mkdir -p content && cp ~/Downloads/*.html content/
DOCS_SOURCE=local pnpm dev
```

`content/` 内の `.html` がそのまま一覧になります（`.gitignore` 済み）。

## ドキュメントの追加

- **アプリで**: 右上の「追加」→ HTML をドロップ → タイトルは `<title>` から自動入力 → アップロード
- **Notion で**: 行を追加して File 列に HTML をドラッグ（スマホからも可）
- **ターミナルで**: `pnpm docs:push lecture.html --category SAA --tags IAM,VPC`

アプリからのアップロードは、環境変数 `DOCS_UPLOAD_SECRET` を設定すると
そのキーを知る人だけができます。公開 URL に置くなら必ず設定してください。
ローカルモード（`DOCS_SOURCE=local`）ではファイルが `content/` に保存され、
カテゴリとタグは保持されません。

## デプロイ（Vercel）

リポジトリを Vercel にインポートし、環境変数に `NOTION_TOKEN`、
`NOTION_DOCS_DATABASE_ID`、`DOCS_UPLOAD_SECRET`（必要なら `NEXT_PUBLIC_APP_URL`）
を設定するだけです。
Dockerfile も同梱しているので、任意の Node ホストでも動きます。

## 構成

Clean Architecture のテンプレートを土台にしています。層のルールは ESLint が強制します。

```
src/
├── core/                  エンティティ（HtmlDocument）とポート（IDocumentRepository）
├── infrastructure/
│   ├── notion/            NotionDocumentRepository — Notion を保管庫にする実装
│   └── fs/                LocalDocumentRepository — content/ フォルダを保管庫にする実装
├── features/docs/         ユースケース・Zod スキーマ・React Query フック・UI
├── app/api/docs/          Route Handler（Composition Root）
├── app/(app)/             サイドバー付きシェル：一覧・設定
└── app/(viewer)/docs/[id] シェルなしの全画面ビューア
```

`/api/docs/[id]/content` だけは iframe に表示されるため、アプリ本体の CSP と
`X-Frame-Options: DENY` の対象外にしています（`src/middleware.ts` と `next.config.ts`）。

詳しい設計ルールは [`.cursor/skills/`](.cursor/skills/) を参照してください。

## スクリプト

```bash
pnpm dev            # 開発サーバー
pnpm build          # 本番ビルド
pnpm check          # format:check + lint + type-check + test
pnpm test:e2e       # Playwright（ローカル保管庫で自己完結）
pnpm docs:push      # HTML を Notion にアップロード
```
