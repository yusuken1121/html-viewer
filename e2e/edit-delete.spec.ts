import { readdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const FIXTURES = join(__dirname, "fixtures")
/** Distinct from `upload.spec.ts`'s prefix, so neither suite cleans up the other's file. */
const PREFIX = "crud-e2e"

/**
 * The file this test uploaded.
 *
 * A worker process runs one test at a time, so a module-level name is per-test
 * even though the suite is fully parallel — and cleaning up only this file
 * leaves a sibling test running in another worker alone.
 */
let uploaded: string | null = null

test.afterEach(async () => {
  const name = uploaded
  uploaded = null
  if (!name) return

  await rm(join(FIXTURES, `${name}.html`), { force: true })
  // Deleting through the UI moves the file here rather than unlinking it.
  const trash = join(FIXTURES, ".trash")
  for (const entry of await readdir(trash).catch(() => [])) {
    if (entry.includes(name)) await rm(join(trash, entry), { force: true })
  }
})

/**
 * Upload a document of this test's own — the committed fixtures are shared
 * with the other suites and must not be edited or deleted.
 */
async function upload(
  page: Page,
  slug: string,
  title: string,
): Promise<string> {
  const name = `${PREFIX}-${slug}`
  uploaded = name

  await page.goto("/upload")
  await page.getByLabel("HTML ファイル").setInputFiles({
    name: `${name}.html`,
    mimeType: "text/html",
    buffer: Buffer.from(
      `<!doctype html><html><head><title>${title}</title></head><body><p>x</p></body></html>`,
    ),
  })
  await page.getByRole("button", { name: "アップロード" }).click()
  await expect(page).toHaveURL(`/docs/${name}`)

  return name
}

/** The library card for a document, by its heading — never a toast or a dialog. */
function card(title: string) {
  return (page: Page) => page.getByRole("heading", { level: 3, name: title })
}

test("a wrong title can be corrected from the library", async ({ page }) => {
  await upload(page, "title", "まちがったタイトル")

  await page.goto("/")
  await page.getByRole("button", { name: "まちがったタイトル の操作" }).click()
  await page.getByRole("menuitem", { name: "編集" }).click()

  // Scope to the dialog: the card behind it is labelled with the title too.
  const dialog = page.getByRole("dialog", { name: "ドキュメントを編集" })
  const title = dialog.getByRole("textbox", { name: "タイトル" })
  await expect(title).toHaveValue("まちがったタイトル")
  await title.fill("正しいタイトル")
  await dialog.getByRole("button", { name: "保存" }).click()

  // Assert on the card's own heading: a toast carries the title too.
  await expect(card("正しいタイトル")(page)).toBeVisible()
  await expect(card("まちがったタイトル")(page)).toHaveCount(0)

  // The correction outlives the client cache: it reached the store.
  await page.reload()
  await expect(card("正しいタイトル")(page)).toBeVisible()
})

test("a document can be deleted, and confirmation is required first", async ({
  page,
}) => {
  await upload(page, "delete", "消す予定のノート")

  await page.goto("/")
  const menu = page.getByRole("button", { name: "消す予定のノート の操作" })

  // Backing out of the dialog must leave the document where it was.
  await menu.click()
  await page.getByRole("menuitem", { name: "削除" }).click()
  const confirm = page.getByRole("alertdialog")
  await confirm.getByRole("button", { name: "キャンセル" }).click()
  await expect(card("消す予定のノート")(page)).toBeVisible()

  await menu.click()
  await page.getByRole("menuitem", { name: "削除" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "削除する" })
    .click()

  await expect(card("消す予定のノート")(page)).toHaveCount(0)

  // Reload: the library now comes from the server again, so this also proves
  // the deletion reached the store and is not just a pruned client cache.
  await page.reload()
  await expect(card("消す予定のノート")(page)).toHaveCount(0)
})
