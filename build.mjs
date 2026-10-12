import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
// ビルドI/Oにasync/awaitを使い、GAS入口は同期関数として出力する。
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/Runtime.ts"],
  bundle: true,
  format: "iife",
  globalName: "GuestOps",
  target: "es2020",
  outfile: "dist/Code.js",
});
await writeFile(
  "dist/Entrypoints.js",
  `function doPost(e) { return GuestOps.doPost(e); }
function processQueue() { return GuestOps.processQueue(); }
function setupAutomation() { return GuestOps.setupAutomation(); }
function configureAutomation() { return GuestOps.configureAutomation(); }
function webhookCapabilities() { return GuestOps.webhookCapabilities(); }
function productionReadiness() { return GuestOps.productionReadiness(); }
function stopAutomation() { return GuestOps.stopAutomation(); }
`,
);
await writeFile(
  "dist/appsscript.json",
  JSON.stringify(
    {
      timeZone: "Asia/Tokyo",
      runtimeVersion: "V8",
      exceptionLogging: "STACKDRIVER",
      oauthScopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/script.external_request",
        "https://www.googleapis.com/auth/script.send_mail",
        "https://www.googleapis.com/auth/script.scriptapp",
      ],
    },
    null,
    2,
  ),
);
