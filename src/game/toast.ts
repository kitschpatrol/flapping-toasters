import type { Application, Container, Texture } from 'pixi.js'
import { Sprite } from 'pixi.js'
import type { GameAssets } from './assets'
import { Mover } from './mover'

/**
 * A slice of toast drifting across the screen, ported from the original
 * openFrameworks implementation. Also doubles as the "toast pop" spawned when a
 * player claps: setting `popStage` to 0 and calling `popToast` each frame plays
 * the popping animation.
 */
export class Toast extends Mover {
	public popStage = 0

	private readonly toastPopTextures: Texture[]

	constructor(app: Application, assets: GameAssets, container: Container) {
		super(app, assets)

		this.toastPopTextures = [assets.toastPop1, assets.toastPop2, assets.toastPop3, assets.toastPop4]

		this.sprite = new Sprite(Math.random() > 0.5 ? assets.lightToast : assets.mediumToast)
		container.addChild(this.sprite)

		this.velocity.x = -1
		this.velocity.y = 0.5

		this.respawn()
		this.syncSpritePosition()
	}

	/**
	 * Advances the popping animation, holding on the final frame.
	 */
	public popToast(): void {
		const popIndex = Math.min(Math.floor(this.popStage / 2), this.toastPopTextures.length - 1)
		const texture = this.toastPopTextures[popIndex]

		if (texture !== undefined) {
			this.sprite.texture = texture
		}

		this.popStage++

		if (this.popStage > 6) {
			this.popStage = 6
		}
	}

	/**
	 * Movement for popped toast, which travels at double speed.
	 */
	public updatePops(): void {
		this.syncSpriteScale()
		this.position.x += this.velocity.x * 2
		this.position.y += this.velocity.y * 2

		this.loopOffscreen()
		this.syncSpritePosition()
	}

	protected override step(): void {
		this.syncSpriteScale()
		this.position.x += this.velocity.x
		this.position.y += this.velocity.y

		this.loopOffscreen()
	}

	private loopOffscreen(): void {
		if (this.position.x + this.sprite.width < 0 || this.position.y > this.app.screen.height) {
			this.respawn()
		}
	}

	private respawn(): void {
		const screenWidth = this.app.screen.width
		const screenHeight = this.app.screen.height
		this.position.x = screenWidth + Math.random() * screenWidth * 0.5
		this.position.y = -screenHeight + Math.random() * screenHeight * 1.25
	}
}
