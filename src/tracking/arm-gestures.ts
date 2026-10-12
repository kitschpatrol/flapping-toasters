export type ArmPoint = { x: number; y: number }

export type UpperBodyPose = {
	leftHand: ArmPoint
	leftShoulder: ArmPoint
	rightHand: ArmPoint
	rightShoulder: ArmPoint
}

export type UpperBodyObservation = Omit<UpperBodyPose, 'leftHand' | 'rightHand'> & {
	leftHand: ArmPoint | undefined
	rightHand: ArmPoint | undefined
}

type GestureSettings = {
	clapVelocityThreshold: number
	flapTravelThreshold: number
}

type GestureResult = {
	didClap: boolean
	didFlap: boolean
	rollAngle: number
	wingPosition: 'down' | 'level' | 'up'
}

// All distances are in shoulder widths, independent of body size and camera distance.
const smoothingTime = 35
const trackingGap = 250
const wingBoundary = 0.25
const wingHysteresis = 0.07
const minimumDownwardSpeed = 0.4
const minimumFlapInterval = 180
const clapOpenDistance = 0.9
// MoveNet tracks wrists, which remain apart even when the palms meet.
const clapContactDistance = 0.65
const clapHandTravel = 0.05
const clapApproachWindow = 250

/**
 * Maps the current arm pose to wings and detects deliberate, repeatable
 * downstrokes and two-handed claps.
 */
export class ArmGestures {
	private armed = false
	private bottom = 0
	private clapApproachAt = -Infinity
	private clapPrevious:
		undefined | { left: ArmPoint; right: ArmPoint; separation: ArmPoint; timestamp: number }
	private clapStart: undefined | { leftX: number; rightX: number }
	private lastFlap = -Infinity
	private lastTimestamp: number | undefined
	private left: ArmPoint | undefined
	private motionInterrupted = false
	private predictedClapAt: number | undefined
	private right: ArmPoint | undefined
	private top = 0
	private wingPosition: GestureResult['wingPosition'] = 'level'

	/** Discards motion history when a player changes or tracking is interrupted. */
	public reset(): void {
		this.lastTimestamp = undefined
		this.left = undefined
		this.right = undefined
		this.clapPrevious = undefined
		this.clapStart = undefined
		this.clapApproachAt = -Infinity
		this.predictedClapAt = undefined
		this.motionInterrupted = false
		this.lastFlap = -Infinity
		this.wingPosition = 'level'
	}

	/**
	 * Consumes one fresh observation; the timestamp is the camera capture time in
	 * milliseconds.
	 */
	public update(
		pose: UpperBodyObservation,
		timestamp: number,
		settings: GestureSettings,
	): GestureResult {
		const result: GestureResult = {
			didClap: false,
			didFlap: false,
			rollAngle: 0,
			wingPosition: this.wingPosition,
		}
		const span = Math.hypot(
			pose.rightShoulder.x - pose.leftShoulder.x,
			pose.rightShoulder.y - pose.leftShoulder.y,
		)
		if (
			span <= 0 ||
			!Number.isFinite(span) ||
			!Number.isFinite(timestamp) ||
			[pose.leftHand, pose.rightHand, pose.leftShoulder, pose.rightShoulder].some(
				(point) => point !== undefined && (!Number.isFinite(point.x) || !Number.isFinite(point.y)),
			)
		) {
			this.reset()
			return result
		}

		if (this.lastTimestamp !== undefined && timestamp <= this.lastTimestamp) {
			return result
		}

		if (pose.leftHand === undefined || pose.rightHand === undefined) {
			return this.updateOccluded(timestamp, result)
		}

		const left = {
			x: (pose.leftHand.x - pose.leftShoulder.x) / span,
			y: (pose.leftHand.y - pose.leftShoulder.y) / span,
		}
		const right = {
			x: (pose.rightHand.x - pose.rightShoulder.x) / span,
			y: (pose.rightHand.y - pose.rightShoulder.y) / span,
		}
		const elapsed = this.lastTimestamp === undefined ? 0 : timestamp - this.lastTimestamp
		const previousLeft = this.left
		const previousRight = this.right
		const isFirstObservation =
			previousLeft === undefined || previousRight === undefined || elapsed > trackingGap
		if (isFirstObservation) {
			this.reset()
			this.left = left
			this.right = right
			this.top = (left.y + right.y) / 2
			this.bottom = this.top
			this.armed = this.top <= 0.2
		} else {
			// Ignore isolated implausible jumps instead of turning a tracking glitch into lift.
			const maximumJump = 0.2 + (12 * elapsed) / 1000
			if (
				Math.hypot(left.x - previousLeft.x, left.y - previousLeft.y) > maximumJump ||
				Math.hypot(right.x - previousRight.x, right.y - previousRight.y) > maximumJump
			) {
				return result
			}

			const alpha = 1 - Math.exp(-elapsed / smoothingTime)
			this.left = {
				x: previousLeft.x + alpha * (left.x - previousLeft.x),
				y: previousLeft.y + alpha * (left.y - previousLeft.y),
			}
			this.right = {
				x: previousRight.x + alpha * (right.x - previousRight.x),
				y: previousRight.y + alpha * (right.y - previousRight.y),
			}
		}

		this.lastTimestamp = timestamp
		const height = (this.left.y + this.right.y) / 2
		// Hands close together are usually clapping, not flapping or banking.
		const handsApart = (pose.rightHand.x - pose.leftHand.x) / span >= 0.9
		if (this.motionInterrupted) {
			// Reacquisition can finish a clap, but must not turn unobserved vertical
			// movement into a synthetic downstroke.
			this.top = height
			this.bottom = height
			this.armed = height <= 0.2
			this.motionInterrupted = false
		} else if (!isFirstObservation) {
			const previousHeight = (previousLeft.y + previousRight.y) / 2
			const downwardSpeed = ((height - previousHeight) * 1000) / elapsed
			result.didFlap = this.detectFlap(
				height,
				downwardSpeed,
				timestamp,
				settings.flapTravelThreshold,
				handsApart,
			)
		}

		result.didClap = this.detectClap(
			this.left,
			this.right,
			{
				x: (pose.rightHand.x - pose.leftHand.x) / span,
				y: (pose.rightHand.y - pose.leftHand.y) / span,
			},
			timestamp,
			settings.clapVelocityThreshold,
		)

		this.positionWings(height)
		result.wingPosition = this.wingPosition
		result.rollAngle = handsApart
			? (Math.atan2(this.right.y - this.left.y, (pose.rightHand.x - pose.leftHand.x) / span) *
					180) /
				Math.PI
			: 0
		return result
	}

	private detectClap(
		left: ArmPoint,
		right: ArmPoint,
		separation: ArmPoint,
		timestamp: number,
		threshold: number,
	): boolean {
		const previous = this.clapPrevious
		this.predictedClapAt = undefined
		this.clapPrevious = { left, right, separation, timestamp }
		if (separation.x >= clapOpenDistance) {
			// Keep the opening pose, not the last frame before contact. Otherwise
			// smaller claps lose most of their measured travel before they can fire.
			this.clapStart = {
				leftX: Math.min(this.clapStart?.leftX ?? left.x, left.x),
				rightX: Math.max(this.clapStart?.rightX ?? right.x, right.x),
			}
		}

		const start = this.clapStart
		if (previous === undefined || start === undefined) {
			return false
		}

		const seconds = (timestamp - previous.timestamp) / 1000
		const leftInward = (left.x - previous.left.x) / seconds
		const rightInward = (previous.right.x - right.x) / seconds
		const leftVertical = Math.abs(left.y - previous.left.y) / seconds
		const rightVertical = Math.abs(right.y - previous.right.y) / seconds
		// The slider controls combined closing speed, with no hidden minimum.
		const minimumSpeed = Math.max(0, (threshold * 30) / 160)
		const closingSpeed = leftInward + rightInward
		const verticalSpeed = leftVertical + rightVertical
		if (closingSpeed > minimumSpeed && closingSpeed > verticalSpeed * 0.8) {
			this.clapApproachAt = timestamp
		} else if (verticalSpeed > Math.max(1, closingSpeed)) {
			// A downward flap invalidates any earlier inward movement.
			this.clapApproachAt = -Infinity
		}

		// A quick clap can cross between observations without a sampled contact.
		const crossingFraction = previous.separation.x / (previous.separation.x - separation.x)
		const crossedAtContact =
			previous.separation.x > 0 &&
			separation.x <= 0 &&
			Math.abs(previous.separation.y + crossingFraction * (separation.y - previous.separation.y)) <=
				0.4
		const nearContact =
			Math.hypot(separation.x, separation.y) <= clapContactDistance && Math.abs(separation.y) <= 0.4
		const leftTravel = left.x - start.leftX
		const rightTravel = start.rightX - right.x
		if (
			timestamp - this.clapApproachAt > clapApproachWindow ||
			leftTravel < clapHandTravel ||
			rightTravel < clapHandTravel ||
			leftTravel + rightTravel < 0.3
		) {
			return false
		}

		this.predictClap(left, right, separation, { x: leftInward, y: rightInward }, timestamp)
		if (!nearContact && !crossedAtContact) {
			return false
		}

		// A held or jittering contact cannot clap again until the hands open apart.
		this.finishClap()
		return true
	}

	private detectFlap(
		height: number,
		downwardSpeed: number,
		timestamp: number,
		travel: number,
		handsApart: boolean,
	): boolean {
		this.bottom = Math.max(this.bottom, height)
		if (!this.armed && this.bottom - height >= travel && height <= 0.2) {
			this.armed = true
			this.top = height
		}

		if (!this.armed) {
			return false
		}

		this.top = Math.min(this.top, height)
		if (
			!handsApart ||
			height - this.top < travel ||
			downwardSpeed < minimumDownwardSpeed ||
			timestamp - this.lastFlap < minimumFlapInterval
		) {
			return false
		}

		this.lastFlap = timestamp
		this.armed = false
		this.bottom = height
		return true
	}

	private finishClap(): void {
		this.clapStart = undefined
		this.clapApproachAt = -Infinity
		this.predictedClapAt = undefined
	}

	private positionWings(height: number): void {
		const upperBoundary = -wingBoundary + (this.wingPosition === 'up' ? wingHysteresis : 0)
		const lowerBoundary = wingBoundary - (this.wingPosition === 'down' ? wingHysteresis : 0)
		this.wingPosition = height < upperBoundary ? 'up' : height > lowerBoundary ? 'down' : 'level'
	}

	private predictClap(
		left: ArmPoint,
		right: ArmPoint,
		separation: ArmPoint,
		inward: ArmPoint,
		timestamp: number,
	): void {
		// Predict only the last 120 ms of a clear two-hand convergence near the
		// chest. This bridges wrist occlusion without inventing missing joint poses.
		const secondsToContact = (separation.x - clapContactDistance) / (inward.x + inward.y)
		const middleHeight = (left.y + right.y) / 2
		if (
			this.clapApproachAt === timestamp &&
			inward.x > 0 &&
			inward.y > 0 &&
			separation.x <= 1.1 &&
			Math.abs(separation.y) <= 0.4 &&
			Math.abs((left.x + right.x) / 2) <= 0.5 &&
			middleHeight >= -0.25 &&
			middleHeight <= 1.5 &&
			secondsToContact > 0 &&
			secondsToContact <= 0.12
		) {
			this.predictedClapAt = timestamp + secondsToContact * 1000
		}
	}

	private updateOccluded(timestamp: number, result: GestureResult): GestureResult {
		if (this.lastTimestamp === undefined || timestamp - this.lastTimestamp > trackingGap) {
			this.reset()
			result.wingPosition = this.wingPosition
			return result
		}

		this.motionInterrupted = true
		if (this.predictedClapAt !== undefined && timestamp >= this.predictedClapAt) {
			result.didClap = true
			this.finishClap()
		}

		return result
	}
}
