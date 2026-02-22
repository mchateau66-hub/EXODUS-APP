// e2e/utils/dump.ts
import type { Page, TestInfo } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

export async function ensureOutputDir(testInfo: TestInfo) {
  await fs.mkdir(testInfo.outputDir, { recursive: true }).catch(() => {});
}

export async function writeDebugFile(testInfo: TestInfo, filename: string, text: string) {
  try {
    await ensureOutputDir(testInfo);
    await fs.writeFile(path.join(testInfo.outputDir, filename), text ?? "", "utf8");
  } catch {}
}

export async function readDebugFile(testInfo: TestInfo, filename: string) {
  try {
    return await fs.readFile(path.join(testInfo.outputDir, filename), "utf8");
  } catch {
    return "";
  }
}

export async function attachDebugPath(
  testInfo: TestInfo,
  name: string,
  filename: string,
  contentType = "text/plain"
) {
  try {
    await ensureOutputDir(testInfo);
    await testInfo.attach(name, { path: path.join(testInfo.outputDir, filename), contentType });
  } catch {}
}

export async function dump(
  page: Page,
  testInfo: TestInfo,
  tag: string,
  extra?: { netLog?: string }
) {
  const url = (() => {
    try {
      return page.url();
    } catch {
      return "";
    }
  })();

  await writeDebugFile(testInfo, `${tag}-url.txt`, url || "");
  await attachDebugPath(testInfo, `${tag}-url`, `${tag}-url.txt`, "text/plain");

  const bodyText = await page.locator("body").innerText().catch(() => "");
  await writeDebugFile(testInfo, `${tag}-body-text.txt`, (bodyText || "").slice(0, 25_000));
  await attachDebugPath(testInfo, `${tag}-body-text`, `${tag}-body-text.txt`, "text/plain");

  const html = await page.content().catch(() => "");
  await writeDebugFile(testInfo, `${tag}-html.html`, (html || "").slice(0, 200_000));
  await attachDebugPath(testInfo, `${tag}-html`, `${tag}-html.html`, "text/html");

  await ensureOutputDir(testInfo);
  const shot = path.join(testInfo.outputDir, `${tag}-screenshot.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  await testInfo.attach(`${tag}-screenshot`, { path: shot, contentType: "image/png" }).catch(() => {});

  if (extra?.netLog) {
    await writeDebugFile(testInfo, `${tag}-netlog.txt`, extra.netLog.slice(0, 200_000));
    await attachDebugPath(testInfo, `${tag}-netlog`, `${tag}-netlog.txt`, "text/plain");
  }
}

function contentTypeFromExt(ext: string) {
  const e = ext.toLowerCase();
  if (e === ".html") return "text/html";
  if (e === ".json") return "application/json";
  if (e === ".md") return "text/markdown";
  if (e === ".png") return "image/png";
  return "text/plain";
}

/**
 * Attache tous les fichiers déjà écrits dans outputDir selon un filtre (regex sur le filename).
 * Pratique pour "step-*" etc (attach uniquement sur FAIL via afterEach).
 */
export async function attachAllDebugFilesFromOutputDir(testInfo: TestInfo, include: RegExp) {
  await ensureOutputDir(testInfo);

  const files = await fs.readdir(testInfo.outputDir).catch(() => []);
  for (const f of files) {
    if (!include.test(f)) continue;

    const ext = path.extname(f);
    const contentType = contentTypeFromExt(ext);
    const name = f.replace(/\.[^.]+$/, "");
    await testInfo.attach(name, { path: path.join(testInfo.outputDir, f), contentType }).catch(() => {});
  }
}

export type LastHubApi = { url: string; status: number; body?: string };

/**
 * Wrapper standard : appelé uniquement sur FAIL
 * - écrit fail-* via dump()
 * - attache tout fail-*
 */
export async function dumpOnFail(
  page: Page,
  testInfo: TestInfo,
  extra?: { lastHubApi?: LastHubApi }
) {
  const netLog = extra?.lastHubApi ? JSON.stringify(extra.lastHubApi, null, 2) : undefined;

  await dump(page, testInfo, "fail", { netLog });
  await attachAllDebugFilesFromOutputDir(testInfo, /^fail-/);
}