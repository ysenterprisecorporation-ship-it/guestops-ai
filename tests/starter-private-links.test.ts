import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

// docs/ is a public GitHub Pages directory, not a private buyer portal.
// Never publish buyer-only Google Drive document IDs through these files.
const publicStarter = join(process.cwd(), "docs", "starter");
const driveDocumentLink =
  /https?:\/\/(?:docs\.google\.com\/(?:document|spreadsheets|presentation|forms)\/d\/|drive\.google\.com\/(?:file\/d\/|open\?id=))/i;

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : entry.isFile() ? [path] : [];
  });
}

test("public Starter pages and operational guide never disclose buyer Drive document links", () => {
  const files = filesUnder(publicStarter).filter((path) =>
    /\.(?:html|md|csv|txt|json|js)$/i.test(path),
  );
  assert.ok(files.length >= 5, "Starter public files must be scanned");
  for (const path of files) {
    const content = readFileSync(path, "utf8");
    assert.doesNotMatch(
      content,
      driveDocumentLink,
      "Buyer-only Drive link exposed in " + relative(process.cwd(), path),
    );
  }
});

test("public fulfillment guide explicitly separates private delivery inventory", () => {
  const guide = readFileSync(
    join(publicStarter, "fulfillment-ops.md"),
    "utf8",
  );
  assert.match(guide, /公開リポジトリ/);
  assert.match(guide, /非公開リンク台帳/);
  assert.match(guide, /過去のGit履歴/);
});
