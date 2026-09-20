import { readdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test } from "@playwright/test"

const FIXTURES = join(__dirname, "fixtures")
const UPLOADED_PREFIX = "uploaded-e2e"

/** The suite writes into the fixture directory; leave it as it was found. */
test.afterEach(async () => {
  for (const name of await readdir(FIXTURES)) {
    if (name.startsWith(UPLOADED_PREFIX)) await rm(join(FIXTURES, name))
  }
})

test("uploading an HTML file stores it and opens the viewer", async ({
  page,
}) => {
  await page.goto("/upload")

  await page.getByLabel("HTML ファイル").setInputFiles({
    name: `${UPLOADED_PREFIX}.html`,
    mimeType: "text/html",
    buffer: Buffer.from(
      "<!doctype html><html><head><title>アップロード確認</title></head><body><p id='body'>届きました</p></body></html>",
    ),
  })

  // The title is read from the file's <title>, so nothing needs typing.
  await expect(page.getByLabel("タイトル")).toHaveValue("アップロード確認")

  await page.getByRole("button", { name: "アップロード" }).click()

  await expect(page).toHaveURL(new RegExp(`/docs/${UPLOADED_PREFIX}$`))
  const frame = page.frameLocator("iframe[title='アップロード確認']")
  await expect(frame.locator("#body")).toHaveText("届きました")
})

test("the library is the default destination", async ({ page }) => {
  await page.goto("/upload")

  const group = page.getByRole("group", { name: "保存先を選ぶ" })
  await expect(
    group.getByRole("button", { name: "ライブラリ", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  // None of the destinations set a publication date — they share the
  // AWS/docs schema (Name, File, Category, Tags).
  await expect(page.getByLabel("公開日")).toHaveCount(0)
  await group.getByRole("button", { name: "ニュース", exact: true }).click()
  await expect(page.getByLabel("公開日")).toHaveCount(0)
  await group.getByRole("button", { name: "英語", exact: true }).click()
  await expect(page.getByLabel("公開日")).toHaveCount(0)
  await group.getByRole("button", { name: "世界史", exact: true }).click()
  await expect(page.getByLabel("公開日")).toHaveCount(0)
})

test("a non-HTML file is refused before upload", async ({ page }) => {
  await page.goto("/upload")

  await page.getByLabel("HTML ファイル").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not html"),
  })

  await expect(page.getByText(/\.html または \.htm/)).toBeVisible()
  await expect(
    page.getByRole("button", { name: "アップロード" }),
  ).toBeDisabled()
})

test("the upload endpoint rejects an empty form with 400", async ({
  request,
}) => {
  const response = await request.post("/api/docs", {
    multipart: { title: "no file" },
  })

  expect(response.status()).toBe(400)
  expect(await response.json()).toMatchObject({ error: expect.any(String) })
})
