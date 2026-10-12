import { Application, Container, Rectangle, Sprite, Texture, TextureSource } from 'pixi.js'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { GameAssets } from '../src/game/assets'
import type { SoundBoard } from '../src/game/sound-board'
import { Flapper } from '../src/game/flapper'
import { Toast } from '../src/game/toast'
import { settings } from '../src/settings'

const defaultGraphicsScale = settings.graphicsScale
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

beforeEach(() => {
	Reflect.set(app, 'renderer', { resolution: 1 })
	vi.spyOn(app, 'screen', 'get').mockReturnValue(new Rectangle(0, 0, 1280, 900))
})

for (const resolution of [1, 1.25, 1.5, 2]) {
	test(`3× artwork stays on display pixels at resolution ${resolution}`, () => {
		Reflect.set(app, 'renderer', { resolution })
		settings.graphicsScale = 3
		const container = new Container()
		const toast = new Toast(app, assets, container)
		toast.position.x = 200.25
		toast.position.y = 100.25
		for (let frame = 0; frame < 30; frame++) {
			toast.update(1)
			const sprite = spriteAt(container)
			expect(sprite.x * resolution).toBeCloseTo(Math.round(toast.position.x * resolution), 8)
			expect(sprite.y * resolution).toBeCloseTo(Math.round(toast.position.y * resolution), 8)
			expect(sprite.width).toBeCloseTo((50 * Math.round(3 * resolution)) / resolution, 8)
		}

		container.destroy({ children: true })
	})
}

afterEach(() => {
	settings.graphicsScale = defaultGraphicsScale
	vi.restoreAllMocks()
})

function spriteAt(container: Container, index = 0): Sprite {
	const sprite = container.getChildAt(index)
	if (!(sprite instanceof Sprite)) {
		throw new TypeError('Expected a sprite')
	}

	return sprite
}

test('live scale changes retain fractional physics while drawing on whole pixels', () => {
	const container = new Container()
	const toast = new Toast(app, assets, container)
	toast.position.x = 200.25
	toast.position.y = 100.25
	for (const scale of [1, 2, 3, 1]) {
		settings.graphicsScale = scale
		toast.update(1)
		const sprite = spriteAt(container)
		expect(sprite.width).toBe(50 * scale)
		expect(sprite.x).toBe(Math.round(toast.position.x))
		expect(sprite.y).toBe(Math.round(toast.position.y))
		expect(toast.position.x % 1).toBe(0.25)
	}

	container.destroy({ children: true })
})

for (const scale of [1, 2, 3]) {
	test(`ground collision immediately uses the ${scale}× toaster size`, () => {
		const container = new Container()
		const flapper = new Flapper(app, assets, container, sounds, vi.fn<() => void>())
		flapper.position.x = 500
		flapper.position.y = 899
		settings.graphicsScale = scale
		flapper.update(1)
		expect(spriteAt(container).height).toBe(100 * scale)
		expect(flapper.position.y).toBe(900 - 100 * scale)
		container.destroy({ children: true })
	})

	test(`popped toast follows ${scale}× artwork and its scaled launch offset`, () => {
		vi.spyOn(performance, 'now').mockReturnValue(10_000)
		settings.graphicsScale = scale
		const container = new Container()
		const flapper = new Flapper(app, assets, container, sounds, vi.fn<() => void>())
		flapper.position.x = 500
		flapper.position.y = 400
		for (const [frame, reach] of [1.5, 0.8, 0.2].entries()) {
			flapper.updatePose(
				{
					leftHand: { x: -reach * 100, y: 0 },
					leftShoulder: { x: -50, y: 0 },
					rightHand: { x: reach * 100, y: 0 },
					rightShoulder: { x: 50, y: 0 },
				},
				frame * 100,
			)
		}

		flapper.update(1)
		const pop = spriteAt(container, 1)
		expect(pop.width).toBe(150 * scale)
		expect(pop.x).toBe(500 - 75 * scale - 2)
		expect(pop.y).toBe(400 - 100 * scale + 1)
		settings.graphicsScale = scale === 3 ? 1 : 3
		flapper.update(1)
		expect(pop.width).toBe(150 * settings.graphicsScale)
		container.destroy({ children: true })
	})
}
