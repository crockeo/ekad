await Bun.write("dist/index.html", Bun.file("frontend/index.html"));

// TODO: can we get this in-process?
const proc = Bun.spawn(
  [
    "bun",
    "run",
    "tailwindcss",
    "--input=./frontend/index.css",
    "--output=./dist/index.css",
  ],
);
await proc.exited;

await Bun.build({
  entrypoints: ["./frontend/index.tsx"],
  root: "./frontend",
  outdir: "./dist",
});
