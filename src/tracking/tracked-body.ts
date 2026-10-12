import type { Keypoint, Pose } from '@tensorflow-models/pose-detection'
import type { UpperBodyObservation } from './arm-gestures'

export type TrackedBody = UpperBodyObservation & { id: number }

/**
 * Mirrors tracked shoulders and available wrists in native camera pixels.
 * Missing wrists stay undefined; the minimum span is a fraction of camera
 * width.
 */
export function getTrackedBodies(
	poses: Pose[],
	width: number,
	height: number,
	minimumConfidence: number,
	minimumShoulderFraction: number,
): TrackedBody[] {
	if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
		return []
	}

	const bodies: TrackedBody[] = []
	const isVisible = (point: Keypoint | undefined): point is Keypoint =>
		point !== undefined &&
		(point.score ?? 0) >= minimumConfidence &&
		Number.isFinite(point.x) &&
		Number.isFinite(point.y) &&
		point.x >= 0 &&
		point.x <= width &&
		point.y >= 0 &&
		point.y <= height
	const mirror = (point: Keypoint): { x: number; y: number } => ({
		x: width - point.x,
		y: point.y,
	})

	for (const pose of poses) {
		const leftWrist = pose.keypoints.find((point) => point.name === 'left_wrist')
		const rightWrist = pose.keypoints.find((point) => point.name === 'right_wrist')
		const leftShoulder = pose.keypoints.find((point) => point.name === 'left_shoulder')
		const rightShoulder = pose.keypoints.find((point) => point.name === 'right_shoulder')
		if (pose.id === undefined || !isVisible(leftShoulder) || !isVisible(rightShoulder)) {
			continue
		}

		const shoulderSpan = Math.hypot(
			rightShoulder.x - leftShoulder.x,
			rightShoulder.y - leftShoulder.y,
		)
		if (shoulderSpan <= 0 || shoulderSpan / width < minimumShoulderFraction) {
			continue
		}

		bodies.push({
			id: pose.id,
			leftHand: isVisible(leftWrist) ? mirror(leftWrist) : undefined,
			leftShoulder: mirror(leftShoulder),
			rightHand: isVisible(rightWrist) ? mirror(rightWrist) : undefined,
			rightShoulder: mirror(rightShoulder),
		})
	}

	return bodies
}
