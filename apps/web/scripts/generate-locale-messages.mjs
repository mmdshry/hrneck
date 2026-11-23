import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, "../messages");
const en = JSON.parse(fs.readFileSync(path.join(messagesDir, "en.json"), "utf8"));

function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

function unflatten(flat) {
  const out = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split(".");
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] || {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = v;
  }
  return out;
}

const flatEn = flatten(en);

/** @type {Record<string, Record<string, string>>} */
const packs = JSON.parse(
  fs.readFileSync(path.join(__dirname, "locale-packs.json"), "utf8"),
);

for (const [loc, pack] of Object.entries(packs)) {
  const flat = { ...flatEn, ...pack };
  fs.writeFileSync(
    path.join(messagesDir, `${loc}.json`),
    `${JSON.stringify(unflatten(flat), null, 2)}\n`,
  );
  console.log(`wrote ${loc} (${Object.keys(pack).length} overrides)`);
}
