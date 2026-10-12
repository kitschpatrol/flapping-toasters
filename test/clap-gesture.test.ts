import { expect, test } from 'vitest'
import type { ArmPoint, UpperBodyPose } from '../src/tracking/arm-gestures'
import { ArmGestures } from '../src/tracking/arm-gestures'

const options = { clapVelocityThreshold: 10, flapTravelThreshold: 0.35 }

function body(left: ArmPoint, right: ArmPoint, span = 160): UpperBodyPose {
	return {
		leftHand: { x: left.x * span, y: left.y * span },
		leftShoulder: { x: -span / 2, y: 0 },
		rightHand: { x: right.x * span, y: right.y * span },
		rightShoulder: { x: span / 2, y: 0 },
	}
}

for (const rate of [10, 15, 30, 60]) {
	for (const span of [16, 70, 160, 320]) {
		test(`deliberate claps fire at contact and rearm after opening at ${rate} Hz, span ${span}`, () => {
			const detector = new ArmGestures()
			let claps = 0
			for (let frame = 0; frame <= rate * 3; frame++) {
				const time = (frame * 1000) / rate
				const phase = time % 1500
				const reach =
					phase < 400
						? 1.5 - (1.4 * phase) / 400
						: phase < 1000
							? 0.1 + Math.sin(frame) * 0.025
							: 1.5
				const height = Math.min(phase / 400, 1) * 0.2
				const result = detector.update(
					body({ x: -reach, y: height }, { x: reach, y: height }, span),
					time,
					options,
				)
				if (!result.didClap) {
					continue
				}

				claps++
				expect(reach * 2).toBeLessThanOrEqual(0.65)
			}

			expect(claps).toBe(2)
		})
	}
}

const nonClaps: Array<{
	duration: number
	name: string
	pose: (progress: number) => UpperBodyPose
}> = [
	{
		duration: 300,
		name: 'fast diagonal downstroke ending with hands together',
		pose: (p) =>
			body({ x: -1.5 + 1.4 * p, y: -1.5 + 3 * p }, { x: 1.5 - 1.4 * p, y: -1.5 + 3 * p }),
	},
	{
		duration: 300,
		name: 'parallel downward flap',
		pose: (p) => body({ x: -1.5, y: -0.8 + 1.6 * p }, { x: 1.5, y: -0.8 + 1.6 * p }),
	},
	{
		duration: 400,
		name: 'single hand swiping toward a stationary hand',
		pose: (p) => body({ x: -1.5 + 2.8 * p, y: 0 }, { x: 1.5, y: 0 }),
	},
	{
		duration: 400,
		name: 'both arms sweeping in the same direction',
		pose: (p) => body({ x: -1.5 + 2 * p, y: 0 }, { x: 1.5 + 2 * p, y: 0 }),
	},
	{
		duration: 300,
		name: 'inward movement stopping short of contact',
		pose: (p) => body({ x: -1.5 + p, y: 0 }, { x: 1.5 - p, y: 0 }),
	},
	{
		duration: 400,
		name: 'hands passing at different heights',
		pose: (p) => body({ x: -1.5 + 1.4 * p, y: -0.4 }, { x: 1.5 - 1.4 * p, y: 0.4 }),
	},
	{
		duration: 3000,
		name: 'slowly bringing hands together',
		pose: (p) => body({ x: -1.5 + 1.4 * p, y: 0 }, { x: 1.5 - 1.4 * p, y: 0 }),
	},
	{
		duration: 600,
		name: 'inward approach followed by a downward sweep into contact',
		pose(p) {
			const reach = p < 0.5 ? 1.5 - 2 * p : 0.5 - 0.8 * (p - 0.5)
			const height = p < 0.5 ? 0 : 3 * (p - 0.5)
			return body({ x: -reach, y: height }, { x: reach, y: height })
		},
	},
]

for (const { duration, name, pose } of nonClaps) {
	for (const rate of [10, 30, 60]) {
		test(`${name} does not clap at ${rate} Hz`, () => {
			const detector = new ArmGestures()
			for (let frame = 0; frame <= Math.ceil(((duration + 500) * rate) / 1000); frame++) {
				const time = (frame * 1000) / rate
				expect(detector.update(pose(Math.min(1, time / duration)), time, options).didClap).toBe(
					false,
				)
			}
		})
	}
}

test('reacquiring hands already together does not clap', () => {
	const detector = new ArmGestures()
	detector.update(body({ x: -1.5, y: 0 }, { x: 1.5, y: 0 }), 0, options)
	detector.update(body({ x: -1, y: 0 }, { x: 1, y: 0 }), 100, options)
	for (let frame = 0; frame < 20; frame++) {
		const reach = 0.1 + Math.sin(frame) * 0.025
		expect(
			detector.update(body({ x: -reach, y: 0 }, { x: reach, y: 0 }), 500 + frame * 33, options)
				.didClap,
		).toBe(false)
	}
})

for (const rate of [10, 15, 30, 60]) {
	for (const span of [16, 160, 320]) {
		test(`a compact clap with wrist offset registers at ${rate} Hz, span ${span}`, () => {
			const detector = new ArmGestures()
			let claps = 0
			for (let frame = 0; frame <= rate; frame++) {
				const time = (frame * 1000) / rate
				const progress = Math.min(1, time / 300)
				const reach = 0.55 - progress * 0.35
				const result = detector.update(
					body({ x: -reach, y: progress * 0.2 }, { x: reach, y: progress * 0.2 + 0.3 }, span),
					time,
					options,
				)
				claps += Number(result.didClap)
			}

			expect(claps).toBe(1)
		})
	}
}

test('hands can approach at different times within the same clap', () => {
	const detector = new ArmGestures()
	let claps = 0
	for (let frame = 0; frame <= 30; frame++) {
		const time = (frame * 1000) / 30
		const left = -0.75 + Math.min(1, time / 150) * 0.6
		const right = 0.75 - Math.max(0, Math.min(1, (time - 150) / 200)) * 0.6
		claps += Number(
			detector.update(body({ x: left, y: 0 }, { x: right, y: 0 }), time, options).didClap,
		)
	}

	expect(claps).toBe(1)
})

test('a clap crossing between observations still registers once', () => {
	const detector = new ArmGestures()
	detector.update(body({ x: -0.5, y: 0 }, { x: 0.5, y: 0 }), 0, options)
	expect(detector.update(body({ x: 0.4, y: 0.1 }, { x: -0.4, y: 0 }), 100, options).didClap).toBe(
		true,
	)
	expect(detector.update(body({ x: 0.4, y: 0.1 }, { x: -0.4, y: 0 }), 200, options).didClap).toBe(
		false,
	)
})

for (const threshold of [0, 1, 10, 30]) {
	test(`clap speed threshold ${threshold} controls whether a gentle clap registers`, () => {
		const detector = new ArmGestures()
		let claps = 0
		for (let frame = 0; frame <= 60; frame++) {
			const time = (frame * 1000) / 30
			const reach = 0.55 - Math.min(1, time / 1500) * 0.35
			claps += Number(
				detector.update(body({ x: -reach, y: 0 }, { x: reach, y: 0 }), time, {
					...options,
					clapVelocityThreshold: threshold,
				}).didClap,
			)
		}

		expect(claps).toBe(threshold < 10 ? 1 : 0)
	})
}
