# 初心者向け：コードの読み方と Clean Architecture 入門

このドキュメントは、このプロジェクトの**コードをどう読めばいいか**と、**なぜこの構成になっているか**を、実際のファイルを交えて説明します。

> 詳細ルールは [`.cursor/skills/`](../.cursor/skills/) に集約されています。  
> このガイドは「最初の1周」を目的とした読み物です。

---

## 1. まず覚える1行

このアプリのデータの流れは次のとおりです。

```
UI → React Query → /api/* → Use Case → Infrastructure
```

**日本語にすると：**

1. ユーザーが画面で操作する（UI）
2. React Query のフックが API を呼ぶ（クライアント）
3. Next.js の Route Handler がリクエストを受ける（サーバー入口）
4. Use Case がビジネスロジックを実行する（アプリの心臓）
5. Infrastructure が Gemini や Notion など外部サービスと通信する（具体実装）

---

## 2. なぜレイヤーに分けるのか？

### たとえ話：レストラン

| レイヤー           | レストランでの役割                             | このプロジェクトでの例         |
| ------------------ | ---------------------------------------------- | ------------------------------ |
| **UI**             | お客さんが注文するカウンター                   | `ChatInterface` コンポーネント |
| **Client Data**    | ウェイター（注文を厨房に伝える）               | `useSendMessageStream` フック  |
| **Route Handler**  | 受付（注文票をチェックする）                   | `/api/chat/route.ts`           |
| **Use Case**       | シェフ（調理の手順を決める）                   | `SendMessageUseCase`           |
| **Port**           | レシピの「調味料は何でもよい」と書いてある部分 | `IAIGateway` インターフェース  |
| **Infrastructure** | 実際の調味料（Gemini SDK など）                | `GeminiGateway`                |

**ポイント：** シェフ（Use Case）は「Gemini という調味料」ではなく、「AI ゲートウェイという抽象」にだけ依存します。  
将来 OpenAI に変えても、シェフのレシピ（Use Case）は変更不要、という設計です。

---

## 3. フォルダ構成：どこに何があるか

このプロジェクトには**2つの軸**があります。

- **レイヤー**（どんな種類のコードか）… `domain` / `ports` / `use-cases` / `infrastructure`
- **スライス**（どの機能のものか）… `features/chat` / `features/contact`

```text
src/
├── app/                    # ルーティングだけ。画面と API の入口
│   ├── page.tsx            # トップページ（/）
│   └── api/                # Route Handler（Composition Root）
│
├── core/                   # ★ 機能に依存しない共有カーネル（外部ライブラリ禁止）
│   ├── domain/             # 共通の Entity・値オブジェクト・DomainError
│   ├── ports/              # インターフェース（約束）
│   └── use-cases/          # 汎用のビジネスロジック
│
├── infrastructure/         # 外部サービスの具体実装（機能に依存しない）
│   ├── gemini/
│   └── notion/
│
├── features/               # ★ 機能のタテ切り。フォルダごと消せば機能が消える
│   ├── chat/               #   domain / use-cases / api / hooks / components
│   └── contact/
│
├── components/             # 共通 UI（components/ui は shadcn/ui）
│
└── lib/
    ├── api/api-client.ts   # フロントから API を呼ぶ共通クライアント
    ├── env.ts              # サーバー側の環境変数（遅延バリデーション）
    └── route-error.ts      # 例外 → HTTP レスポンス変換
```

**なぜ `features/` があるのか：**
新しいプロジェクトを始めるとき、サンプル機能（Chat・Contact）を消したくなります。
機能が `core` にも `lib` にも `app` にも散らばっていると「どこまで消していいか」が分かりません。
`features/chat/` を丸ごと削除 → 対応する `app/api/chat/` と `constants/sidebar.tsx` の1行を消す、
それだけで機能が完全に消えるようにしてあります。

逆に `core/` と `infrastructure/` は**機能に依存しません**。
Notion アダプタは「どんなレコードでも書ける」汎用実装なので、Contact 機能を消しても残ります。

**初心者が最初に読む順番（Chat 機能）：**

1. `src/app/page.tsx` — 何が表示されるか
2. `src/features/chat/components/chat-interface.tsx` — 画面の組み立て
3. `src/features/chat/hooks/use-chat-stream.ts` — ユーザー操作と状態管理
4. `src/features/chat/api/use-chat.ts` — API 呼び出し
5. `src/app/api/chat/route.ts` — サーバー入口
6. `src/features/chat/use-cases/send-message.use-case.ts` — ビジネスロジック
7. `src/infrastructure/gemini/gemini-chat.gateway.ts` — Gemini 連携
8. `src/infrastructure/anthropic/anthropic-chat.gateway.ts` — 同じ Port の別実装

---

## 4. レイヤー別：実際のコードで理解する

### 4-1. Domain（ドメイン）— 「データの形」

**役割：** アプリが扱うデータを TypeScript の型で表現する。  
React も Next.js も Gemini も import しない、**純粋な TypeScript だけ**。

```typescript
// src/core/domain/message.entity.ts
export interface Message {
  id: string
  role: MessageRole
  content: string
  createdAt: Date
  metadata?: Record<string, unknown>
}
```

`Message` は「チャットの1メッセージがどんな形か」を定義しています。  
`createMessage()` はその形のオブジェクトを作る工場関数です。

ドメインのルール違反は `DomainError` を継承した例外で表します。

```typescript
// src/features/chat/domain/message.validation.ts
import { DomainError } from "@/core/domain/domain.error"

export class InvalidMessageHistoryError extends DomainError {}
```

`DomainError` を継承しておくと、Route Handler 側の `handleRouteError` が
**自動的に HTTP 400 に変換**してくれます。新しいエラーを足しても Route の修正は不要です。

**読み方のコツ：** Domain ファイルは「名詞の定義」。ロジックは少なめ、型と factory が中心。

**`core/domain` と `features/*/domain` の使い分け：**
複数の機能で使うものは `core/domain`（`Message` は AI 機能なら全部使う）。
1つの機能でしか使わないものは `features/<機能>/domain`（`ContactSubmission` は Contact だけ）。

---

### 4-2. Port（ポート）— 「約束・インターフェース」

**役割：** 外部サービス（AI、DB など）に対する**約束**を interface で書く。  
実装は書かない。「こういうメソッドがあれば動く」という契約書。

```typescript
// src/core/ports/ai-gateway.port.ts
export interface IAIGateway {
  generateStream(
    messages: Message[],
    options?: AIGenerateOptions,
  ): Promise<ReadableStream<string>>

  generate(messages: Message[], options?: AIGenerateOptions): Promise<string>
}
```

Use Case は `GeminiGateway` ではなく `IAIGateway` だけを知っています。  
これが **依存性逆転の原則（DIP）** です。

**読み方のコツ：** Port は `I` で始まる interface が多い（`IAIGateway`, `INotionRecordWriter`）。

---

### 4-3. Use Case（ユースケース）— 「ビジネスロジック」

**役割：** 「メッセージを送って AI から返答をもらう」など、アプリ固有の処理手順を書く。  
Port（interface）だけに依存し、Gemini SDK などには直接触らない。

```typescript
// src/features/chat/use-cases/send-message.use-case.ts
export class SendMessageUseCase {
  constructor(private readonly aiGateway: IAIGateway) {}

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    assertValidMessageHistory(input.messages)

    const stream = await this.aiGateway.generateStream(
      input.messages,
      input.options,
    )

    return { stream }
  }
}
```

**3つのポイント：**

1. **constructor で Port を受け取る** — 外から注入（DI）される
2. **`execute()` が入口** — 「このユースケースを実行する」メソッド
3. **ドメインルールの検証もここ** — 「ユーザーメッセージが1つ以上必要」などのルール

Notion の例も同じパターンです。こちらは機能に依存しない汎用 Use Case なので `core/` にあります。

```typescript
// src/core/use-cases/create-notion-record.use-case.ts
export class CreateNotionRecordUseCase<TRecord> {
  constructor(
    private readonly writer: INotionRecordWriter<TRecord>,
    private readonly validate?: RecordValidator<TRecord>,
  ) {}

  async execute(record: TRecord): Promise<NotionPageRef> {
    this.validate?.(record)
    return this.writer.create(record)
  }
}
```

「どんなレコードを書くか」も「どう検証するか」も外から渡すので、
Contact 以外のフォームでもそのまま使い回せます。

**読み方のコツ：** Use Case は「ルールの検証 + Port の呼び出し」。UI や HTTP のことは書いていない。

---

### 4-4. Infrastructure（インフラ）— 「外部サービスの具体実装」

**役割：** Port の interface を**実際に実装**する。Gemini SDK、Notion SDK などをここで使う。

```typescript
// src/infrastructure/gemini/gemini-chat.gateway.ts
export class GeminiGateway implements IAIGateway {
  async generateStream(messages: Message[], options?: AIGenerateOptions) {
    const { chat, prompt } = this.prepareChat(messages, options)
    const result = await chat.sendMessageStream(prompt)
    // ReadableStream に詰め替えて返す
  }

  /** Domain の Message を Gemini の Content 形式に翻訳する */
  private static toGeminiContents(messages: Message[]): Content[] {
    return messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }))
  }
}
```

`implements IAIGateway` — Port の約束を守っている、という意味です。

ストリーミング版と一括取得版でモデル設定がズレないよう、共通部分は `prepareChat()` に
まとめてあります。**同じ設定を2箇所に書かない**のは、こういう「翻訳係」で特に大事です。

**読み方のコツ：** Infrastructure は「SDK との翻訳係」。Domain の `Message` を Gemini の `Content` 形式に変換している。

---

### 4-5. Route Handler（Composition Root）— 「部品を組み立てる場所」

**役割：** HTTP リクエストを受け取り、Zod で入力チェックし、Infrastructure を作って Use Case に渡す。  
**ここだけ**が Infrastructure の具体クラスを `new` してよい場所です。

```typescript
// src/app/api/chat/route.ts
export async function POST(req: NextRequest) {
  try {
    // 1. 誰が    — 未サインインなら 401
    const user = await requireUser()
    // 2. どれだけ — 課金 API を叩く前に必ず
    await enforceRateLimit(clientKey(req, user.id), CHAT_RATE_LIMIT)
    // 3. 何を    — 形式だけ検証（業務ルールは Use Case）
    const { stream, messages, options } = chatRequestSchema.parse(
      await req.json(),
    )
    // 4. 組み立て — 具体クラスを new してよい唯一の場所
    const useCase = new SendMessageUseCase(createGateway())

    if (!stream) {
      const response = await useCase.executeNonStreaming({ messages, options })
      return NextResponse.json({ response })
    }

    const { stream: body } = await useCase.execute({ messages, options })

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (error) {
    return handleRouteError(error, "POST /api/chat")
  }
}
```

**流れは毎回同じ「誰が → どれだけ → 何を → 組み立て」：**

1. `requireUser()` — 未サインインなら `UnauthorizedError`（401）
2. `enforceRateLimit()` — 課金 API や外部書き込みの前に必ず
3. Zod スキーマで検証（`chatRequestSchema`）
4. Infrastructure を生成して Use Case に注入
5. `execute()` を呼んで結果を HTTP レスポンスとして返す
6. 例外は必ず `handleRouteError()` に渡す

`createGateway()` の中身は1行です。ここを差し替えるだけで Gemini ↔ Claude が入れ替わり、
Use Case もコンポーネントも一切変わりません。これが Port の実利です。

`handleRouteError()` は `ZodError` と `DomainError` を 400、それ以外を 500 に振り分けます。
**本番環境では 500 の詳細メッセージを隠す**ので、SDK の内部情報がクライアントに漏れません。

Zod スキーマは機能ごとに `src/features/<機能>/<機能>.schema.ts` に置きます。

```typescript
// src/features/chat/chat.schema.ts
export const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  options: generateOptionsSchema.optional(),
  stream: z.boolean().optional().default(true),
})
```

**Zod とドメイン検証の使い分け：**

| 種類                      | どこで                 | 例                     |
| ------------------------- | ---------------------- | ---------------------- |
| 形式チェック（HTTP 境界） | Zod / Route Handler    | メールの形式、必須項目 |
| ビジネスルール            | Domain 関数 / Use Case | メッセージは10文字以上 |

**読み方のコツ：** Route Handler は「配線係」。ビジネスロジックは書かず、Use Case に任せる。

---

### 4-5b. トランザクション — 「2つの書き込みを1つにまとめる」

「ユーザーを作る」と「監査ログを書く」は、**両方成功するか両方失敗するか**でなければ
いけません。片方だけ成功すると、誰のものか分からないユーザーか、存在しないユーザーの
記録が残ります。

```typescript
// src/features/auth/use-cases/register-user.use-case.ts
const user = await this.unitOfWork.transaction(async (repos) => {
  const created = await repos.users.create({ email, name, passwordHash })
  await repos.auditLog.append({ actorId: created.id, action: "auth.sign_up" })
  return created
})

// ★ トランザクションの「外」で
await this.jobs.enqueue("email.welcome", { email: user.email })
```

**なぜメール送信が外なのか：** HTTP 通信はロールバックできません。あとで
トランザクションが失敗しても、メールはもう届いています。しかも通信のあいだ
ずっと DB のトランザクションが開いたままになり、相手が遅いだけで
コネクションプールが枯渇します。

だから外部との通信は「キューに積む」だけにして、ワーカーが後でやります。

---

### 4-6. Client Data Layer — 「フロントから API を呼ぶ」

**役割：** ブラウザ上の React コンポーネントが、サーバーの `/api/*` を呼ぶためのコード。

#### ① 共通クライアント（`lib/api/api-client.ts`）

`apiGet` / `apiPost` / `apiPostStream` の3つだけを使います。
どれも失敗時に **サーバーが返した `{ error: "..." }` のメッセージ**を持った `ApiError` を投げるので、
`toast.error(error.message)` がそのまま使えます。

#### ② 機能ごとの API ラッパー（`features/chat/api/chat.api.ts`）

```typescript
const CHAT_ENDPOINT = "/api/chat"

export const chatApi = {
  sendMessageComplete: (input: SendChatMessageInput) =>
    apiPost<ChatCompletionResponse>(CHAT_ENDPOINT, { ...input, stream: false }),

  sendMessageStream: (input: SendChatMessageInput) =>
    apiPostStream(CHAT_ENDPOINT, { ...input, stream: true }),
}
```

ストリーミングは Axios ではなく `fetch` を使っています（Axios はレスポンス全体を待ってしまうため）。
その差分は `apiPostStream` の中に隠れているので、呼び出し側は意識しません。

#### ③ React Query フック（`features/chat/api/use-chat.ts`）

```typescript
export function useSendMessageStream(
  options?: UseMutationOptions<Response, Error, SendChatMessageInput>,
) {
  return useMutation({ mutationFn: chatApi.sendMessageStream, ...options })
}
```

`useMutation` は「ボタンを押したときに API を呼ぶ」パターン向け。  
`isPending`（読み込み中）や `error` などの状態も自動管理してくれます。

#### ④ 読み取りは useQuery（キャッシュキーが主役）

書き込み（mutation）だけでなく、読み取りにも React Query を使います。

```typescript
// src/features/audit/api/use-audit.ts
export const auditKeys = {
  all: ["audit"] as const,
  lists: () => [...auditKeys.all, "list"] as const,
  list: (filters) => [...auditKeys.lists(), filters] as const,
}
```

**キーを1か所で組み立てる理由：** データを更新したあとにキャッシュを捨てる
（invalidate）とき、キーを手書きしていると必ずどれかを取りこぼします。
`auditKeys.lists()` を無効化すればフィルタ違いも全部消える、という設計にしておくと
「更新したのに画面が古いまま」が起きません。

**読み方のコツ：** `features/*/api/` は「フロント専用の API クライアント」。Infrastructure は import しない。

---

### 4-7. UI — 「ユーザーが触る画面」

**役割：** 見た目と操作。Use Case や Gemini SDK は直接呼ばない。

状態を持つロジックは**カスタムフックに逃がす**のがこのプロジェクトの流儀です。
`ChatInterface` は「並べるだけ」になっています。

```tsx
// src/features/chat/components/chat-interface.tsx
export function ChatInterface() {
  const { messages, isPending, sendMessage } = useChatStream()

  return (
    <div className="...">
      <ChatPanelHeader />
      <ScrollArea className="flex-1 p-6">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </ScrollArea>
      <ChatComposer onSubmit={sendMessage} isPending={isPending} />
    </div>
  )
}
```

ストリームの読み取りは `useChatStream` が担当します。

```typescript
// src/features/chat/hooks/use-chat-stream.ts
const reader = response.body.getReader()
const decoder = new TextDecoder()
let answer = ""

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  answer += decoder.decode(value, { stream: true })
  updateMessage(placeholder.id, answer)
}
```

**UI がやっていること：**

1. `useChatStream()` から `messages` と `sendMessage` を受け取る
2. `ChatComposer` が入力値を持ち、送信時に `sendMessage(text)` を呼ぶ
3. フックが Domain の `Message` を作り、API を呼び、ストリームを読みながら state を更新
4. `messages` が変わるたびに再描画される

**読み方のコツ：** UI ファイルの先頭に `"use client"` があるのは、React の hooks を使うため。  
逆に `page.tsx` に `"use client"` が無いのは、Server Component のままでよいからです。

---

## 5. 実践：Chat 送信を最初から追う

ユーザーがメッセージを送って AI が返答するまで、ファイルを順に辿ります。

```
[1] app/page.tsx
      ↓ ChatInterface を表示
[2] features/chat/components/chat-interface.tsx
      ↓ ChatComposer で送信ボタンが押される
[3] features/chat/hooks/use-chat-stream.ts
      ↓ createMessage() で Message を作成
      ↓ useSendMessageStream() を呼ぶ
[4] features/chat/api/use-chat.ts
      ↓ chatApi.sendMessageStream() を実行
[5] features/chat/api/chat.api.ts → lib/api/api-client.ts
      ↓ fetch POST /api/chat
[6] app/api/chat/route.ts
      ↓ Zod で入力チェック（chatRequestSchema）
      ↓ createGeminiGateway() + new SendMessageUseCase()
      ↓ useCase.execute()
[7] features/chat/use-cases/send-message.use-case.ts
      ↓ assertValidMessageHistory()
      ↓ aiGateway.generateStream()
[8] infrastructure/gemini/gemini-chat.gateway.ts
      ↓ Google Gemini API を呼ぶ
      ↓ ReadableStream を返す
[6] route.ts
      ↓ Response として stream を返す
[3] use-chat-stream.ts
      ↓ stream を少しずつ読んで state 更新
[2] chat-interface.tsx
      ↓ 再描画
```

---

## 6. アーキテクチャの思想（3つの原則）

### 原則 1：依存は内側向き

```
UI / API → Use Case → Port ← Infrastructure
                ↑
             Domain（中心）
```

- **Domain** は誰にも依存しない（中心）
- **Use Case** は Domain と Port だけに依存
- **Infrastructure** は Port を実装する（外側）

`core/` から `infrastructure/` を import してはいけない、というルールの理由です。  
同じ理由で、`core/` と `infrastructure/` は `features/` を import できません
（機能を消したら壊れてしまうため）。

### 原則 2：抽象に依存する（DIP）

Use Case は `GeminiGateway` ではなく `IAIGateway` に依存します。

```typescript
// ✅ 正しい — interface に依存
constructor(private readonly aiGateway: IAIGateway) {}

// ❌ 避ける — 具体クラスに依存
constructor(private readonly aiGateway: GeminiGateway) {}
```

AI プロバイダーを Gemini → OpenAI に変えるとき、変えるのは Route Handler の1行だけで済みます。

```typescript
// api/chat/route.ts で差し替えるだけ
const useCase = new SendMessageUseCase(createOpenAIGateway())
```

### 原則 3：組み立ては1か所（Composition Root）

Infrastructure のインスタンス生成は **`src/app/api/**/route.ts` だけ\*\*。

コンポーネントや Use Case の中で `new GeminiGateway()` してはいけません。

---

## 7. よくある間違い

| 間違い                                    | なぜダメか                       | 正しい場所                        |
| ----------------------------------------- | -------------------------------- | --------------------------------- |
| コンポーネントで Gemini SDK を直接呼ぶ    | UI が外部サービスに縛られる      | Infrastructure                    |
| Use Case で `process.env` を読む          | ビジネスロジックが環境に依存     | `src/lib/env.ts` の `serverEnv()` |
| `core/` から `infrastructure/` を import  | 依存の方向が逆                   | Route Handler で DI               |
| `core/` から `features/` を import        | 機能を消すと共有部分が壊れる     | 共有したいなら `core/` に置く     |
| ビジネスルールを Route Handler に書く     | ロジックが散らばる               | Use Case                          |
| Zod なしで body を Use Case に渡す        | 不正な入力が内部に入る           | Route Handler + 機能の schema     |
| Route Handler で `try/catch` を書き忘れる | 例外がそのまま漏れる             | `handleRouteError()` で終わらせる |
| モデル名を UI にベタ書きする              | Gateway 側の設定と二重管理になる | `features/chat/chat.config.ts`    |

---

## 8. 新機能を追加するときの順番

Chat と同じパターンで、次の順番でファイルを作ります。

| 順番 | 作るもの        | 例                                               |
| ---- | --------------- | ------------------------------------------------ |
| 1    | Entity + ルール | `features/feedback/domain/feedback.entity.ts`    |
| 2    | Port            | `features/feedback/ports/...port.ts`             |
| 3    | Use Case        | `features/feedback/use-cases/...use-case.ts`     |
| 4    | Infrastructure  | `infrastructure/<provider>/...`                  |
| 5    | Zod スキーマ    | `features/feedback/feedback.schema.ts`           |
| 6    | Route Handler   | `app/api/feedback/route.ts`                      |
| 7    | API + Hook      | `features/feedback/api/`                         |
| 8    | UI              | `features/feedback/components/feedback-form.tsx` |

Port や Entity を複数機能で共有したくなったら、そのときに `core/` へ引き上げます。
最初から `core/` に置かないのがコツです。

詳細は [clean-architecture-extension Skill](../.cursor/skills/clean-architecture-extension/SKILL.md) を参照。

---

## 9. ローカルで動かしながら読む

```bash
pnpm install
cp .env.example .env.local        # AUTH_SECRET を設定: openssl rand -base64 32
docker compose up -d              # Postgres を起動
pnpm db:migrate && pnpm db:seed   # テーブル作成 + 最初のアカウント
pnpm dev
```

`pnpm db:seed` が表示するメールアドレスとパスワードでサインインできます。
`/sign-up` から自分でアカウントを作ることもできます。

パスワード再設定は**メール送信の設定なしで試せます** — リセットリンクが
ターミナルのログに出力されるので、それをブラウザに貼れば動作を確認できます。

バックグラウンドジョブを動かすには、別のターミナルで：

```bash
pnpm worker
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開き、  
DevTools の **Network** タブで `POST /api/chat` を見ながらコードを追うと理解が深まります。

環境変数を設定していなくてもアプリは起動します。
未設定のまま Chat を送ると `Environment variable "GEMINI_API_KEY" is not set.`
という**変数名入りのエラー**が返るので、何を設定すればよいかすぐ分かります。

テストを読むのもおすすめです。

```bash
pnpm test
```

`src/infrastructure/notion/notion-property.builder.spec.ts` など、  
Infrastructure 層の単体テストが「Port の実装が正しいか」を確認する良い例です。
テストは対象コードと同じフォルダに `*.spec.ts` として置いています。

---

## 10. 次に読むもの

| 資料                                                                                | 内容                          |
| ----------------------------------------------------------------------------------- | ----------------------------- |
| [README.md](../README.md)                                                           | プロジェクト概要と Skill 一覧 |
| [architecture-overview Skill](../.cursor/skills/architecture-overview/SKILL.md)     | レイヤー表・ディレクトリ構造  |
| [architectural-rules Skill](../.cursor/skills/architectural-rules/SKILL.md)         | 厳密なルール                  |
| [react-query-api-pattern Skill](../.cursor/skills/react-query-api-pattern/SKILL.md) | フロント ↔ API の標準パターン |

---

## まとめ

- **Domain** = データの形とビジネスルール
- **Port** = 外部サービスへの約束（interface）
- **Use Case** = ビジネスロジック（Port だけ知っている）
- **Infrastructure** = Port の具体実装（SDK を使う）
- **Route Handler** = 部品を組み立てる唯一の場所
- **features/** = 機能のタテ切り。消せば機能ごと消える
- **core / infrastructure** = 機能に依存しない共有部分。消えない
- **ESLint** = 上のすべてを実際に見張っている番人

コードを読むときは **UI から下に降りていく**（上記セクション 5 の順番）と迷いにくいです。
