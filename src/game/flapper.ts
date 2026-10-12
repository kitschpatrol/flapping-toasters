import type { Application, Container, Texture } from 'pixi.js'
import { Sprite } from 'pixi.js'
import type { UpperBodyObservation } from '../tracking/arm-gestures'
import type { GameAssets, ImageKey } from './assets'
import type { SoundBoard } from './sound-board'
import { settings } from '../settings'
import { ArmGestures, hasTrackedArms } from '../tracking/arm-gestures'
import { Mover } from './mover'
import { Toast } from './toast'

// Sprite indices match the C++ original: textures[i] holds roll{i + 1}.png
const restingSpriteIndex = 6
const wingsUpSpriteIndex = 17
const wingsLevelSpriteIndex = 18
const wingsDownSpriteIndex = 19

const rollTextureKeys: ImageKey[] = [
	'roll1',
	'roll2',
	'roll3',
	'roll4',
	'roll5',
	'roll6',
	'roll7',
	'roll8',
	'roll9',
	'roll10',
	'roll11',
	'roll12',
	'roll13',
	'roll14',
	'roll15',
	'roll16',
	'roll17',
	'roll18',
	'roll19',
	'roll20',
]

// Recycle the oldest toast pop beyond this count so long sessions stay bounded
const maxToastPops = 30

/**
 * A player-controlled flying toaster, ported from the original openFrameworks
 * implementation. Flapping arms keeps it aloft, clapping pops toast, and
 * tilting both arms rolls it. When its player leaves, it glides or rolls off
 * the screen and waits at the spawn point for the next player.
 */
export class Flapper extends Mover {
	public isActive = false
	public timeLastHandUpdate = 0

	private activeSpriteIndex = wingsLevelSpriteIndex
	private readonly container: Container
	private readonly gestures = new ArmGestures()
	private isParked = true
	private lastFlapTime = -Infinity
	private readonly onFlap: () => void
	private rollTimer = 0

	private readonly sounds: SoundBoard
	private readonly textures: Texture[]
	private timeLastToastPop = 0

	private readonly toastPops: Toast[] = []
	private wingAngle = 0
	private wingPosition: 'down' | 'level' | 'up' = 'level'

	private get millis(): number {
		return performance.now()
	}

	constructor(
		app: Application,
		assets: GameAssets,
		container: Container,
		sounds: SoundBoard,
		onFlap: () => void,
	) {
		super(app, assets)

		this.container = container
		this.sounds = sounds
		this.onFlap = onFlap

		this.position.x = app.screen.width
		this.position.y = 0
		this.velocity.x = 0
		this.velocity.y = 0.5

		// Build the roll animation from roll1 through roll20
		this.textures = rollTextureKeys.map((key) => assets[key])

		this.sprite = new Sprite(this.textures[this.activeSpriteIndex])
		container.addChild(this.sprite)

		this.syncSpritePosition()
	}

	/**
	 * Clears gesture history before another player or a reacquired pose takes
	 * over.
	 */
	public resetTracking(): void {
		this.gestures.reset()
		this.wingAngle = 0
		this.wingPosition = 'level'
	}

	/**
	 * Keeps gesture history through brief wrist occlusion and accepts visible
	 * elbows for close-up wing control.
	 */
	public updatePose(pose: UpperBodyObservation, timestamp: number): void {
		this.isActive = true
		this.isParked = false
		if (hasTrackedArms(pose)) {
			this.timeLastHandUpdate = this.millis
		}

		const gesture = this.gestures.update(pose, timestamp, settings)
		this.wingPosition = gesture.wingPosition
		this.wingAngle = gesture.rollAngle
		if (gesture.didFlap) {
			this.flapUp()
			if (this.millis - this.lastFlapTime >= settings.flapSoundInterval) {
				this.sounds.playFlap()
				this.lastFlapTime = this.millis
			}
		}

		if (gesture.didClap) {
			this.clapIn()
		}
	}

	protected override step(): void {
		this.syncSpriteScale()
		this.position.x += this.velocity.x
		this.position.y += this.velocity.y

		// Update popped toast, advancing each pop animation
		for (const pop of this.toastPops) {
			pop.updatePops()
			pop.popToast()
		}

		// Ground collision
		if (this.position.y > this.app.screen.height - this.sprite.height) {
			this.position.y = this.app.screen.height - this.sprite.height
			this.velocity.x = 0
			this.velocity.y = 0
		}

		// Release the toaster once its player has been gone for a while
		if (this.isActive && this.millis - this.timeLastHandUpdate > settings.gracePeriod) {
			this.isActive = false
		}

		if (this.isActive) {
			this.velocity.x = -1
			this.velocity.y += settings.gravity

			if (this.velocity.y > 3) {
				this.velocity.y = 3
			}
		} else {
			// A riderless toaster keeps gliding left until it leaves the screen
			this.velocity.x = this.isParked ? 0 : -1
			this.velocity.y = 0
		}

		if (this.isParked) {
			this.activeSpriteIndex = restingSpriteIndex
		} else {
			// Runs riderless too, as the original did, so a toaster abandoned mid-roll
			// barrel-rolls its way offscreen
			this.updateWingSprite()
		}

		if (this.isActive) {
			// Loop the toaster
			if (this.position.x + this.sprite.width < 0) {
				this.position.x = this.app.screen.width
				this.position.y = 0
			}
		} else if (this.isOffscreen()) {
			this.park()
		}

		const texture = this.textures[this.activeSpriteIndex]

		if (texture !== undefined) {
			this.sprite.texture = texture
		}
	}

	private clapIn(): void {
		if (this.millis - this.timeLastToastPop <= settings.toastInterval) {
			return
		}

		let pop: Toast | undefined

		if (this.toastPops.length >= maxToastPops) {
			// Recycle the oldest pop so long sessions stay bounded
			pop = this.toastPops.shift()

			if (pop !== undefined) {
				this.toastPops.push(pop)
			}
		} else {
			pop = new Toast(this.app, this.assets, this.container)
			this.toastPops.push(pop)
		}

		if (pop !== undefined) {
			pop.position.x = this.position.x - 75 * this.graphicsScale
			pop.position.y = this.position.y - 100 * this.graphicsScale
			pop.popStage = 0
		}

		this.timeLastToastPop = this.millis
		this.sounds.playToasterPop()
	}

	private flapUp(): void {
		this.velocity.y = 0.5
		this.velocity.y -= settings.flapPower
		this.onFlap()
	}

	private isOffscreen(): boolean {
		return (
			this.position.x + this.sprite.width < 0 ||
			this.position.x > this.app.screen.width ||
			this.position.y + this.sprite.height < 0 ||
			this.position.y > this.app.screen.height
		)
	}

	/**
	 * Rests the toaster at the offscreen spawn point, where the original kept its
	 * unused flappers, until a new player takes it over.
	 */
	private park(): void {
		this.isParked = true
		this.position.x = this.app.screen.width
		this.position.y = 0
		this.velocity.x = 0
		this.velocity.y = 0
		this.activeSpriteIndex = restingSpriteIndex
	}

	/**
	 * Follows shoulder-relative arm height, or advances the barrel roll while
	 * banking.
	 */
	private updateWingSprite(): void {
		const rollAngle = settings.rollAngleThreshold
		const isWingLevel = this.wingAngle > -rollAngle && this.wingAngle < rollAngle

		if (isWingLevel && this.wingPosition === 'up') {
			this.activeSpriteIndex = wingsUpSpriteIndex
			this.rollTimer = 1
		} else if (isWingLevel && this.wingPosition === 'level') {
			this.activeSpriteIndex = wingsLevelSpriteIndex
			this.rollTimer = 0
		} else if (isWingLevel && this.wingPosition === 'down') {
			this.activeSpriteIndex = wingsDownSpriteIndex
			this.rollTimer = 0
		} else if (this.wingAngle <= -rollAngle) {
			this.activeSpriteIndex = Math.floor(this.rollTimer / 3)
			this.position.x += 2
			this.position.y += 2
			this.rollTimer++

			if (this.rollTimer >= 45) {
				this.rollTimer = 0
			}
		} else if (this.wingAngle >= rollAngle) {
			this.activeSpriteIndex = Math.floor(this.rollTimer / 3)
			this.position.x -= 2
			this.position.y -= 2
			this.rollTimer--

			if (this.rollTimer <= 0) {
				this.rollTimer = 45
			}
		}
	}
}
