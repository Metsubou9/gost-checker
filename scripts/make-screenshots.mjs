/**
 * Генератор скриншотов для README.
 *
 * Запуск: 1) npm run build  2) npx vite preview --port 4173  3) node scripts/make-screenshots.mjs
 * Результат: docs/screenshots/01-dropzone.png, 02-report.png, 03-settings.png
 *
 * Использует локальный Edge/Chrome (puppeteer-core) — отдельный браузер не скачивается.
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs", "screenshots");
mkdirSync(outDir, { recursive: true });

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:4173/gost-checker/";
const SAMPLE = join(root, "public", "samples", "gost-bad.docx");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].filter(Boolean);

const executablePath = CHROME_CANDIDATES.find((p) => {
  try { statSync(p); return true; } catch { return false; }
});
if (!executablePath) {
  console.error("Не найден Edge/Chrome; укажите CHROME_PATH.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shotClip(page, clip, name) {
  await page.screenshot({ path: join(outDir, name), clip });
  console.log(`ok: docs/screenshots/${name}`);
}

// Обрезка сверху блока-карточки: карточка + запас снизу, не ниже низа страницы.
async function topClip(page, cardSelector, maxH = 860) {
  const card = await page.$(cardSelector);
  if (!card) throw new Error(`Нет элемента: ${cardSelector}`);
  const box = await card.boundingBox();
  const pageH = await page.evaluate(() => document.documentElement.scrollHeight);
  return {
    x: Math.max(0, box.x - 6),
    y: Math.max(0, box.y - 6),
    width: Math.min(1100, box.width + 12),
    height: Math.min(box.height + 12, maxH, pageH - Math.max(0, box.y - 6)),
  };
}

const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 560, deviceScaleFactor: 2 });
  await page.goto(BASE_URL, { waitUntil: "networkidle0" });
  await sleep(300);

  // 1) Стартовый экран: dropzone + краткий список «Что проверяется».
  {
    const dz = await page.$(".dropzone");
    const box = await dz.boundingBox();
    await shotClip(
      page,
      { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 40), width: Math.min(1100, box.width + 16), height: Math.min(box.height + 130, 560) },
      "01-dropzone.png",
    );
  }

  // 2) Отчёт: загружаем демо-файл с нарушениями через скрытый <input type=file>.
  {
    const input = await page.$('input[type="file"]');
    await input.uploadFile(SAMPLE);
    await page.waitForSelector(".summary", { timeout: 20000 });
    await sleep(400);
    await shotClip(page, await topClip(page, ".card:has(.summary)"), "02-report.png");
  }

  // 3) Настройки правил: раскрываем панель поверх отчёта.
  {
    const btns = await page.$$("button");
    for (const b of btns) {
      const t = await b.evaluate((el) => el.textContent);
      if (t.includes("Настройки правил")) { await b.click(); break; }
    }
    await page.waitForSelector("details.rules", { timeout: 10000 });
    await sleep(300);
    await shotClip(page, await topClip(page, "details.rules", 800), "03-settings.png");
  }
} finally {
  await browser.close();
}
