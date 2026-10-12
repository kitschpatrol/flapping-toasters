import { expect, test } from 'vitest'
import { getPreviewViewport } from '../src/ui/preview-viewport'

for (const [videoWidth, videoHeight] of [
	[640, 480],
	[480, 640],
	[720, 1280],
	[1920, 1080],
	[1080, 1080],
	[1920, 1440],
] as const) {
	test(`${videoWidth}×${videoHeight} camera feed stays undistorted inside the preview`, () => {
		const viewport = getPreviewViewport(640, 480, videoWidth, videoHeight)
		expect(viewport).toBeDefined()
		if (viewport === undefined) {
			throw new Error('Expected a valid viewport')
		}

		// A square in camera pixels must still be square in preview pixels.
		expect(viewport.width / videoWidth).toBeCloseTo(viewport.height / videoHeight, 10)
		expect(viewport.x + viewport.width / 2).toBe(320)
		expect(viewport.y + viewport.height / 2).toBe(240)
		expect(viewport.x).toBeGreaterThanOrEqual(0)
		expect(viewport.y).toBeGreaterThanOrEqual(0)
		expect(viewport.x + viewport.width).toBeLessThanOrEqual(640)
		expect(viewport.y + viewport.height).toBeLessThanOrEqual(480)
	})
}

test('portrait video is padded on the sides and widescreen video above and below', () => {
	expect(getPreviewViewport(640, 480, 480, 640)).toEqual({ height: 480, width: 360, x: 140, y: 0 })
	expect(getPreviewViewport(640, 480, 1920, 1080)).toEqual({ height: 360, width: 640, x: 0, y: 60 })
})

test('missing or invalid camera dimensions cannot produce a malformed viewport', () => {
	for (const dimension of [0, -1, NaN, Infinity]) {
		expect(getPreviewViewport(640, 480, dimension, 480)).toBeUndefined()
		expect(getPreviewViewport(640, 480, 640, dimension)).toBeUndefined()
	}
})
