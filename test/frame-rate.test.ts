import { Application, Container, Rectangle, Sprite, Texture, TextureSource } from 'pixi.js'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { GameAssets } from '../src/game/assets'
import type { SoundBoard } from '../src/game/sound-board'
import { Flapper } from '../src/game/flapper'
import { Toast } from '../src/game/toast'
import { settings } from '../src/settings'

const app = new Application()
const texture = (size: number) =>
	new Texture({ source: new TextureSource({ width: size, height: size }) })
const assets = Object.fromEntries([
	['lightToast', texture(50)],
	['mediumToast', texture(50)],
	...Array.from({ length: 20 }, (_, index) => [`roll${index + 1}`, texture(100)]),
	...Array.from({ length: 4 }, (_, index) => [`toastPop${index + 1}`, texture(150)]),
]) as GameAssets
const sounds = { playFlap: vi.fn(), playToasterPop: vi.fn() } as unknown as SoundBoard
const containers: Container[] = []

beforeEach(() => {
	Reflect.set(app, 'renderer', { resolution: 1 })
	vi.spyOn(app, 'screen', 'get').mockReturnValue(new Rectangle(0, 0, 1280, 900))
	vi.spyOn(performance, 'now').mockReturnValue(10_000)
})

afterEach(() => {
	for (const container of containers.splice(0)) {
		container.destroy({ children: true })
	}

	vi.restoreAllMocks()
})

function createContainer(): Container {
	const result = new Container()
	containers.push(result)
	return result
}

function spriteAt(parent: Container, index = 0): Sprite {
	const sprite = parent.getChildAt(index)
	if (!(sprite instanceof Sprite)) {
		throw new TypeError('Expected a sprite')
	}

	return sprite
}

function pose(tilt = 0, reach = 1.5) {
	return {
		leftHand: { x: -reach * 100, y: -tilt * 100 },
		leftShoulder: { x: -50, y: 0 },
		rightHand: { x: reach * 100, y: tilt * 100 },
		rightShoulder: { x: 50, y: 0 },
	}
}

for (const fps of [15, 20, 30, 60, 120, 144]) {
	test(`toast travels the same distance in one second at ${fps} FPS`, () => {
		const toast = new Toast(app, assets, createContainer())
		toast.position.x = 500
		toast.position.y = 400
		for (let i = 0; i < fps; i++) {
			toast.update(60 / fps)
		}

		expect(toast.position).toEqual({ x: 440, y: 430 })
	})

	for (const motion of ['fall', 'flap', 'roll-left', 'roll-right', 'ground'] as const) {
		test(`${motion} matches 60 FPS physics and animation at ${fps} FPS`, () => {
			function simulate(rate: number) {
				const parent = createContainer()
				const flapper = new Flapper(app, assets, parent, sounds, vi.fn<() => void>())
				flapper.position.x = 500
				flapper.position.y = motion === 'ground' ? 699 : 400
				const tilt = motion === 'roll-left' ? 1 : motion === 'roll-right' ? -1 : 0
				flapper.updatePose(pose(tilt), 0)
				if (motion === 'flap') {
					flapper.velocity.y = 0.5 - settings.flapPower
				}

				for (let i = 0; i < rate; i++) {
					flapper.update(60 / rate)
				}

				return {
					position: flapper.position,
					texture: spriteAt(parent).texture,
					velocity: flapper.velocity,
				}
			}

			const expected = simulate(60)
			const actual = simulate(fps)
			expect(actual.position).toEqual(expected.position)
			expect(actual.velocity).toEqual(expected.velocity)
			expect(actual.texture).toBe(expected.texture)
		})
	}
}

for (const fps of [15, 30, 60, 120]) {
	test(`popped toast has the same position and animation after 1/15 second at ${fps} FPS`, () => {
		const parent = createContainer()
		const flapper = new Flapper(app, assets, parent, sounds, vi.fn<() => void>())
		flapper.position.x = 500
		flapper.position.y = 400
		for (const [frame, reach] of [1.5, 0.8, 0.2].entries()) {
			flapper.updatePose(pose(0, reach), frame * 100)
		}

		for (let i = 0; i < fps / 15; i++) {
			flapper.update(60 / fps)
		}

		const pop = spriteAt(parent, 1)
		expect(pop.x).toBe(500 - 75 * settings.graphicsScale - 8)
		expect(pop.y).toBe(400 - 100 * settings.graphicsScale + 4)
		expect(pop.texture).toBe(assets.toastPop2)
	})
}

test('zero elapsed time draws without moving and fractional frame times accumulate', () => {
	const parent = createContainer()
	const toast = new Toast(app, assets, parent)
	toast.position.x = 500
	toast.position.y = 400
	toast.update(0)
	expect(toast.position).toEqual({ x: 500, y: 400 })
	expect(spriteAt(parent).x).toBe(500)
	toast.update(0.4)
	expect(toast.position).toEqual({ x: 500, y: 400 })
	toast.update(0.6)
	expect(toast.position).toEqual({ x: 499, y: 400.5 })
	for (const delta of [0.25, 0.75, 2.5, 0.5, 3, 1]) {
		toast.update(delta)
	}

	expect(toast.position).toEqual({ x: 491, y: 404.5 })
})
