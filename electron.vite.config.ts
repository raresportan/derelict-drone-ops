import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const bundled = ["@raresportan/marram"];

export default defineConfig({
	main: { plugins: [externalizeDepsPlugin({ exclude: bundled })] },
	preload: {
		plugins: [externalizeDepsPlugin({ exclude: bundled })],
		build: { rollupOptions: { output: { format: "cjs", entryFileNames: "[name].cjs" } } },
	},
	renderer: { base: "./" },
});
