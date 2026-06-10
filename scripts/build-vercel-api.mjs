import { build } from "esbuild";

await build({
  entryPoints: ["server.ts"],
  outfile: "api/vercel-server-bundle.cjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: true,
  external: ["better-sqlite3", "pdf-parse", "vite", "word-extractor"],
});
