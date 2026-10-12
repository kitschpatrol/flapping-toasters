import { cloudflare } from '@cloudflare/vite-plugin'
import path from 'node:path'
import { defineConfig } from 'vite'

const base = '/flapping-toasters'

export default defineConfig({
	base,
	build: {
		// TensorFlow.js is a single large runtime that can't usefully be split further
		chunkSizeWarningLimit: 2000,
	},
	plugins: [
		cloudflare({
			/* eslint-disable ts/naming-convention -- Cloudflare's configuration requires these property names. */
			config: {
				assets: {
					base_path: base,
					html_handling: 'drop-trailing-slash',
					not_found_handling: 'none',
				},
				compatibility_date: '2026-10-11',
				name: 'flapping-toasters',
				observability: { enabled: true },
				preview_urls: false,
				routes: [{ pattern: `frontiernerds.com${base}*`, zone_name: 'frontiernerds.com' }],
				workers_dev: false,
			},
			/* eslint-enable ts/naming-convention */
		}),
	],
	resolve: {
		alias: {
			// Alias MediaPipe packages to empty modules since we only use MoveNet
			'@mediapipe/face_mesh': path.resolve(
				import.meta.dirname,
				'src/compatibility/mediapipe-stub.ts',
			),
			'@mediapipe/hands': path.resolve(import.meta.dirname, 'src/compatibility/mediapipe-stub.ts'),
			'@mediapipe/pose': path.resolve(import.meta.dirname, 'src/compatibility/mediapipe-stub.ts'),
			'@mediapipe/selfie_segmentation': path.resolve(
				import.meta.dirname,
				'src/compatibility/mediapipe-stub.ts',
			),
		},
	},
	server: {
		open: process.env.CI === undefined,
	},
})
