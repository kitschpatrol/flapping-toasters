import type { Pose } from '@tensorflow-models/pose-detection'
import { expect, test } from 'vitest'
import type { UpperBodyPose } from '../src/tracking/arm-gestures'
import { settings } from '../src/settings'
import { ArmGestures } from '../src/tracking/arm-gestures'
import { getTrackedBodies } from '../src/tracking/tracked-body'

const options = { clapVelocityThreshold: 10, flapTravelThreshold: 0.35 }

function motion(frame: number): UpperBodyPose {
	const phase = (frame % 30) / 30
	const height = frame < 60 ? -0.8 + Math.min(phase, 1 - phase) * 3.2 : 0
	const reach = frame >= 80 && frame < 100 ? 1.5 - Math.min((frame - 80) / 12, 1) * 1.3 : 1.5
	return {
		leftHand: { x: -reach, y: frame >= 100 ? -0.7 : height },
		leftShoulder: { x: -0.5, y: 0 },
		rightHand: { x: reach, y: frame >= 100 ? 0.7 : height },
		rightShoulder: { x: 0.5, y: 0 },
	}
}

function cameraPose(pose: UpperBodyPose, width: number, height: number, span: number): Pose {
	const points = [
		['left_shoulder', pose.leftShoulder],
		['left_wrist', pose.leftHand],
		['right_shoulder', pose.rightShoulder],
		['right_wrist', pose.rightHand],
	] as const
	return {
		id: 23,
		keypoints: points.map(([name, point]) => ({
			name,
			score: 0.99,
			x: width / 2 - point.x * span,
			y: height / 2 + point.y * span,
		})),
	}
}

function replay(width: number, height: number, shoulderFraction: number, moving = false) {
	const detector = new ArmGestures()
	return Array.from({ length: 130 }, (_, frame) => {
		const span =
			Math.min(width, height) * shoulderFraction * (moving ? 1 + 0.3 * Math.sin(frame / 7) : 1)
		const bodies = getTrackedBodies(
			[cameraPose(motion(frame), width, height, span)],
			width,
			height,
			0.3,
			0,
		)
		const body = bodies[0]
		if (body === undefined) {
			throw new Error('The test pose should be confidently visible')
		}

		return detector.update(body, frame * (1000 / 30), options)
	})
}

const reference = replay(640, 480, 0.15)

test('the reference motion exercises flapping, clapping and banking', () => {
	expect(reference.filter((sample) => sample.didFlap).length).toBeGreaterThanOrEqual(2)
	expect(reference.some((sample) => sample.didClap)).toBe(true)
	expect(reference.some((sample) => sample.rollAngle > 15)).toBe(true)
	expect(new Set(reference.map((sample) => sample.wingPosition))).toEqual(
		new Set(['down', 'level', 'up']),
	)
})

for (const [width, height] of [
	[160, 120],
	[640, 480],
	[1280, 720],
	[1920, 1080],
	[720, 1280],
	[1080, 1080],
] as const) {
	for (const fraction of [0.01, 0.04, 0.15, 0.2]) {
		test(`same gesture and wing sequence at ${width}×${height}, shoulder fraction ${fraction}`, () => {
			const samples = replay(width, height, fraction)
			for (const [index, sample] of samples.entries()) {
				const expected = reference[index]
				expect(sample.didFlap).toBe(expected?.didFlap)
				expect(sample.didClap).toBe(expected?.didClap)
				expect(sample.wingPosition).toBe(expected?.wingPosition)
				expect(sample.rollAngle).toBeCloseTo(expected?.rollAngle ?? 0, 8)
			}
		})
	}
}

test('approaching and retreating during a gesture preserves its timing and wing positions', () => {
	const samples = replay(1280, 720, 0.1, true)
	for (const [index, sample] of samples.entries()) {
		const expected = reference[index]
		expect(sample.didFlap).toBe(expected?.didFlap)
		expect(sample.didClap).toBe(expected?.didClap)
		expect(sample.wingPosition).toBe(expected?.wingPosition)
		expect(sample.rollAngle).toBeCloseTo(expected?.rollAngle ?? 0, 8)
	}
})

test('degenerate or non-finite shoulders cannot produce a gesture', () => {
	for (const span of [0, Infinity, NaN]) {
		const pose = motion(0)
		pose.rightShoulder = { x: pose.leftShoulder.x + span, y: 0 }
		const result = new ArmGestures().update(pose, 0, options)
		expect(result.didFlap).toBe(false)
		expect(result.didClap).toBe(false)
		expect(Number.isFinite(result.rollAngle)).toBe(true)
	}
})

test('camera projection preserves tracked shoulders when a wrist is unavailable', () => {
	const pose = cameraPose(motion(0), 640, 480, 80)
	const wrist = pose.keypoints.find((point) => point.name === 'left_wrist')
	if (wrist === undefined) {
		throw new Error('Missing fixture wrist')
	}

	wrist.score = 0.1
	expect(getTrackedBodies([pose], 640, 480, 0.3, 0)).toMatchObject([
		{ id: 23, leftHand: undefined },
	])
	wrist.score = 0.99
	wrist.x = -1
	expect(getTrackedBodies([pose], 640, 480, 0.3, 0)).toMatchObject([
		{ id: 23, leftHand: undefined },
	])
	pose.keypoints = pose.keypoints.filter((point) => point.name !== 'left_wrist')
	expect(getTrackedBodies([pose], 640, 480, 0.3, 0)).toMatchObject([
		{ id: 23, leftHand: undefined },
	])
	expect(getTrackedBodies([pose], 0, 480, 0.3, 0)).toEqual([])
	pose.keypoints = pose.keypoints.filter((point) => point.name !== 'left_shoulder')
	expect(getTrackedBodies([pose], 640, 480, 0.3, 0)).toEqual([])
})

for (const [width, height] of [
	[160, 120],
	[640, 480],
	[1920, 1080],
	[720, 1280],
] as const) {
	test(`minimum tracking size uses camera width at ${width}×${height}`, () => {
		const threshold = settings.minTrackingShoulderWidth
		const tooSmall = cameraPose(motion(0), width, height, width * threshold * 0.8)
		const largeEnough = cameraPose(motion(0), width, height, width * threshold * 1.2)
		expect(getTrackedBodies([tooSmall], width, height, 0.3, threshold)).toEqual([])
		expect(getTrackedBodies([largeEnough], width, height, 0.3, threshold)).toHaveLength(1)
		expect(getTrackedBodies([tooSmall], width, height, 0.3, 0)).toHaveLength(1)
	})
}
