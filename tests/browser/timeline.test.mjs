import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import vue from "@vitejs/plugin-vue";
import { build, preview } from "vite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("真实虚拟列表在折叠、异步高度变化与缓存页恢复时保留阅读位置", async (t) => {
  const outDir = await mkdtemp(join(tmpdir(), "workbench-timeline-"));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const root = fileURLToPath(new URL("./", import.meta.url));
  const config = {
    root,
    logLevel: "error",
    configFile: false,
    build: {
      outDir,
      rollupOptions: { input: join(root, "timeline.html") },
    },
  };
  await build({ ...config, plugins: [vue()] });
  const server = await preview({
    ...config,
    preview: { host: "127.0.0.1", port: 0 },
  });
  t.after(() => server.close());
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(server.resolvedUrls.local[0] + "timeline.html");
  const viewport = page.locator("#stage .overflow-y-auto");
  await page.locator('[data-row-id="40"]').waitFor();
  const settle = () =>
    page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
        ),
    );
  await settle();

  await page.waitForFunction(() => {
    const el = document.querySelector("#stage .overflow-y-auto");
    return el && el.scrollHeight - el.clientHeight - el.scrollTop > 500;
  });
  await settle();
  const row = await viewport.evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    return [...el.querySelectorAll("article")].find(
      (n) => n.getBoundingClientRect().top >= top,
    )?.dataset.rowId;
  });
  assert.ok(row);
  const article = page.locator('[data-row-id="' + row + '"]');
  const offset = async () =>
    (await article.boundingBox()).y - (await viewport.boundingBox()).y;
  const initial = await offset();
  await article
    .getByRole("button", { name: "收起：Record " + row, exact: true })
    .click();
  await settle();
  assert.ok(Math.abs((await offset()) - initial) <= 2);
  await article.evaluate((el) => {
    el.style.paddingBottom = "70px";
  });
  await settle();
  assert.ok(Math.abs((await offset()) - initial) <= 2);
  await page.locator("#switch").click();
  await viewport.waitFor({ state: "detached" });
  await page.locator("#switch").click();
  await article.waitFor();
  await settle();
  assert.ok(Math.abs((await offset()) - initial) <= 2);
  assert.equal(
    await article
      .getByRole("button", { name: "展开：Record " + row, exact: true })
      .count(),
    1,
  );
});
