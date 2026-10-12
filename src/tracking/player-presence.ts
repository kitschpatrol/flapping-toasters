import type { Pose } from '@tensorflow-models/pose-detection'
import { settings } from '../settings'
import { hasTrackedArms } from './arm-gestures'
import { getTrackedBodies } from './tracked-body'

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
		const bodies = getTrackedBodies(
			poses,
			width,
			height,
			settings.minKeypointScore,
			Math.max(settings.minPlayerShoulderWidth, settings.minTrackingShoulderWidth),
		)
		for (const pose of bodies) {
			if (!hasTrackedArms(pose)) {
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
}
