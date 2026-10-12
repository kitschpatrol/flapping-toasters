import type { Pose } from '@tensorflow-models/pose-detection'
import { expect, test } from 'vitest'
import { ArmGestures } from '../src/tracking/arm-gestures'
import { getTrackedBodies } from '../src/tracking/tracked-body'

const options = { clapVelocityThreshold: 10, flapTravelThreshold: 0.35 }

function observation(reach: number, height = 0.5, hiddenWrists = 0, span = 100) {
	const pose: Pose = {
		id: 1,
		keypoints: [
			{ name: 'left_shoulder', score: 0.99, x: 320 + span / 2, y: 200 },
			{ name: 'right_shoulder', score: 0.99, x: 320 - span / 2, y: 200 },
			{
				name: 'left_wrist',
				score: hiddenWrists > 0 ? 0.1 : 0.99,
				x: 320 + reach * span,
				y: 200 + height * span,
			},
			{
				name: 'right_wrist',
				score: hiddenWrists > 1 ? 0.1 : 0.99,
				x: 320 - reach * span,
				y: 200 + height * span,
			},
		],
	}
	const body = getTrackedBodies([pose], 640, 480, 0.3, 0.03)[0]
	if (body === undefined) {
		throw new Error('The fixture shoulders should remain tracked')
	}

	return body
}

for (const rate of [10, 15, 30, 60]) {
	for (const hiddenWrists of [1, 2]) {
		for (const span of [40, 100, 180]) {
			test(`chest clap survives ${hiddenWrists} occluded wrists at ${rate} Hz, span ${span}`, () => {
				const detector = new ArmGestures()
				let claps = 0
				for (let frame = 0; frame <= rate; frame++) {
					const hidden = frame > 2 && frame < 2 + rate / 5
					const reach = frame < 3 ? 0.85 - frame * 0.2 : 0.15
					const result = detector.update(
						observation(reach, 0.5, hidden ? hiddenWrists : 0, span),
						(frame * 1000) / rate,
						options,
					)
					claps += Number(result.didClap)
					expect(result.didFlap).toBe(false)
				}

				expect(claps).toBe(1)
			})
		}
	}
}

test('a committed approach can clap during occlusion without waiting for wrists to reappear', () => {
	const detector = new ArmGestures()
	for (let frame = 0; frame <= 2; frame++) {
		expect(detector.update(observation(0.85 - frame * 0.2), frame * 50, options).didClap).toBe(
			false,
		)
	}

	expect(detector.update(observation(0.15, 0.5, 2), 200, options).didClap).toBe(true)
	expect(detector.update(observation(0.15, 0.5, 2), 250, options).didClap).toBe(false)
	expect(detector.update(observation(0.15), 300, options).didClap).toBe(false)
})

for (const motion of ['stationary', 'downward', 'far apart'] as const) {
	test(`${motion} wrists disappearing do not generate a clap, even at threshold zero`, () => {
		const detector = new ArmGestures()
		for (let frame = 0; frame < 20; frame++) {
			const reach =
				motion === 'far apart'
					? 1.5 - Math.min(frame, 2) * 0.2
					: motion === 'stationary'
						? 0.45
						: 0.85 - Math.min(frame, 2) * 0.2
			const height = motion === 'downward' ? -0.5 + Math.min(frame, 2) * 0.6 : 0.5
			const result = detector.update(observation(reach, height, frame > 2 ? 2 : 0), frame * 50, {
				...options,
				clapVelocityThreshold: 0,
			})
			expect(result.didClap).toBe(false)
		}
	})
}

test('a long occlusion or identity reset discards pending claps', () => {
	for (const reset of [false, true]) {
		const detector = new ArmGestures()
		for (let frame = 0; frame <= 2; frame++) {
			detector.update(observation(0.85 - frame * 0.2), frame * 50, options)
		}

		if (reset) {
			detector.reset()
		}

		expect(detector.update(observation(0.15, 0.5, 2), reset ? 200 : 500, options).didClap).toBe(
			false,
		)
		expect(detector.update(observation(0.15), 550, options).didClap).toBe(false)
	}
})

test('brief occlusion does not turn a reacquired lowered arm pose into a flap', () => {
	const detector = new ArmGestures()
	detector.update(observation(1.5, -0.8), 0, options)
	detector.update(observation(1.5, 0, 2), 100, options)
	const result = detector.update(observation(1.5, 0.8), 200, options)
	expect(result.didFlap).toBe(false)
	expect(result.didClap).toBe(false)
	expect(result.wingPosition).toBe('down')
})

test('reacquired contact can finish a clap even when the last pose was too wide to predict', () => {
	const detector = new ArmGestures()
	detector.update(observation(0.85), 0, options)
	detector.update(observation(0.65), 50, options)
	expect(detector.update(observation(0.4, 0.5, 2), 100, options).didClap).toBe(false)
	const result = detector.update(observation(0.15), 200, options)
	expect(result.didClap).toBe(true)
	expect(result.didFlap).toBe(false)
})
