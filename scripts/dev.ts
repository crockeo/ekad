import tailwindcss from "tailwindcss";

async function build() {
	console.log("Copying index.html...");
	await Bun.write("dist/index.html", Bun.file("frontend/index.html"));
	
	console.log("Building tailwind CSS...");
	tailwindcss();
	
	console.log("Running Bun.build...");
	Bun.build({
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
