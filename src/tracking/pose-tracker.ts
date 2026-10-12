import type { Pose } from '@tensorflow-models/pose-detection'
import type { PoseWorkerRequest, PoseWorkerResponse } from './pose-worker-messages'
import type { TrackedBody } from './tracked-body'
import { settings } from '../settings'
import { getTrackedBodies } from './tracked-body'

// Preferred capture resolution only; gesture calculations use actual camera coordinates.
const preferredVideoWidth = 640
const preferredVideoHeight = 480

/**
 * Webcam pose tracking via a self-hosted MoveNet MultiPose Lightning model.
 * Runs its own estimation loop and exposes the most recent hand positions for
 * up to six people.
 */
export class PoseTracker {
	public cameraState: 'denied' | 'failed' | 'pending' | 'ready' = 'pending'
	public poseTimestamp = 0
	public readonly video: HTMLVideoElement

	private animationFrame = 0
	private isRunning = false
	private lastVideoTimestamp = -1
	private latestPoses: Pose[] = []
	private pending:
		undefined | { reject: (error: Error) => void; resolve: (response: PoseWorkerResponse) => void }
	private stream: MediaStream | undefined
	private worker: undefined | Worker

	constructor() {
		this.video = document.createElement('video')
		this.video.playsInline = true
		this.video.muted = true
	}

	/**
	 * The most recent raw poses, in video pixel coordinates, for the camera
	 * preview overlay.
	 */
	public getPoses(): Pose[] {
		return this.latestPoses
	}

	/**
	 * Players with confidently visible shoulders. Missing wrists remain explicit
	 * so a brief chest occlusion does not discard the player's gesture history.
	 */
	public getTrackedPlayers(): TrackedBody[] {
		return getTrackedBodies(
			this.latestPoses,
			this.video.videoWidth,
			this.video.videoHeight,
			settings.minKeypointScore,
			settings.minTrackingShoulderWidth,
		)
	}

	/**
	 * Requests the webcam and loads the model in a worker concurrently. Readiness
	 * includes the first inference, so shader compilation stays behind the
	 * dialog.
	 */
	public async start(
		onError: (error: Error) => void,
		onPoses: (poses: Pose[]) => void,
		onStatus: (status: 'loading' | 'waiting-camera') => void,
	): Promise<void> {
		this.stop()
		this.cameraState = 'pending'
		const worker = new Worker(new URL('pose-worker.ts', import.meta.url), { type: 'module' })
		this.worker = worker
		const startupFailure = Promise.withResolvers<never>()
		worker.addEventListener('message', (event: MessageEvent<PoseWorkerResponse>) => {
			const { pending } = this
			this.pending = undefined
			if (event.data.type === 'error') {
				pending?.reject(new Error(event.data.message))
			} else {
				pending?.resolve(event.data)
			}
		})
		worker.addEventListener('error', (event) => {
			const error = new Error(
				event.message === '' ? 'The vision worker stopped unexpectedly.' : event.message,
			)
			const wasRunning = this.isRunning
			startupFailure.reject(error)
			this.pending?.reject(error)
			this.stop()
			if (wasRunning) {
				onError(error)
			}
		})

		try {
			const startModel = async (): Promise<void> => {
				await this.request({
					modelUrl: new URL(
						`${import.meta.env.BASE_URL}/movenet-lightning/model.json`,
						document.baseURI,
					).href,
					type: 'initialize',
				})
				if (this.worker === worker && this.cameraState !== 'ready') {
					onStatus('waiting-camera')
				}
			}

			await Promise.race([
				startupFailure.promise,
				Promise.all([this.startCamera(worker), startModel()]),
			])
			if (this.worker !== worker) {
				throw new Error('Pose tracking stopped.')
			}

			onStatus('loading')
			await this.estimate(onPoses)
			if (this.worker !== worker) {
				throw new Error('Pose tracking stopped.')
			}

			this.isRunning = true
			this.estimateLoop(onError, onPoses)
		} catch (error) {
			if (this.worker === worker) {
				this.stop()
			}

			throw error
		}
	}

	/** Releases the camera and worker before retrying or leaving the page. */
	public stop(): void {
		if (this.cameraState === 'ready') {
			this.cameraState = 'pending'
		}

		this.isRunning = false
		cancelAnimationFrame(this.animationFrame)
		this.pending?.reject(new Error('Pose tracking stopped.'))
		this.pending = undefined
		this.worker?.terminate()
		this.worker = undefined
		const tracks = this.stream?.getTracks() ?? []
		for (const track of tracks) {
			track.stop()
		}

		this.stream = undefined
		// eslint-disable-next-line unicorn/no-null -- The DOM requires null to detach a media stream
		this.video.srcObject = null
		this.latestPoses = []
		this.poseTimestamp = 0
		this.lastVideoTimestamp = -1
	}

	private async cameraErrorState(error: unknown): Promise<'denied' | 'failed' | 'pending'> {
		if (!(error instanceof DOMException) || error.name !== 'NotAllowedError') {
			return 'failed'
		}

		try {
			// Dismissing a prompt can reject the request without blocking future permission.
			const permission = await navigator.permissions.query({ name: 'camera' })
			if (permission.state === 'prompt') {
				return 'pending'
			}
		} catch {
			// Camera permission queries are not supported in every browser.
		}

		return 'denied'
	}

	private async estimate(onPoses: (poses: Pose[]) => void): Promise<void> {
		const { worker } = this
		const timestamp = this.video.currentTime * 1000
		if (timestamp === this.lastVideoTimestamp) {
			return
		}

		this.lastVideoTimestamp = timestamp
		const capturedAt = performance.now()
		const frame = await createImageBitmap(this.video)
		if (worker !== this.worker) {
			frame.close()
			return
		}

		const response = await this.request({ frame, timestamp, type: 'estimate' })
		if (response.type !== 'poses' || worker !== this.worker) {
			return
		}

		this.latestPoses = response.poses
		this.poseTimestamp = capturedAt
		onPoses(response.poses)
	}

	private estimateLoop(onError: (error: Error) => void, onPoses: (poses: Pose[]) => void): void {
		// Only one transferable frame is in flight; slow inference never builds a queue.
		this.animationFrame = requestAnimationFrame(() => {
			if (!this.isRunning) {
				return
			}

			void this.estimate(onPoses)
				.then(() => {
					if (this.isRunning) {
						this.estimateLoop(onError, onPoses)
					}
				})
				.catch((error: unknown) => {
					if (!this.isRunning) {
						return
					}

					this.stop()
					onError(error instanceof Error ? error : new Error(String(error)))
				})
		})
	}

	private async request(message: PoseWorkerRequest): Promise<PoseWorkerResponse> {
		return new Promise((resolve, reject) => {
			if (this.worker === undefined) {
				reject(new Error('The vision worker is unavailable.'))
				return
			}

			this.pending = { reject, resolve }
			this.worker.postMessage(message, message.type === 'estimate' ? [message.frame] : [])
		})
	}

	private async startCamera(worker: Worker): Promise<void> {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: {
					facingMode: 'user',
					height: { ideal: preferredVideoHeight },
					width: { ideal: preferredVideoWidth },
				},
			})
			// Permission can arrive after model loading has failed or a retry has begun.
			if (this.worker !== worker) {
				for (const track of stream.getTracks()) {
					track.stop()
				}

				throw new Error('Camera startup was cancelled.')
			}

			this.stream = stream
			this.video.srcObject = stream
			await this.video.play()
			if (this.worker === worker) {
				this.cameraState = 'ready'
			}
		} catch (error) {
			if (this.worker === worker) {
				const state = await this.cameraErrorState(error)
				if (this.worker === worker) {
					this.cameraState = state
				}
			}

			throw new Error(
				this.cameraState === 'failed'
					? 'Unable to start the webcam. Check that it is connected and not in use, then try again.'
					: 'Webcam access is required to play. Allow camera permission and try again.',
				{ cause: error },
			)
		}
	}
}
