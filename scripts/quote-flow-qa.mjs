import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const base = new URL(option("--base", "http://127.0.0.1:8080"));
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))
  throw new Error("QA refuses non-local hosts");
const mobile = args.includes("--mobile");
const label = option("--label", mobile ? "mobile" : "desktop");
const out = path.resolve(option("--out", "/workspace/quotation-ux-qa"));
const customer = `【測試】可選分區QA-${label}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
  isMobile: mobile,
  deviceScaleFactor: 1,
});
page.setDefaultTimeout(20000);
const apiOriginValue = option("--api-origin", null);
if (apiOriginValue) {
  const apiOrigin = new URL(apiOriginValue);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(apiOrigin.hostname))
    throw new Error("QA API proxy refuses non-local hosts");
  const manifest = await readFile(
    new URL("../.output/server/_ssr/ssr.mjs", import.meta.url),
    "utf8",
  );
  const functions = new Map(
    [...manifest.matchAll(/"([a-f0-9]+)":\s*\{\s*functionName:\s*"([^"]+)"/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  await page.route("**/_serverFn/**", async (route) => {
    const source = new URL(route.request().url());
    const name = functions.get(source.pathname.split("/").at(-1));
    if (!name) return route.continue();
    const id = Buffer.from(
      JSON.stringify({ file: "/src/lib/saas/api.ts?tss-serverfn-split", export: name }),
    ).toString("base64url");
    const target = new URL(`/_serverFn/${id}${source.search}`, apiOrigin);
    const headers = {
      ...route.request().headers(),
      origin: apiOrigin.origin,
      referer: apiOrigin.href,
    };
    delete headers.host;
    delete headers["content-length"];
    const response = await route.fetch({ url: target.href, headers });
    await route.fulfill({ response });
  });
}
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const checks = [];
let quoteUrl;
const pass = (message) => {
  checks.push(message);
  console.log(`[${label}] ${message}`);
};
const go = (name) => page.getByRole("button", { name, exact: true }).click();
const saved = () => page.getByText("已自動儲存", { exact: true }).waitFor();
const item = () => page.getByRole("listitem", { name: "目錄細項 23.5", exact: true });
const line = (number) =>
  page.getByRole("listitem", { name: `23.5 已加第 ${number} 行`, exact: true });
const field = (name) => page.getByRole("textbox", { name, exact: true });
const fillLine = async (number, qty, price) => {
  await line(number).getByRole("textbox", { name: "數量", exact: true }).fill(qty);
  await line(number).getByRole("textbox", { name: "單價", exact: true }).fill(price);
  await line(number).getByRole("textbox", { name: "單價", exact: true }).press("Tab");
};
const openItems = async () => {
  await go("3 細項");
  await field("搜尋細項").fill("23.5");
};
const deleteCurrent = async () => {
  await go("刪除");
  await go("確認刪除");
  await page.waitForURL(base.href);
  await saved();
};
try {
  await page.goto(base.href, { waitUntil: "domcontentloaded" });
  const create = page.getByRole("button", { name: "開新報價", exact: true });
  await create.waitFor();
  for (let attempts = 0; attempts < 5; attempts += 1) {
    const previous = page.getByRole("link").filter({ hasText: customer });
    if ((await previous.count()) === 0) break;
    await previous.first().click();
    await field("客戶稱呼").waitFor();
    assert.equal(await field("客戶稱呼").inputValue(), customer);
    await deleteCurrent();
    await page.reload();
    await create.waitFor();
  }
  await page.waitForFunction(() => !document.querySelector("button[aria-busy]")?.disabled);
  await create.click();
  await page.waitForURL(/\/quote\/[^/]+$/);
  quoteUrl = page.url();
  await page.getByRole("heading", { name: "1. 勾總項", exact: true }).waitFor();
  assert.equal(await page.getByText("搵唔到呢張單", { exact: true }).count(), 0);
  pass("first create opens the quote without a reload");
  await field("客戶稱呼").fill(customer);
  await field("地址").fill("【測試地址】虛構大廈 0 樓，唔係真實工程");
  await page.getByLabel("報價日期", { exact: true }).fill("2026-10-30");
  await page.getByRole("button", { name: /飾面工程.*未勾/ }).click();
  await go("去揀大項");
  await page.getByRole("checkbox", { name: /23\. 油漆及貼牆紙工程/ }).check();
  await page.getByRole("button", { name: /去揀.*細項/ }).click();
  await field("搜尋細項").fill("23.5");
  assert.equal(
    await page.locator("#quote-space-settings").evaluate((element) => element.open),
    false,
  );
  await item().getByRole("button", { name: "直接加入（不分區）", exact: true }).click();
  assert.match(await line(1).innerText(), /不分區/);
  assert.equal(await line(1).getByRole("textbox", { name: "數量", exact: true }).inputValue(), "");
  assert.equal(await line(1).getByRole("textbox", { name: "單價", exact: true }).inputValue(), "");
  assert.equal(await line(1).getByRole("combobox").count(), 0);
  pass("no-partition is direct; region settings and per-line selectors stay out of the way");
  await go("4 出街單");
  assert.equal(
    await page.getByRole("button", { name: "列印或儲存 PDF", exact: true }).isDisabled(),
    true,
  );
  assert.match(await page.getByTestId("quote-print-sheet").innerText(), /草稿預覽/);
  assert.doesNotMatch(
    await page.getByTestId("quote-print-sheet").innerText(),
    /細項\s*23\.5\s*·\s*全屋/,
  );
  await go("返去補細項");
  await field("搜尋細項").fill("23.5");
  await line(1)
    .getByRole("textbox", { name: "工程描述", exact: true })
    .fill("【測試】獨立改寫油漆工程，唔代表全屋範圍");
  await line(1)
    .getByRole("textbox", { name: "詳細規格", exact: true })
    .fill("【測試】物料、做法、數量及單價全部虛構。\n唔係正式承造報價。");
  await fillLine(1, "12.5", "150");
  await field("報價系數").fill("1.5");
  await field("報價系數").press("Tab");
  assert.equal(
    await line(1).getByRole("textbox", { name: "單價", exact: true }).inputValue(),
    "150",
  );
  await line(1).getByRole("textbox", { name: "數量", exact: true }).fill("");
  await line(1).getByRole("textbox", { name: "數量", exact: true }).press("Tab");
  await go("4 出街單");
  assert.equal(
    await page.getByRole("button", { name: "列印或儲存 PDF", exact: true }).isDisabled(),
    true,
  );
  await go("返去補細項");
  await field("搜尋細項").fill("23.5");
  await fillLine(1, "12.5", "150");
  pass("pending quantities/prices block issue; decimal quantities and manual prices stay correct");
  await page.locator("#quote-space-settings > summary").click();
  await go("客廳");
  await go("＋ 臥室");
  await go("＋ 臥室");
  await go("＋ 浴室");
  await field("區域名稱 臥室 1").fill("【測試】房A");
  await page.locator("#quote-space-settings > summary").click();
  await item().getByRole("button", { name: "按房間分開報", exact: true }).click();
  await item().getByRole("checkbox", { name: "加入區域 客廳", exact: true }).check();
  await item().getByRole("checkbox", { name: "加入區域 【測試】房A", exact: true }).check();
  await item().getByRole("button", { name: "加入已揀 2 個區域", exact: true }).click();
  await fillLine(2, "10", "20");
  await fillLine(3, "20", "20");
  assert.match(await line(2).innerText(), /客廳/);
  assert.match(await line(3).innerText(), /【測試】房A/);
  pass("one multi-select action adds independent lines for two rooms");
  await go("1 總項");
  await page.getByRole("button", { name: /飾面工程.*勾咗/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /3 個已填細項/);
  await dialog.getByRole("button", { name: "保留內容", exact: true }).click();
  await openItems();
  await page.locator("#quote-space-settings > summary").click();
  await go("移除區域 客廳");
  await page.getByRole("dialog").getByRole("button", { name: "保留區域", exact: true }).click();
  assert.match(await line(2).innerText(), /客廳/);
  await go("移除區域 客廳");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "移除區域，細項改為不分區", exact: true })
    .click();
  assert.match(await line(2).innerText(), /不分區/);
  assert.equal(
    await line(2).getByRole("textbox", { name: "數量", exact: true }).inputValue(),
    "10",
  );
  assert.equal(
    await line(2).getByRole("textbox", { name: "單價", exact: true }).inputValue(),
    "20",
  );
  await page.locator("#quote-space-settings > summary").click();
  await item().locator("p").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, `${label}-optional-regions.png`) });
  pass(
    "cancelling scope changes keeps edits; removing a region preserves its lines without expanding to whole house",
  );
  await go("4 出街單");
  const expected = new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: "HKD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(Math.round(12.5 * 150) + Math.round(10 * 20) + Math.round(20 * 20));
  assert.match(
    await page.getByTestId("quote-print-sheet").innerText(),
    new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.equal(
    await page.getByRole("button", { name: "列印或儲存 PDF", exact: true }).isEnabled(),
    true,
  );
  await page
    .getByRole("textbox", { name: "備註", exact: true })
    .fill("【測試】流程回歸用，唔係正式報價。");
  await page.getByRole("navigation").getByRole("link", { name: "報價簿", exact: true }).click();
  await saved();
  await page.reload();
  await page.getByRole("link").filter({ hasText: customer }).click();
  await field("客戶稱呼").waitFor();
  assert.equal(await field("客戶稱呼").inputValue(), customer);
  await openItems();
  assert.equal(
    await line(1).getByRole("textbox", { name: "工程描述", exact: true }).inputValue(),
    "【測試】獨立改寫油漆工程，唔代表全屋範圍",
  );
  assert.equal(
    await line(3).getByRole("textbox", { name: "數量", exact: true }).inputValue(),
    "20",
  );
  await go("4 出街單");
  assert.match(
    await page.getByRole("textbox", { name: "備註", exact: true }).inputValue(),
    /流程回歸/,
  );
  await page.evaluate(() => {
    window.__qaPrintCalls = 0;
    window.print = () => {
      window.__qaPrintCalls += 1;
    };
  });
  await go("列印或儲存 PDF");
  assert.equal(await page.evaluate(() => window.__qaPrintCalls), 1);
  assert.equal(
    await page.getByRole("combobox", { name: "狀態", exact: true }).inputValue(),
    "draft",
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  await page
    .getByTestId("quote-print-sheet")
    .screenshot({ path: path.join(out, `${label}-quote-preview.png`) });
  await page.pdf({
    path: path.join(out, `${label}-quote-test.pdf`),
    format: "A4",
    printBackground: true,
  });
  pass(
    "edits survive immediate route changes and reload; print is enabled without changing quote status; no horizontal overflow",
  );
  const originalUrl = page.url();
  await go("複製");
  await page.waitForURL((url) => url.href !== originalUrl && /\/quote\//.test(url.pathname));
  await field("客戶稱呼").waitFor();
  assert.equal(await field("客戶稱呼").inputValue(), customer);
  await go("4 出街單");
  assert.equal(
    await page.getByRole("button", { name: "列印或儲存 PDF", exact: true }).isEnabled(),
    true,
  );
  await deleteCurrent();
  await page.getByRole("link").filter({ hasText: customer }).click();
  await field("客戶稱呼").waitFor();
  await deleteCurrent();
  await page.reload();
  await page.getByRole("button", { name: "開新報價", exact: true }).waitFor();
  assert.equal(await page.getByRole("link").filter({ hasText: customer }).count(), 0);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(out, `${label}-cleanup-confirmed.png`), fullPage: true });
  pass(
    "copy preserves the quote; deletion persists; only this run's local test quotes are cleaned",
  );
  await writeFile(
    path.join(out, `${label}-result.json`),
    JSON.stringify(
      { ok: true, base: base.href, mobile, quoteUrl, checks, pageErrors: errors },
      null,
      2,
    ),
  );
} catch (error) {
  await page
    .screenshot({ path: path.join(out, `${label}-failure.png`), fullPage: true })
    .catch(() => {});
  await writeFile(
    path.join(out, `${label}-result.json`),
    JSON.stringify(
      { ok: false, quoteUrl, checks, error: String(error), pageErrors: errors },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
