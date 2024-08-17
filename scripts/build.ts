async function build() {
	Bun.build({
		entrypoints: ["./index.tsx"],
		root: "./frontend",
		outdir: "./dist",
	});
}

await build();
