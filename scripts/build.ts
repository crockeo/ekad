async function build() {
	console.log("Copying index.html...");
	await Bun.write("dist/index.html", Bun.file("frontend/index.html"));
	
	console.log("Running Bun.build...");
	await Bun.build({
		entrypoints: ["./index.tsx"],
		root: "./frontend",
		outdir: "./dist",
	});
}

try {
	await build();
} catch (e) {
	console.log("Build failed:");
	console.log(e);
}
