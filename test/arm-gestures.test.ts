import { expect, test } from 'vitest'
import type { UpperBodyPose } from '../src/tracking/arm-gestures'
import { ArmGestures } from '../src/tracking/arm-gestures'

const options = { clapVelocityThreshold: 10, flapTravelThreshold: 0.35 }

test('tracked player metadata does not invalidate the arm pose', () => {
	const pose = { ...body(-0.8), id: 1 }
	expect(new ArmGestures().update(pose, 0, options).wingPosition).toBe('up')
})

function body(height: number, span = 160, offset = 0): UpperBodyPose {
	return {
		leftHand: { x: 320 - span * 1.5, y: 200 + offset + height * span },
		leftShoulder: { x: 320 - span / 2, y: 200 + offset },
		rightHand: { x: 320 + span * 1.5, y: 200 + offset + height * span },
		rightShoulder: { x: 320 + span / 2, y: 200 + offset },
	}
}

for (const [height, wing] of [
	[-0.8, 'up'],
	[0, 'level'],
	[0.8, 'down'],
] as const) {
	test(`wings start ${wing} from the first pose without calibration or a false flap`, () => {
		const result = new ArmGestures().update(body(height), 0, options)
		expect(result.wingPosition).toBe(wing)
		expect(result.didFlap).toBe(false)
		expect(result.didClap).toBe(false)
	})
}

for (const rate of [10, 15, 30, 60]) {
	for (const period of [400, 1200, 4000]) {
		test(`one lift per downstroke at ${rate} Hz and ${period} ms per cycle`, () => {
			for (const span of [70, 160, 260]) {
				const detector = new ArmGestures()
				let flaps = 0
				for (let frame = 0; frame <= Math.round((3 * period * rate) / 1000); frame++) {
					const time = (frame * 1000) / rate
					const phase = (time % period) / period
					const height = -0.8 + (phase < 0.5 ? phase : 1 - phase) * 3.2
					if (detector.update(body(height, span), time, options).didFlap) {
						flaps++
					}
				}

				expect(flaps, `shoulder width ${span}`).toBe(3)
			}
		})
	}
}

test('stationary noise, whole-body movement and changing distance do not flap', () => {
	const detector = new ArmGestures()
	for (let frame = 0; frame < 180; frame++) {
		const pose = body(Math.sin(frame) * 0.025, 160 + frame / 2, Math.sin(frame / 10) * 60)
		const result = detector.update(pose, (frame * 1000) / 30, options)
		expect(result.didFlap).toBe(false)
		expect(result.didClap).toBe(false)
		expect(result.wingPosition).toBe('level')
	}
})

test('slow downward drift and holding lowered arms do not repeatedly generate lift', () => {
	const detector = new ArmGestures()
	let flaps = 0
	for (let frame = 0; frame < 300; frame++) {
		if (detector.update(body(frame / 600), (frame * 1000) / 30, options).didFlap) {
			flaps++
		}
	}

	expect(flaps).toBe(0)
})

test('wings follow both arms within two fresh 30 Hz observations', () => {
	const detector = new ArmGestures()
	detector.update(body(-0.6), 0, options)
	detector.update(body(-0.3), 33, options)
	expect(detector.update(body(0), 67, options).wingPosition).toBe('level')
	detector.update(body(0.3), 100, options)
	expect(detector.update(body(0.6), 133, options).wingPosition).toBe('down')
})

test('wing hysteresis prevents flicker around the up/level boundary', () => {
	const detector = new ArmGestures()
	detector.update(body(-0.5), 0, options)
	for (let frame = 1; frame < 90; frame++) {
		expect(
			detector.update(body(-0.25 + Math.sin(frame) * 0.025), frame * 33, options).wingPosition,
		).toBe('up')
	}
})

test('duplicate and out-of-order samples do not create flaps', () => {
	const detector = new ArmGestures()
	detector.update(body(-0.8), 100, options)
	expect(detector.update(body(0.8), 100, options).didFlap).toBe(false)
	expect(detector.update(body(0.8), 50, options).didFlap).toBe(false)
})

test('a single tracking spike does not produce lift or move the wings', () => {
	const detector = new ArmGestures()
	detector.update(body(-0.8), 0, options)
	const spike = detector.update(body(1.3), 33, options)
	expect(spike.didFlap).toBe(false)
	expect(spike.wingPosition).toBe('up')
	expect(detector.update(body(-0.8), 67, options).didFlap).toBe(false)
})

test('tracking gaps and player changes seed the pose without synthetic motion', () => {
	const detector = new ArmGestures()
	detector.update(body(-0.8), 0, options)
	const reacquired = detector.update(body(0.8), 500, options)
	expect(reacquired.didFlap).toBe(false)
	expect(reacquired.wingPosition).toBe('down')
	detector.reset()
	const replacement = detector.update(body(-0.8), 533, options)
	expect(replacement.didFlap).toBe(false)
	expect(replacement.wingPosition).toBe('up')
})

test('an upward recovery does not flap, but the next deliberate downstroke does', () => {
	const detector = new ArmGestures()
	for (let frame = 0; frame <= 10; frame++) {
		expect(detector.update(body(0.8 - frame * 0.16), frame * 33, options).didFlap).toBe(false)
	}

	let flaps = 0
	for (let frame = 1; frame <= 30; frame++) {
		if (
			detector.update(body(Math.min(0.8, -0.8 + frame * 0.16)), (10 + frame) * 33, options).didFlap
		) {
			flaps++
		}
	}

	expect(flaps).toBe(1)
})

test('bringing the hands together still claps without rolling or flapping', () => {
	const detector = new ArmGestures()
	detector.update(body(0), 0, options)
	let claps = 0
	for (let frame = 1; frame <= 8; frame++) {
		const pose = body(0)
		pose.leftHand.x += frame * 28
		pose.rightHand.x -= frame * 28
		const result = detector.update(pose, frame * 33, options)
		claps += Number(result.didClap)
		expect(result.didFlap).toBe(false)
		expect(result.rollAngle).toBe(0)
	}

	expect(claps).toBe(1)
})

test('tilting opposite arms banks without registering a flap', () => {
	const detector = new ArmGestures()
	const pose = body(0)
	pose.leftHand.y -= 160
	pose.rightHand.y += 160
	const result = detector.update(pose, 0, options)
	expect(result.rollAngle).toBeGreaterThan(15)
	expect(result.didFlap).toBe(false)
})
