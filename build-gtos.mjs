import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
// A separately deployed, read-only GAS app; never shares Square's doPost or OAuth setup.
await mkdir("dist-gtos", { recursive: true });
await build({
  entryPoints: ["src/pms/Beds24GasEntrypoint.ts"],
  bundle: true,
  format: "iife",
  globalName: "Beds24Test",
  target: "es2020",
  outfile: "dist-gtos/Code.js",
});
await writeFile(
  "dist-gtos/Entrypoints.js",
  [
    "function beds24ReadOnlyStatus() { return Beds24Test.beds24ReadOnlyStatus(); }",
    "function beds24SetupInviteCode() { return Beds24Test.beds24SetupInviteCode(); }",
    "function beds24ConnectionTest() { return Beds24Test.beds24ConnectionTest(); }",
    "function beds24ReadOnlyBooking(id) { return Beds24Test.beds24ReadOnlyBooking(id); }",
    "",
  ].join("\n"),
);
await writeFile("dist-gtos/appsscript.json", JSON.stringify({
  timeZone: "Asia/Tokyo",
  runtimeVersion: "V8",
  exceptionLogging: "STACKDRIVER",
  oauthScopes: [
    "https://www.googleapis.com/auth/script.external_request",
  ],
}, null, 2));

const bundled = await readFile("dist-gtos/Code.js", "utf8");
const wrappers = await readFile("dist-gtos/Entrypoints.js", "utf8");
await writeFile("dist-gtos/PasteIntoAppsScript.gs", bundled + "\n" + wrappers);
