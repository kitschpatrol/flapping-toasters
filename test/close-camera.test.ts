import type { Pose } from '@tensorflow-models/pose-detection'
import { expect, test } from 'vitest'
import { ArmGestures, hasTrackedArms } from '../src/tracking/arm-gestures'
import { PlayerPresence } from '../src/tracking/player-presence'
import { getTrackedBodies } from '../src/tracking/tracked-body'

const options = { clapVelocityThreshold: 10, flapTravelThreshold: 0.35 }

function cameraPose(height: number, span = 320, wristsVisible = false, score = 0.99): Pose {
	return {
		id: 1,
		keypoints: [
			{ name: 'left_shoulder', score, x: 320 + span / 2, y: 160 },
			{ name: 'right_shoulder', score, x: 320 - span / 2, y: 160 },
			{ name: 'left_elbow', score, x: 320 + span * 0.8, y: 160 + height * span },
			{ name: 'right_elbow', score, x: 320 - span * 0.8, y: 160 + height * span },
			{
				name: 'left_wrist',
				score,
				x: 320 + span * (wristsVisible ? 0.9 : 1.5),
				y: 160 + height * span,
			},
			{
				name: 'right_wrist',
				score,
				x: 320 - span * (wristsVisible ? 0.9 : 1.5),
				y: 160 + height * span,
			},
		],
	}
}

function tracked(pose: Pose) {
	const body = getTrackedBodies([pose], 640, 480, 0.3, 0.03)[0]
	if (body === undefined) {
		throw new Error('Fixture shoulders should be visible')
	}

	return body
}

for (const rate of [10, 15, 30, 60]) {
	test(`close-up elbows produce one boost per downstroke with offscreen wrists at ${rate} Hz`, () => {
		const gestures = new ArmGestures()
		let flaps = 0
		const wings = new Set<string>()
		for (let frame = 0; frame <= 3 * rate; frame++) {
			const phase = (frame % rate) / rate
			const body = tracked(cameraPose(-0.4 + Math.min(phase, 1 - phase) * 1.6))
			expect(body.leftHand).toBeUndefined()
			expect(body.rightHand).toBeUndefined()
			expect(hasTrackedArms(body)).toBe(true)
			const result = gestures.update(body, (frame * 1000) / rate, options)
			flaps += Number(result.didFlap)
			wings.add(result.wingPosition)
			expect(result.didClap).toBe(false)
		}

		expect(flaps).toBe(3)
		expect(wings).toEqual(new Set(['down', 'level', 'up']))
	})
}

for (const wristsVisible of [false, true]) {
	test(`repeated strokes below shoulder height still boost using ${wristsVisible ? 'wrists' : 'elbows'}`, () => {
		const gestures = new ArmGestures()
		let flaps = 0
		for (let frame = 0; frame <= 90; frame++) {
			const phase = (frame % 30) / 30
			const result = gestures.update(
				tracked(cameraPose(0.25 + Math.min(phase, 1 - phase), 320, wristsVisible)),
				(frame * 1000) / 30,
				options,
			)
			flaps += Number(result.didFlap)
		}

		expect(flaps).toBe(3)
	})
}

test('switching between wrists and elbows cannot invent boosts or claps', () => {
	const gestures = new ArmGestures()
	for (let frame = 0; frame < 30; frame++) {
		const pose = cameraPose(frame % 2 === 0 ? -0.4 : 0.6, 320, frame % 2 === 0)
		const result = gestures.update(tracked(pose), frame * 50, options)
		expect(result.didFlap).toBe(false)
		expect(result.didClap).toBe(false)
	}
})

test('stationary close-up elbow noise and body movement do not generate lift', () => {
	const gestures = new ArmGestures()
	for (let frame = 0; frame < 90; frame++) {
		const pose = cameraPose(Math.sin(frame) * 0.01)
		for (const point of pose.keypoints) {
			point.y += Math.sin(frame / 10) * 60
		}

		const result = gestures.update(tracked(pose), frame * 33, options)
		expect(result.didFlap).toBe(false)
		expect(result.didClap).toBe(false)
	}
})

test('close-up tracking needs both confident elbows when wrists are outside the frame', () => {
	const pose = cameraPose(0)
	for (const point of pose.keypoints) {
		if (point.name?.endsWith('elbow')) {
			point.score = 0.1
		}
	}

	expect(hasTrackedArms(tracked(pose))).toBe(false)
	expect(new ArmGestures().update(tracked(pose), 0, options).didFlap).toBe(false)
})

for (const wristsVisible of [false, true]) {
	test(`intro accepts playable close-up tracking with wrists ${wristsVisible ? 'visible' : 'offscreen'}`, () => {
		const presence = new PlayerPresence()
		const pose = cameraPose(0, 320, wristsVisible, 0.4)
		expect(presence.update([pose], 640, 480, 0)).toBe(false)
		expect(presence.update([pose], 640, 480, 400)).toBe(false)
		expect(presence.update([pose], 640, 480, 800)).toBe(true)
		presence.reset()
		expect(presence.update([pose], 640, 480, 850)).toBe(false)
	})
}

test('intro still rejects distant, low-confidence, or armless observations', () => {
	for (const pose of [cameraPose(0, 60, true), cameraPose(0, 320, false, 0.1)]) {
		const presence = new PlayerPresence()
		for (const time of [0, 400, 800, 1200]) {
			expect(presence.update([pose], 640, 480, time)).toBe(false)
		}
	}

	const presence = new PlayerPresence()
	const pose = cameraPose(0)
	pose.keypoints = pose.keypoints.filter((point) => point.name?.endsWith('shoulder'))
	for (const time of [0, 400, 800, 1200]) {
		expect(presence.update([pose], 640, 480, time)).toBe(false)
	}
})
