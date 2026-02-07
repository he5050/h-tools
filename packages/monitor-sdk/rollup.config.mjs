import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import typescript from "@rollup/plugin-typescript"
import dts from "rollup-plugin-dts"
import terser from "@rollup/plugin-terser"

const pkg = {
	main: "dist/index.cjs.js",
	module: "dist/index.esm.js",
	unpkg: "dist/index.umd.js",
}

const isProduction = process.env.NODE_ENV === "production"

export default [
	{
		input: "src/index.ts",
		output: [
			{
				file: pkg.main,
				format: "cjs",
				sourcemap: true,
				exports: "named",
			},
			{
				file: pkg.module,
				format: "esm",
				sourcemap: true,
			},
			{
				file: pkg.unpkg,
				format: "umd",
				name: "MonitorSDK",
				sourcemap: true,
				globals: {},
			},
		],
		plugins: [
			resolve({
				browser: true,
				preferBuiltins: false,
			}),
			commonjs(),
			typescript({
				tsconfig: "./tsconfig.json",
				declaration: false,
				declarationMap: false,
			}),
			isProduction &&
				terser({
					compress: {
						drop_console: true,
						pure_funcs: ["console.log", "console.info", "console.debug"],
					},
					mangle: {
						reserved: ["MonitorSDK", "init", "getMonitor", "destroy"],
					},
				}),
		].filter(Boolean),
		external: [],
	},
	{
		input: "src/index.ts",
		output: [
			{
				file: "dist/index.d.ts",
				format: "esm",
			},
		],
		plugins: [
			dts({
				tsconfig: "./tsconfig.json",
			}),
		],
	},
]
