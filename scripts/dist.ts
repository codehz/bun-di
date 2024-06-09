import dts from "bun-plugin-dts";
import { spawnSync } from "node:child_process";
import { cp, readFile, rm } from "node:fs/promises";

async function glob(pattern: string) {
  const result: string[] = [];
  for await (const path of new Bun.Glob(pattern).scan({ onlyFiles: true })) {
    result.push(path);
  }
  return result;
}

await rm("dist", { recursive: true });

await Bun.build({
  target: "bun",
  outdir: "dist",
  minify: false,
  sourcemap: "external",
  entrypoints: ["index.ts"],
  plugins: [dts()],
});

for (const file of [
  ...(await glob("*.tsx")),
  ...(await glob("router/**/*.{ts,tsx}")),
  "LICENSE",
  "README.md",
]) {
  await cp(file, `dist/${file}`);
}

const contents = JSON.parse(await readFile("package.json", "utf-8"));
contents.module = "index.js";
contents.devDependencies = {};
contents.overrides = {};
delete contents["private"];
await Bun.write("dist/package.json", JSON.stringify(contents, null, 2));
