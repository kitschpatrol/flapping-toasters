/**
 * Fits the complete camera image into the preview without stretching or
 * cropping.
 */
export function getPreviewViewport(
	width: number,
	height: number,
	videoWidth: number,
	videoHeight: number,
): undefined | { height: number; width: number; x: number; y: number } {
	if (
		[width, height, videoWidth, videoHeight].some(
			(dimension) => !Number.isFinite(dimension) || dimension <= 0,
		)
	) {
		return undefined
	}

	const scale = Math.min(width / videoWidth, height / videoHeight)
	const fittedWidth = videoWidth * scale
	const fittedHeight = videoHeight * scale
	return {
		height: fittedHeight,
		width: fittedWidth,
		x: (width - fittedWidth) / 2,
		y: (height - fittedHeight) / 2,
	}
}
