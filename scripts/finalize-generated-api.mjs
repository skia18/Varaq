// Generated upstream runtime uses syntax/unused helpers excluded by our app rules.
// Keep application code strict while making regeneration reproducible.
import { readdir, readFile, writeFile } from "node:fs/promises";
const root = new URL("../apps/varaq-frontend/src/generated/api/", import.meta.url);
async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory()) await visit(path);
    else if (entry.name.endsWith(".ts")) {
      const source = await readFile(path, "utf8");
      if (!source.startsWith("// @ts-nocheck"))
        await writeFile(
          path,
          "// @ts-nocheck -- generated upstream code; application consumers remain type checked.\n" +
            source,
        );
    }
  }
}
await visit(root);
