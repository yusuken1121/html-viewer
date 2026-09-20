import { rm } from "node:fs/promises"
import { join } from "node:path"
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test"

const FIXTURES = join(__dirname, "fixtures")

const HTML = (title: string, body: string) =>
  `<!doctype html><html><head><title>${title}</title></head><body><p id="body">${body}</p></body></html>`

/**
 * The two collections are the same code with different configuration, so the
 * suite runs the same checks against both. A third collection is a line here.
 */
const COLLECTIONS = [
  { key: "news", label: "ニュース", heading: "ニュース" },
  { key: "english", label: "英語", heading: "英語" },
] as const

/**
 * Serial on purpose: every test reads and writes the same JSON files, and two
 * workers doing that at once would lose one another's writes.
 */
test.describe.configure({ mode: "serial" })

test.afterEach(async () => {
  for (const { key } of COLLECTIONS) {
    await rm(join(FIXTURES, `${key}.json`), { force: true })
    await rm(join(FIXTURES, `${key}.trash.json`), { force: true })
  }
})

/** Register through the JSON path — the one a script would use. */
async function register(
  request: APIRequestContext,
  key: string,
  body: Record<string, unknown>,
) {
  const response = await request.post(`/api/${key}`, { data: body })
  expect(response.status()).toBe(201)
  return response.json() as Promise<{
    id: string
    title: string
    hasFile: boolean
    contentUrl: string
  }>
}

async function openFirstItem(page: Page, key: string, title: string) {
  await page.goto(`/${key}`)
  await page.getByRole("link", { name: `${title} を開く` }).click()
}

for (const { key, label, heading } of COLLECTIONS) {
  test.describe(`/${key}`, () => {
    test("an HTML file registered through the API is readable in the viewer", async ({
      page,
      request,
    }) => {
      const created = await register(request, key, {
        fileName: `${key}-sample.html`,
        html: HTML(`${label}のサンプル`, "本文がここに出ます"),
        category: "AWS",
        tags: ["S3"],
      })

      // The title came from the file's own <title>, as with a document upload.
      expect(created.title).toBe(`${label}のサンプル`)
      expect(created.hasFile).toBe(true)

      await openFirstItem(page, key, `${label}のサンプル`)

      await expect(page).toHaveURL(`/${key}/${created.id}`)
      const frame = page.frameLocator(`iframe[title='${label}のサンプル']`)
      await expect(frame.locator("#body")).toHaveText("本文がここに出ます")
    })

    test("the content route serves HTML that may be framed by this origin", async ({
      request,
    }) => {
      const created = await register(request, key, {
        fileName: `${key}-frame.html`,
        html: HTML("枠内表示の確認", "ok"),
      })

      const response = await request.get(created.contentUrl)

      expect(response.status()).toBe(200)
      expect(response.headers()["content-type"]).toContain("text/html")
      expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN")
      expect(response.headers()["content-security-policy"]).toContain(
        "frame-ancestors 'self'",
      )
    })

    test("a multipart upload works too, for a form rather than a script", async ({
      request,
    }) => {
      const response = await request.post(`/api/${key}`, {
        multipart: {
          file: {
            name: `${key}-multipart.html`,
            mimeType: "text/html",
            buffer: Buffer.from(HTML("フォーム経由", "ok")),
          },
          category: "AWS",
          tags: "S3, ストレージ",
        },
      })

      expect(response.status()).toBe(201)
      expect(
        (await response.json()) as { title: string; tags: string[] },
      ).toMatchObject({ title: "フォーム経由", tags: ["S3", "ストレージ"] })
    })

    test("the page is its own page, reachable from the sidebar", async ({
      page,
      request,
    }) => {
      await register(request, key, {
        fileName: `${key}-sidebar.html`,
        html: HTML("サイドバー経由で読む", "ok"),
      })

      await page.goto("/")
      await page.getByRole("link", { name: label, exact: true }).click()

      await expect(page).toHaveURL(`/${key}`)
      await expect(page.getByRole("heading", { name: heading })).toBeVisible()
      // The library stayed where it was — the pages are separate.
      await expect(
        page.getByRole("heading", { name: "ライブラリ" }),
      ).toHaveCount(0)
    })

    test("the newest item is listed first", async ({ page, request }) => {
      await register(request, key, {
        fileName: `${key}-old.html`,
        html: HTML("去年のできごと", "ok"),
        publishedAt: "2025-01-01T00:00:00.000Z",
      })
      await register(request, key, {
        fileName: `${key}-new.html`,
        html: HTML("今日のできごと", "ok"),
        publishedAt: "2026-09-14T00:00:00.000Z",
      })

      await page.goto(`/${key}`)

      await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText(
        "今日のできごと",
      )
    })

    test("an item can be corrected and removed through the API", async ({
      request,
    }) => {
      const created = await register(request, key, {
        title: "まちがった見出し",
        fileName: `${key}-fix.html`,
        html: HTML("ファイル側のタイトル", "ok"),
        tags: ["S3"],
      })

      const patched = await request.patch(`/api/${key}/${created.id}`, {
        data: { title: "正しい見出し" },
      })
      expect(patched.status()).toBe(200)
      expect(
        (await patched.json()) as { title: string; tags: string[] },
      ).toMatchObject({
        title: "正しい見出し",
        // Untouched fields survive a partial update.
        tags: ["S3"],
      })

      expect((await request.delete(`/api/${key}/${created.id}`)).status()).toBe(
        200,
      )
      expect((await request.get(`/api/${key}/${created.id}`)).status()).toBe(
        404,
      )
    })

    test("the upload page can send a file here", async ({ page }) => {
      await page.goto("/upload")

      // The library is the default destination; pick this collection instead.
      await page
        .getByRole("group", { name: "保存先を選ぶ" })
        .getByRole("button", { name: label, exact: true })
        .click()

      await page.getByLabel("HTML ファイル").setInputFiles({
        name: `${key}-from-form.html`,
        mimeType: "text/html",
        buffer: Buffer.from(HTML("フォームから登録", "届きました")),
      })
      await expect(page.getByLabel("タイトル")).toHaveValue("フォームから登録")

      // Same four columns as the AWS/docs database — no publication date.
      await expect(page.getByLabel("公開日")).toHaveCount(0)

      await page.getByRole("button", { name: "アップロード" }).click()

      await expect(page).toHaveURL(new RegExp(`/${key}/[0-9a-f-]+$`))
      const frame = page.frameLocator("iframe[title='フォームから登録']")
      await expect(frame.locator("#body")).toHaveText("届きました")

      await page.goto(`/${key}`)
      await expect(
        page.getByRole("heading", { name: "フォームから登録" }),
      ).toBeVisible()
    })

    test("the API refuses anything that is not an HTML file", async ({
      request,
    }) => {
      const notHtml = await request.post(`/api/${key}`, {
        data: { fileName: "notes.txt", html: HTML("t", "b") },
      })
      expect(notHtml.status()).toBe(400)

      const notAPage = await request.post(`/api/${key}`, {
        data: { fileName: "x.html", html: "just some words" },
      })
      expect(notAPage.status()).toBe(400)
      expect(((await notAPage.json()) as { error: string }).error).toContain(
        "HTML",
      )

      const noFile = await request.post(`/api/${key}`, {
        data: { title: "見出し" },
      })
      expect(noFile.status()).toBe(400)
    })
  })
}

test("the two collections are separate stores", async ({ page, request }) => {
  await register(request, "news", {
    fileName: "only-news.html",
    html: HTML("ニュース側だけの記事", "ok"),
  })
  await register(request, "english", {
    fileName: "only-english.html",
    html: HTML("英語側だけの教材", "ok"),
  })

  await page.goto("/news")
  await expect(
    page.getByRole("heading", { name: "ニュース側だけの記事" }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "英語側だけの教材" }),
  ).toHaveCount(0)

  await page.goto("/english")
  await expect(
    page.getByRole("heading", { name: "英語側だけの教材" }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "ニュース側だけの記事" }),
  ).toHaveCount(0)
})
