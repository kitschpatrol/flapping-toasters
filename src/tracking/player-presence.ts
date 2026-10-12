import type { Keypoint, Pose } from '@tensorflow-models/pose-detection'
import { settings } from '../settings'

const entryHoldTime = 750
const maxObservationGap = 2000

/** Confirms a stable upper body at playing distance. */
export class PlayerPresence {
	private candidates = new Map<number, { firstSeen: number; frames: number; lastSeen: number }>()

	/** Clears observations when tracking restarts. */
	public reset(): void {
		this.candidates.clear()
	}

	/** Checks whether a player has stayed in range long enough. */
	public update(poses: Pose[], width: number, height: number, now: number): boolean {
		const candidates = new Map<number, { firstSeen: number; frames: number; lastSeen: number }>()
		let isReady = false
		for (const pose of poses) {
			if (pose.id === undefined || !this.isInRange(pose, width, height)) {
				continue
			}

			const previous = this.candidates.get(pose.id)
			const candidate =
				previous !== undefined && now - previous.lastSeen <= maxObservationGap
					? { firstSeen: previous.firstSeen, frames: previous.frames + 1, lastSeen: now }
					: { firstSeen: now, frames: 1, lastSeen: now }
			candidates.set(pose.id, candidate)
			if (candidate.frames >= 3 && now - candidate.firstSeen >= entryHoldTime) {
				isReady = true
			}
		}

		this.candidates = candidates
		return isReady
	}

	private isInRange(pose: Pose, width: number, height: number): boolean {
		if (width <= 0 || height <= 0) {
			return false
		}

		const leftShoulder = pose.keypoints.find((point) => point.name === 'left_shoulder')
		const rightShoulder = pose.keypoints.find((point) => point.name === 'right_shoulder')
		const leftWrist = pose.keypoints.find((point) => point.name === 'left_wrist')
		const rightWrist = pose.keypoints.find((point) => point.name === 'right_wrist')
		const isVisible = (point: Keypoint | undefined): point is Keypoint =>
			point !== undefined &&
			(point.score ?? 0) >= Math.max(0.5, settings.minKeypointScore) &&
			point.x >= 0 &&
			point.x <= width &&
			point.y >= 0 &&
			point.y <= height
		if (
			!isVisible(leftShoulder) ||
			!isVisible(rightShoulder) ||
			!isVisible(leftWrist) ||
			!isVisible(rightWrist)
		) {
			return false
		}

		// Shoulder span estimates proximity without changing when the player flaps their arms.
		return (
			Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y) / width >=
			settings.minPlayerShoulderWidth
		)
	}
}
