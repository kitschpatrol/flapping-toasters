import type { Application } from 'pixi.js'
import { Sprite } from 'pixi.js'
import type { GameAssets } from './assets'
import { settings } from '../settings'

/**
 * Base class for things that drift around the screen, ported from the original
 * openFrameworks implementation.
 */
export class Mover {
	public readonly position = { x: 0, y: 0 }
	public readonly velocity = { x: 0, y: 0 }

	protected readonly app: Application
	protected readonly assets: GameAssets
	protected sprite: Sprite
	protected get graphicsScale(): number {
		const { resolution } = this.app.renderer
		// Fractional texel sizes can change nearest-neighbor samples as sprites move.
		return Math.max(1, Math.round(settings.graphicsScale * resolution)) / resolution
	}

	private remainingFrames = 0

	constructor(app: Application, assets: GameAssets) {
		this.app = app
		this.assets = assets
		this.sprite = new Sprite()
	}

	/**
	 * Removes this mover's sprite from the stage.
	 */
	public destroy(): void {
		this.sprite.destroy()
	}

	/**
	 * Keeps this mover at the same relative screen position after the window
	 * resizes.
	 */
	public handleResize(lastWidth: number, lastHeight: number): void {
		this.position.x = (this.position.x / lastWidth) * this.app.screen.width
		this.position.y = (this.position.y / lastHeight) * this.app.screen.height
		this.syncSpritePosition()
	}

	/** Advances fixed 60 Hz simulation steps using the ticker's deltaTime. */
	public update(delta: number): void {
		this.remainingFrames += delta
		// Avoid losing a step to rounding when fractional frame times add up to a whole frame.
		const steps = Math.floor(this.remainingFrames + 1e-9)
		this.remainingFrames = Math.max(0, this.remainingFrames - steps)
		for (let i = 0; i < steps; i++) {
			this.step()
		}

		// Refresh artwork and settings even when no simulation step is due.
		this.syncSpritePosition()
	}

	protected step(): void {
		// Override in subclass
	}

	protected syncSpritePosition(): void {
		this.syncSpriteScale()
		// Snap to physical display pixels, including fractional browser zoom levels.
		// Physics retains its fractional position, independently of rendering.
		const { resolution } = this.app.renderer
		this.sprite.x = Math.round(this.position.x * resolution) / resolution
		this.sprite.y = Math.round(this.position.y * resolution) / resolution
	}

	protected syncSpriteScale(): void {
		this.sprite.scale.set(this.graphicsScale)
	}
}
