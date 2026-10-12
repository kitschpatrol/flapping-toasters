import type { Keypoint, Pose } from '@tensorflow-models/pose-detection'
import { getPreviewViewport } from './preview-viewport'

// MoveNet's named connections, kept local so drawing never imports the TensorFlow runtime.
const chains = [
	// The shoulder bridge is independent so missing hips never fade it.
	['left_shoulder', 'right_shoulder'],
	['left_shoulder', 'left_hip', 'right_hip', 'right_shoulder'],
	['left_shoulder', 'left_elbow', 'left_wrist'],
	['right_shoulder', 'right_elbow', 'right_wrist'],
	['left_hip', 'left_knee', 'left_ankle'],
	['right_hip', 'right_knee', 'right_ankle'],
]

type PreviewPoint = { x: number; y: number }

function drawSegment(
	context: CanvasRenderingContext2D,
	start: PreviewPoint,
	end: PreviewPoint,
	fadeStart: boolean,
	fadeEnd: boolean,
): void {
	const length = Math.hypot(end.x - start.x, end.y - start.y)
	if (length === 0) {
		return
	}

	context.strokeStyle = '#fff'
	if (fadeStart || fadeEnd) {
		// Taper only the terminal portion, keeping the rest of the skeleton crisp.
		const fadeFraction = Math.min(0.5, (context.canvas.width * 0.075) / length)
		const gradient = context.createLinearGradient(start.x, start.y, end.x, end.y)
		gradient.addColorStop(0, fadeStart ? 'rgb(255 255 255 / 0%)' : '#fff')
		gradient.addColorStop(fadeFraction, '#fff')
		gradient.addColorStop(1 - fadeFraction, '#fff')
		gradient.addColorStop(1, fadeEnd ? 'rgb(255 255 255 / 0%)' : '#fff')
		context.strokeStyle = gradient
	}

	const path = new Path2D()
	path.moveTo(start.x, start.y)
	path.lineTo(end.x, end.y)
	context.stroke(path)
}

/** Draws mirrored skeleton chains with soft ends where tracking is incomplete. */
export function drawSkeletons(
	context: CanvasRenderingContext2D,
	poses: Pose[],
	videoWidth: number,
	videoHeight: number,
	minConfidence: number,
): void {
	const { width, height } = context.canvas
	const viewport = getPreviewViewport(width, height, videoWidth, videoHeight)
	if (viewport === undefined) {
		return
	}

	const toPreviewPoint = (keypoint: Keypoint): PreviewPoint | undefined =>
		keypoint.score === undefined ||
		!Number.isFinite(keypoint.score) ||
		keypoint.score < minConfidence ||
		!Number.isFinite(keypoint.x) ||
		!Number.isFinite(keypoint.y) ||
		keypoint.x < 0 ||
		keypoint.x >= videoWidth ||
		keypoint.y < 0 ||
		keypoint.y >= videoHeight
			? undefined
			: {
					x: viewport.x + viewport.width - (keypoint.x * viewport.width) / videoWidth,
					y: viewport.y + (keypoint.y * viewport.height) / videoHeight,
				}

	context.save()
	context.lineWidth = width / 80
	context.lineCap = 'round'
	context.lineJoin = 'round'

	for (const pose of poses) {
		const points = new Map(
			pose.keypoints.map((keypoint) => [keypoint.name, toPreviewPoint(keypoint)]),
		)
		for (const chain of chains) {
			const joints = chain.map((name) => points.get(name))
			for (let index = 0; index < joints.length - 1; index++) {
				const start = joints[index]
				const end = joints[index + 1]
				if (start === undefined || end === undefined) {
					continue
				}

				// Natural chain ends stay solid; missing neighboring joints fade the visible end.
				const fadeStart = index > 0 && joints[index - 1] === undefined
				const fadeEnd = index + 2 < joints.length && joints[index + 2] === undefined
				drawSegment(context, start, end, fadeStart, fadeEnd)
			}
		}
	}

	context.restore()
}
