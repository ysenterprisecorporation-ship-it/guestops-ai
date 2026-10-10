import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { CONFIG_KEYS } from "../src/Config";
import { loadSettings, PROPERTY_KEYS } from "../src/Settings";
// 環境値をソースへ埋め込まずに検証・安全なローカル出力ができることを確認する。
function values(): Record<string, string> {
  return {
    ...Object.fromEntries(
      CONFIG_KEYS.map((key) => [
        key,
        key.endsWith("URL") ? "https://example.invalid/" + key : key,
      ]),
    ),
    SQUARE_ACCESS_TOKEN: "mock-token",
    SQUARE_API_VERSION: "2026-01-22",
    SQUARE_ENVIRONMENT: "production",
    SQUARE_LOCATION_ID: "location",
    SQUARE_MERCHANT_ID: "merchant",
    SPREADSHEET_ID: "book",
    ADMIN_EMAIL: "admin@example.invalid",
    WEBHOOK_URL_SECRET: "x".repeat(43),
    ACKNOWLEDGE_UNSIGNED_WEBHOOK: "true",
    AUTOMATION_ENABLED: "false",
    GAS_SCRIPT_ID: "new-script",
  };
}
test("環境変数から全設定を読める", () => {
  const v = values();
  assert.equal(loadSettings((key) => v[key]).environment, "production");
});
test("未設定の既存URLは推測せず失敗", () => {
  const v = values();
  v.A_URL = "";
  assert.throws(
    () => loadSettings((key) => v[key]),
    /CONFIG_UNCONFIRMED:A_URL/,
  );
});
test("署名未検証の同意なしでは停止", () => {
  const v = values();
  v.ACKNOWLEDGE_UNSIGNED_WEBHOOK = "false";
  assert.throws(() => loadSettings((key) => v[key]), /NOT_ACKNOWLEDGED/);
});
test("無効な環境名では停止", () => {
  const v = values();
  v.SQUARE_ENVIRONMENT = "unknown";
  assert.throws(() => loadSettings((key) => v[key]), /ENVIRONMENT_INVALID/);
});
test("enabled誤設定では停止", () => {
  const v = values();
  v.AUTOMATION_ENABLED = "yes";
  assert.throws(() => loadSettings((key) => v[key]), /ENABLED_INVALID/);
});
test("プロパティ出力は停止状態、秘密値を標準出力へ出さない", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guestops-env-"));
  try {
    const v = values();
    v.AUTOMATION_ENABLED = "true";
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        import.meta.resolve("tsx"),
        new URL("../scripts/environment.mjs", import.meta.url).pathname,
        "export",
      ],
      { cwd: dir, env: { ...process.env, ...v }, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!result.stdout.includes("mock-token"));
    const path = join(dir, ".local/script-properties.json"),
      data = JSON.parse(await readFile(path, "utf8"));
    assert.equal(data.AUTOMATION_ENABLED, "false");
    assert.equal(data.SQUARE_ACCESS_TOKEN, "mock-token");
    assert.equal(data.GAS_SCRIPT_ID, undefined);
    assert.equal(Object.keys(data).length, PROPERTY_KEYS.length);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
