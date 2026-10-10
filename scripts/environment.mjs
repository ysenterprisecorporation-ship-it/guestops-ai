import { mkdir, writeFile } from "node:fs/promises";
import { loadSettings, PROPERTY_KEYS } from "../src/Settings.ts";
import { receiverSettings } from "../receiver/Settings.ts";
// 環境変数はNode --env-fileで読み込む。値を標準出力へ出さない。
try {
  loadSettings((key) => process.env[key]);
  if (!process.env.GAS_SCRIPT_ID?.trim())
    throw new Error("PROPERTY_UNCONFIRMED:GAS_SCRIPT_ID");
  const mode = process.argv[2];
  if (mode === "check") console.log("設定検証成功（接続・認証確認は未実施）");
  else if (mode === "export") {
    await mkdir(".local", { recursive: true, mode: 0o700 });
    const data = Object.fromEntries(
      PROPERTY_KEYS.map((key) => [key, process.env[key]?.trim() ?? ""]),
    );
    data.AUTOMATION_ENABLED = "false";
    await writeFile(
      ".local/script-properties.json",
      JSON.stringify(data, null, 2),
      { mode: 0o600 },
    );
    console.log(
      ".local/script-properties.jsonを作成（秘密値を含むためGitへ追加しない）",
    );
  } else if (mode === "receiver") {
    const settings = receiverSettings({
      ...process.env,
      RECEIVER_ENABLED: "true",
    });
    await mkdir(".local", { recursive: true, mode: 0o700 });
    await writeFile(
      ".local/receiver-environment.json",
      JSON.stringify(
        {
          RECEIVER_ENABLED: "false",
          SQUARE_WEBHOOK_SIGNATURE_KEY: settings.signatureKey,
          SQUARE_WEBHOOK_NOTIFICATION_URL: settings.notificationUrl,
          GAS_WEB_APP_URL: settings.gasUrl,
          RELAY_SHARED_SECRET: settings.relayKey,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log(
      ".local/receiver-environment.jsonを作成（秘密値を含むためGitへ追加しない）",
    );
  } else if (mode === "clasp") {
    await writeFile(
      ".clasp.json",
      JSON.stringify(
        { scriptId: process.env.GAS_SCRIPT_ID.trim(), rootDir: "dist" },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log(
      ".clasp.jsonを作成（新規自動化専用GASのIDを確認してからpushする）",
    );
  } else throw new Error("MODE_INVALID");
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "ENV_VALIDATION_FAILED",
  );
  process.exitCode = 1;
}
