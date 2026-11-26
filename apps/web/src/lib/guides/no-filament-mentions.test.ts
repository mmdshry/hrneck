import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Customer-facing surfaces must never name or point at the staff admin panel.
const webRoot = fileURLToPath(new URL("../../../", import.meta.url));
const FORBIDDEN = /filament|admin\.hrneck|\/admin\b/i;

function collectFiles(dir: string, predicate: (file: string) => boolean): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      return collectFiles(full, predicate);
    }
    return predicate(full) ? [full] : [];
  });
}

const publicSurfaceFiles = [
  ...collectFiles(path.join(webRoot, "src/lib/guides/content"), (file) =>
    file.endsWith(".ts"),
  ),
  ...collectFiles(path.join(webRoot, "messages"), (file) => file.endsWith(".json")),
  path.join(webRoot, "public/llms.txt"),
];

describe("customer-facing surfaces do not mention the staff admin panel", () => {
  it("scans the guide, message, and llms.txt surfaces", () => {
    expect(publicSurfaceFiles.length).toBeGreaterThan(50);
  });

  for (const file of publicSurfaceFiles) {
    const relative = path.relative(webRoot, file);
    it(`${relative} has no admin panel reference`, () => {
      const match = FORBIDDEN.exec(readFileSync(file, "utf8"));
      expect(match, `found "${match?.[0]}" in ${relative}`).toBeNull();
    });
  }
});
