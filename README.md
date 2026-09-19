# HTML Viewer

Claude に作らせた HTML（講義スライド・ノート）を、スマホでもタブレットでも開けるようにする個人用アプリです。
保管庫は **Notion データベース**。行に HTML ファイルを添付すると、一覧に現れて iframe で表示されます。

```
Notion DB（1行 = 1ドキュメント、File 列に HTML）
   │  Notion API（サーバー側で取得・プロキシ）
   ▼
Next.js  /            一覧（検索・カテゴリ絞り込み）
         /docs/[id]   全画面ビューア（iframe）
         /news        ニュース一覧（別 DB・別ページ）
         /english     英語教材一覧（別 DB・別ページ）
         /news/[id]   全画面ビューア（iframe）
         /english/[id]
         /api/docs/*     一覧・メタデータ・HTML 本体・編集・削除
         /api/news/*     取得・登録・HTML 本体・編集・削除
         /api/english/*  同上
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

- **アプリで**: 「アップロード」ページで保存先（ライブラリ／ニュース／英語）を選び、
  HTML をドロップ → タイトルは `<title>` から自動入力 → アップロード。
  ニュースと英語では公開日も指定できます（空欄なら今の日時）。
- **Notion で**: 行を追加して File 列に HTML をドラッグ（スマホからも可）
- **ターミナルで**: `pnpm docs:push lecture.html --category SAA --tags IAM,VPC`
  （ニュースと英語は `POST /api/news` / `POST /api/english`。下の API 節を参照）

アプリからのアップロードは、環境変数 `DOCS_UPLOAD_SECRET` を設定すると
そのキーを知る人だけができます。公開 URL に置くなら必ず設定してください。
ローカルモード（`DOCS_SOURCE=local`）ではファイルが `content/` に保存され、
カテゴリとタグは保持されません。

## ドキュメントの修正・削除

カードの右上（ビューアではヘッダー右端）の「⋮」から行います。

- **編集**: タイトル・カテゴリ・タグを直します。HTML ファイル自体は変わりません。
  ファイルを間違えたときは、削除してアップロードし直してください。
- **削除**: Notion のゴミ箱に移すだけなので、Notion 側から元に戻せます。

編集と削除もアップロードと同じ `DOCS_UPLOAD_SECRET` で保護されます。
ローカルモード（`DOCS_SOURCE=local`）では、タイトルの変更は HTML の
`<title>` を書き換えることで行い（カテゴリとタグは変更できません）、
削除したファイルは `content/.trash/` に移動します。

## ニュースと英語

学習メモ（ライブラリ）とは別に、**新着順で並ぶコレクション**が 2 つあります。

| ページ     | API            | Notion DB                    | 用途               |
| :--------- | :------------- | :--------------------------- | :----------------- |
| `/news`    | `/api/news`    | `NOTION_NEWS_DATABASE_ID`    | AWS の更新情報など |
| `/english` | `/api/english` | `NOTION_ENGLISH_DATABASE_ID` | 英語学習の教材     |

中身の仕組みはライブラリとまったく同じで、**Notion の行に添付した HTML
ファイル**を iframe で表示します。違うのは並び順（公開日の新しい順）と、
Notion のデータベースが別なことだけです。準備は
[docs/notion-setup.md](docs/notion-setup.md) を参照してください。

```bash
pnpm news:init-db <親ページの URL>      # → NOTION_NEWS_DATABASE_ID
pnpm english:init-db <親ページの URL>   # → NOTION_ENGLISH_DATABASE_ID
```

登録は 3 通りです。アプリの「アップロード」ページで保存先を選ぶ、API を叩く、
Notion で直接行に HTML をドラッグする。一覧と個別ページは読むだけで、
編集と削除は API か Notion 側で行います。

### API

`{collection}` は `news` か `english` です。2 つは同じ実装なので、
エンドポイントの形も動きもまったく同じです。

| メソッド | パス                             | 用途                                         |
| :------- | :------------------------------- | :------------------------------------------- |
| `GET`    | `/api/{collection}`              | 一覧（`?tag=` で絞り込み、`?limit=` で上限） |
| `POST`   | `/api/{collection}`              | 登録（HTML ファイル）                        |
| `GET`    | `/api/{collection}/{id}`         | 1 件のメタデータ                             |
| `GET`    | `/api/{collection}/{id}/content` | HTML 本体（iframe が読む先）                 |
| `PATCH`  | `/api/{collection}/{id}`         | タイトル・カテゴリ・タグ・公開日を編集       |
| `DELETE` | `/api/{collection}/{id}`         | 削除（Notion のゴミ箱へ移動）                |

登録は 2 通りあります。スクリプトからは JSON が簡単です。`title` を省くと
HTML の `<title>` から、`publishedAt` を省くと現在時刻が入ります。

```bash
curl -X POST http://localhost:3000/api/english \
  -H "Content-Type: application/json" \
  -H "x-upload-key: $DOCS_UPLOAD_SECRET" \
  -d '{
    "fileName": "phrasal-verbs-01.html",
    "html": "<!doctype html><html><head><title>句動詞 20 選</title></head><body>…</body></html>",
    "category": "語彙",
    "tags": ["句動詞", "TOEIC"],
    "publishedAt": "2026-09-18T09:00:00Z"
  }'
```

フォームから送るなら multipart も受け付けます。`file` パートが HTML 本体です。

```bash
curl -X POST http://localhost:3000/api/news \
  -H "x-upload-key: $DOCS_UPLOAD_SECRET" \
  -F "file=@weekly-aws-0914.html" \
  -F "category=AWS" -F "tags=S3,ストレージ"
```

書き込み系（`POST` / `PATCH` / `DELETE`）は、`DOCS_UPLOAD_SECRET` を設定していると
`x-upload-key` ヘッダーが必須になります。アップロードと同じキーなので、
1 つ設定すれば全部に使えます。コレクションごとに鍵を分けたい場合は
`NEWS_API_SECRET` / `ENGLISH_API_SECRET` を設定してください。未設定なら鍵なしで
書き込めます（公開 URL では必ず設定を）。

ファイルの制限はライブラリと同じで、拡張子は `.html` / `.htm`、上限 10 MB です。
`PATCH` で差し替えられるのはメタデータだけで、HTML 本体は入れ替えません
（別の内容なら別の行として登録してください）。

### 3 つ目を足すとき

2 つのコレクションは設定だけが違う同じコードです。共通部分は
`src/lib/collections/`（Zod スキーマ・ユースケース・Route Handler）と
`src/core/domain/collection-item.entity.ts` にあり、features 側には
設定と薄い画面しかありません。追加は次の 5 か所です。

1. `src/features/<name>/` に `*.config.ts` と `*.api.config.ts`、画面 2 つ
2. `src/app/api/<name>/` に 3 行の Route Handler を 3 つ
3. `src/app/(app)/<name>/page.tsx` と `src/app/(viewer)/<name>/[id]/page.tsx`
4. `src/constants/path.ts` と `src/constants/sidebar.tsx`
5. `next.config.ts` の `FRAMED_COLLECTIONS`、`src/middleware.ts` の
   `FRAMED_CONTENT_PATH`、`scripts/init-collection-db.ts` の `COLLECTIONS`

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
