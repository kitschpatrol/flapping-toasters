import { settings } from '../settings'

const flapSoundPaths = ['flap1.wav', 'flap2.wav'] as const
const toasterSoundPath = 'toaster.wav'
const musicPath = 'valkyries.m4a'

/**
 * Plays the flap and toaster-pop sound effects and the Ride of the Valkyries
 * music, ported from the ofSoundPlayer usage in the original openFrameworks
 * implementation.
 *
 * Loads automatically; a pointer or keyboard interaction unlocks audio if
 * required by the browser.
 */
export class SoundBoard {
	private audioContext: AudioContext | undefined
	private readonly buffers = new Map<string, AudioBuffer>()
	private readonly music = new Audio(`${import.meta.env.BASE_URL}/${musicPath}`)
	private soundEffectsGain: GainNode | undefined

	/**
	 * Fetches and decodes the sound effect files.
	 */
	public async load(): Promise<void> {
		// A suspended context can decode audio while waiting for a user interaction.
		this.audioContext ??= new AudioContext()
		const { audioContext } = this
		if (this.soundEffectsGain === undefined) {
			this.soundEffectsGain = audioContext.createGain()
			this.soundEffectsGain.connect(audioContext.destination)
		}

		this.syncSettings()
		this.music.preload = 'auto'

		await Promise.all(
			[...flapSoundPaths, toasterSoundPath].map(async (path) => {
				const response = await fetch(`${import.meta.env.BASE_URL}/${path}`)

				if (!response.ok) {
					throw new Error(`Failed to fetch sound "${path}": ${response.status}`)
				}

				const buffer = await audioContext.decodeAudioData(await response.arrayBuffer())
				this.buffers.set(path, buffer)
			}),
		)
	}

	/**
	 * Plays one of the two wing-flap sounds at random, overlapping any already
	 * playing.
	 */
	public playFlap(): void {
		this.playBuffer(flapSoundPaths[Math.random() > 0.5 ? 0 : 1], 0.5)
	}

	/**
	 * Plays the toaster lever ka-chunk that accompanies a toast pop.
	 */
	public playToasterPop(): void {
		this.playBuffer(toasterSoundPath, 1)
	}

	/**
	 * Starts the music if it isn't already playing. Like the original, the track
	 * restarts from the beginning if it has ended while players are still
	 * flapping.
	 */
	public async startMusic(): Promise<void> {
		if (!settings.enableMusic || !this.music.paused) {
			return
		}

		try {
			await this.music.play()
		} catch {
			// Play can reject if the browser blocks autoplay before a user gesture; stay silent
		}
	}

	/**
	 * Stops the music and rewinds it so the next player starts from the top.
	 */
	public stopMusic(): void {
		if (!this.music.paused) {
			this.music.pause()
		}

		this.music.currentTime = 0
	}

	/**
	 * Applies independent music and effects toggles, including sounds already
	 * playing.
	 */
	public syncSettings(): void {
		if (!settings.enableMusic) {
			this.stopMusic()
		}

		if (this.soundEffectsGain !== undefined) {
			this.soundEffectsGain.gain.value = settings.enableSoundEffects ? 1 : 0
		}
	}

	/** Enables sound after a pointer or keyboard interaction. */
	public async unlock(): Promise<void> {
		this.audioContext ??= new AudioContext()
		if (this.audioContext.state === 'suspended') {
			try {
				await this.audioContext.resume()
			} catch {
				// Stay silent if the browser still blocks audio; a later interaction can retry.
			}
		}
	}

	private playBuffer(path: string, volume: number): void {
		const buffer = this.buffers.get(path)

		if (
			buffer === undefined ||
			!settings.enableSoundEffects ||
			this.soundEffectsGain === undefined ||
			this.audioContext?.state !== 'running'
		) {
			return
		}

		const source = this.audioContext.createBufferSource()
		source.buffer = buffer
		const gain = this.audioContext.createGain()
		gain.gain.value = volume
		source.connect(gain).connect(this.soundEffectsGain)
		source.start()
	}
}
