import type { Texture } from 'pixi.js'
import { Assets } from 'pixi.js'

const imageAssets = {
	lightToast: 'lightToast.png',
	mediumToast: 'mediumToast.png',
	roll1: 'roll1.png',
	roll2: 'roll2.png',
	roll3: 'roll3.png',
	roll4: 'roll4.png',
	roll5: 'roll5.png',
	roll6: 'roll6.png',
	roll7: 'roll7.png',
	roll8: 'roll8.png',
	roll9: 'roll9.png',
	roll10: 'roll10.png',
	roll11: 'roll11.png',
	roll12: 'roll12.png',
	roll13: 'roll13.png',
	roll14: 'roll14.png',
	roll15: 'roll15.png',
	roll16: 'roll16.png',
	roll17: 'roll17.png',
	roll18: 'roll18.png',
	roll19: 'roll19.png',
	roll20: 'roll20.png',
	toastPop1: 'toastPop1.png',
	toastPop2: 'toastPop2.png',
	toastPop3: 'toastPop3.png',
	toastPop4: 'toastPop4.png',
}

export type ImageKey = keyof typeof imageAssets

export type GameAssets = Record<ImageKey, Texture>

/**
 * Loads every sprite texture used by the game.
 */
export async function loadAssets(): Promise<GameAssets> {
	for (const [key, path] of Object.entries(imageAssets)) {
		Assets.add({
			alias: key,
			data: { scaleMode: 'nearest' },
			src: `${import.meta.env.BASE_URL}/${path}`,
		})
	}

	const textures = await Assets.load<Texture>(Object.keys(imageAssets))

	for (const key of Object.keys(imageAssets)) {
		if (!Object.hasOwn(textures, key)) {
			throw new Error(`Failed to load image asset "${key}"`)
		}
	}

	return textures as GameAssets
}
