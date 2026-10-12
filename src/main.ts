import type { ButtonApi } from '@tweakpane/core'
import { Application, Container } from 'pixi.js'
import { Pane } from 'tweakpane'
import { loadAssets } from './game/assets'
import { Flapper } from './game/flapper'
import { SoundBoard } from './game/sound-board'
import { Toast } from './game/toast'
import { settings } from './settings'
import { hasTrackedArms } from './tracking/arm-gestures'
import { PlayerPresence } from './tracking/player-presence'
import { PoseTracker } from './tracking/pose-tracker'
import { getCameraPermissionHelpUrl } from './ui/camera-permission-help'
import { getPreviewViewport } from './ui/preview-viewport'
import { drawSkeletons } from './ui/skeleton-preview'
import './ui/styles.css'

// One flapper per trackable person (MoveNet MultiPose tracks up to six people; the Kinect
// original allowed fifteen)
const flapperCount = 6

function requireElement<T extends Element>(constructor: new () => T, selector: string): T {
	const element = document.querySelector(selector)

	if (!(element instanceof constructor)) {
		throw new TypeError(`Missing required element "${selector}"`)
	}

	return element
}

async function initializeScene(onFlap: () => void): Promise<{
	poseTracker: PoseTracker
	retryButton: ButtonApi
	sounds: SoundBoard
}> {
	const appContainer = requireElement(HTMLDivElement, '#app')
	const previewCanvas = requireElement(HTMLCanvasElement, '#camera-preview')
	const previewFrame = requireElement(HTMLDivElement, '#camera-preview-frame')
	const cameraPlaceholder = requireElement(HTMLDivElement, '#camera-placeholder')
	const cameraIcon = requireElement(SVGSVGElement, '#camera-icon')
	const cameraSlash = requireElement(SVGPathElement, '#camera-icon-slash')
	const cameraHelp = requireElement(HTMLDivElement, '#camera-help')
	const cameraHelpMessage = requireElement(HTMLParagraphElement, '#camera-help-message')
	const cameraPermissionLink = requireElement(HTMLAnchorElement, '#camera-permission-link')
	cameraPermissionLink.href = getCameraPermissionHelpUrl()

	const sounds = new SoundBoard()
	const unlockAudio = (): void => {
		void sounds.unlock()
	}

	document.addEventListener('pointerdown', unlockAudio)
	document.addEventListener('keydown', unlockAudio)

	const app = new Application()
	await app.init({
		antialias: false,
		autoDensity: true,
		background: '#000000',
		// eslint-disable-next-line unicorn/prefer-global-this -- Pixi's resizeTo requires a Window
		resizeTo: window,
		// Match display pixels so the browser does not resample a low-resolution canvas.
		resolution: devicePixelRatio,
	})
	app.ticker.maxFPS = 60

	const poseTracker = new PoseTracker()
	const assets = await loadAssets()

	appContainer.append(app.canvas)

	// Toast stays under the flappers no matter when it spawns, like the original's draw order
	const toastContainer = new Container()
	const flapperContainer = new Container()
	app.stage.addChild(toastContainer, flapperContainer)

	const toasts: Toast[] = []

	function syncToastCount(): void {
		while (toasts.length < settings.toastCount) {
			toasts.push(new Toast(app, assets, toastContainer))
		}

		while (toasts.length > settings.toastCount) {
			toasts.pop()?.destroy()
		}
	}

	syncToastCount()
	// Seed the first slices on screen instead of waiting for them to drift in from the edge.
	for (const toast of toasts) {
		toast.position.x = Math.random() * app.screen.width
		toast.position.y = Math.random() * app.screen.height
		toast.update(0)
	}

	const flappers: Flapper[] = []
	let musicStartedByFlap = false
	const handleFlap = (): void => {
		musicStartedByFlap = true
		onFlap()
	}

	for (let i = 0; i < flapperCount; i++) {
		flappers.push(new Flapper(app, assets, flapperContainer, sounds, handleFlap))
	}

	// Each tracked person keeps their own toaster; when a new person appears they take over the
	// toaster that has gone longest without hand updates
	const flapperByPoseId = new Map<number, Flapper>()

	function flapperForPose(poseId: number): Flapper | undefined {
		const assigned = flapperByPoseId.get(poseId)

		if (assigned !== undefined) {
			return assigned
		}

		let stalest: Flapper | undefined

		for (const flapper of flappers) {
			if (stalest === undefined || flapper.timeLastHandUpdate < stalest.timeLastHandUpdate) {
				stalest = flapper
			}
		}

		if (stalest !== undefined) {
			for (const [id, flapper] of flapperByPoseId) {
				if (flapper === stalest) {
					flapperByPoseId.delete(id)
				}
			}

			stalest.resetTracking()
			flapperByPoseId.set(poseId, stalest)
		}

		return stalest
	}

	const controlPanel = requireElement(HTMLDivElement, '#control-panel')
	const pane = new Pane({ container: controlPanel, title: 'Flapping Toasters' })
	const retryButton = pane.addButton({ hidden: true, title: 'Retry camera tracking' })
	// Place the preview directly below the title, ahead of the Advanced controls.
	pane.element.firstElementChild?.after(previewFrame)

	const previewContext = previewCanvas.getContext('2d') ?? undefined

	function syncPreviewVisibility(): void {
		previewFrame.hidden = !settings.shouldShowCameraPreview || !pane.expanded || pane.hidden
		const { cameraState } = poseTracker
		const isCameraReady =
			cameraState === 'ready' && poseTracker.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
		previewCanvas.hidden = previewFrame.hidden || !isCameraReady
		cameraPlaceholder.hidden = isCameraReady
		if (previewFrame.dataset.cameraState === cameraState) {
			return
		}

		previewFrame.dataset.cameraState = cameraState
		const hasCameraError = cameraState === 'denied' || cameraState === 'failed'
		cameraSlash.toggleAttribute('hidden', !hasCameraError)
		cameraIcon.setAttribute(
			'aria-label',
			hasCameraError ? 'Camera unavailable' : 'Waiting for camera',
		)
		cameraHelp.hidden = !hasCameraError
		cameraHelpMessage.textContent =
			cameraState === 'denied'
				? 'Flapping Toasters needs permission to use your webcam.'
				: 'Unable to start the webcam. Check that it is connected and not in use.'
		cameraPermissionLink.hidden = cameraState !== 'denied'
	}

	syncPreviewVisibility()

	function drawPreview(): void {
		if (previewContext === undefined || previewCanvas.hidden !== false) {
			return
		}

		const context = previewContext
		const { width, height } = previewCanvas
		const { video } = poseTracker

		context.clearRect(0, 0, width, height)

		const viewport = getPreviewViewport(width, height, video.videoWidth, video.videoHeight)
		if (viewport === undefined) {
			return
		}

		// Mirror to match the game's coordinate space
		context.save()
		context.translate(width, 0)
		context.scale(-1, 1)
		context.drawImage(video, viewport.x, viewport.y, viewport.width, viewport.height)
		context.restore()

		drawSkeletons(
			context,
			poseTracker.getPoses(),
			video.videoWidth,
			video.videoHeight,
			settings.minKeypointScore,
		)
	}

	let lastPoseTimestamp = 0
	let timeLastHandsSeen = 0
	let lastScreenWidth = app.screen.width
	let lastScreenHeight = app.screen.height

	app.ticker.add((ticker) => {
		// Browser zoom and moving between monitors can change the display pixel grid.
		if (app.renderer.resolution !== devicePixelRatio) {
			app.renderer.resize(app.screen.width, app.screen.height, devicePixelRatio)
		}

		// Apply any settings changes from the control panel or console
		syncToastCount()
		syncPreviewVisibility()
		sounds.syncSettings()

		// Rescale positions when the renderer picks up a window resize
		if (app.screen.width !== lastScreenWidth || app.screen.height !== lastScreenHeight) {
			for (const mover of [...toasts, ...flappers]) {
				mover.handleResize(lastScreenWidth, lastScreenHeight)
			}

			lastScreenWidth = app.screen.width
			lastScreenHeight = app.screen.height
		}

		// Consume each camera observation once, without adding render-loop latency or duplicates.
		if (poseTracker.poseTimestamp !== lastPoseTimestamp) {
			lastPoseTimestamp = poseTracker.poseTimestamp
			const players = poseTracker.getTrackedPlayers()

			const updatedFlappers = new Set<Flapper>()
			for (const pair of players) {
				// Partial observations can retain a player, but cannot take over another toaster.
				const flapper = hasTrackedArms(pair)
					? flapperForPose(pair.id)
					: flapperByPoseId.get(pair.id)
				flapper?.updatePose(pair, lastPoseTimestamp)
				if (flapper !== undefined) {
					updatedFlappers.add(flapper)
				}
			}

			for (const flapper of flappers) {
				if (!updatedFlappers.has(flapper)) {
					flapper.resetTracking()
				}
			}

			if (players.length > 0) {
				timeLastHandsSeen = performance.now()
				if (musicStartedByFlap) {
					void sounds.startMusic()
				}
			}
		}

		if (performance.now() - timeLastHandsSeen > settings.musicLingerTime) {
			musicStartedByFlap = false
			sounds.stopMusic()
		}

		for (const toast of toasts) {
			toast.update(ticker.deltaTime)
		}

		for (const flapper of flappers) {
			flapper.update(ticker.deltaTime)
		}

		drawPreview()
	})

	// Keep the installation's tuning controls tucked away during normal play.
	const advancedFolder = pane.addFolder({ expanded: false, title: 'Advanced' })
	advancedFolder.addBinding(settings, 'graphicsScale', {
		label: 'Graphics Scale',
		options: { '1×': 1, '2×': 2, '3×': 3 },
	})
	const fullscreenState = { fullscreen: document.fullscreenElement !== null }
	const fullscreenBinding = advancedFolder.addBinding(fullscreenState, 'fullscreen', {
		disabled: !document.fullscreenEnabled,
		label: 'Fullscreen',
	})

	function syncFullscreen(): void {
		fullscreenState.fullscreen = document.fullscreenElement !== null
		fullscreenBinding.refresh()
	}

	async function setFullscreen(enabled: boolean): Promise<void> {
		if (enabled === (document.fullscreenElement !== null) || !document.fullscreenEnabled) {
			return
		}

		try {
			if (enabled) {
				await document.documentElement.requestFullscreen()
			} else {
				await document.exitFullscreen()
			}
		} catch (error) {
			console.warn('Unable to change fullscreen:', error)
		} finally {
			syncFullscreen()
		}
	}

	fullscreenBinding.on('change', (event) => {
		void setFullscreen(event.value)
	})
	document.addEventListener('fullscreenchange', syncFullscreen)

	const soundFolder = advancedFolder.addFolder({ title: 'Sound' })
	soundFolder.addBinding(settings, 'enableMusic', { label: 'Enable Music' })
	soundFolder.addBinding(settings, 'enableSoundEffects', { label: 'Enable Sound Effects' })
	soundFolder.addBinding(settings, 'flapSoundInterval', {
		label: 'Flap Gap (ms)',
		max: 5000,
		min: 0,
		step: 50,
	})
	soundFolder.addBinding(settings, 'musicLingerTime', {
		label: 'Music Linger (ms)',
		max: 10_000,
		min: 0,
		step: 100,
	})

	const physicsFolder = advancedFolder.addFolder({ title: 'Physics' })
	physicsFolder.addBinding(settings, 'flapPower', { label: 'Flap Power', max: 10, min: 0 })
	physicsFolder.addBinding(settings, 'gravity', { label: 'Gravity', max: 5, min: 0 })

	const gesturesFolder = advancedFolder.addFolder({ title: 'Gestures' })
	gesturesFolder.addBinding(settings, 'flapTravelThreshold', {
		label: 'Flap Travel',
		max: 1,
		min: 0.15,
		step: 0.05,
	})
	gesturesFolder.addBinding(settings, 'clapVelocityThreshold', {
		label: 'Clap Speed',
		max: 30,
		min: 0,
	})
	gesturesFolder.addBinding(settings, 'rollAngleThreshold', {
		label: 'Roll Angle',
		max: 45,
		min: 0,
		step: 1,
	})
	gesturesFolder.addBinding(settings, 'gracePeriod', {
		label: 'Grace Period (ms)',
		max: 15_000,
		min: 0,
		step: 100,
	})

	const toastFolder = advancedFolder.addFolder({ title: 'Toast' })
	toastFolder.addBinding(settings, 'toastCount', { label: 'Count', max: 30, min: 0, step: 1 })
	toastFolder.addBinding(settings, 'toastInterval', {
		label: 'Pop Interval (ms)',
		max: 5000,
		min: 0,
		step: 100,
	})

	const trackingFolder = advancedFolder.addFolder({ title: 'Tracking' })
	trackingFolder.addBinding(settings, 'minKeypointScore', {
		label: 'Min Confidence',
		max: 1,
		min: 0,
		step: 0.05,
	})
	trackingFolder.addBinding(settings, 'minPlayerShoulderWidth', {
		label: 'Entry Shoulder Width',
		max: 0.5,
		min: 0.05,
		step: 0.01,
	})
	trackingFolder.addBinding(settings, 'minTrackingShoulderWidth', {
		format: (value) => `${(value * 100).toFixed(1)}%`,
		label: 'Min Tracking Width',
		max: 0.2,
		min: 0,
		step: 0.005,
	})
	trackingFolder.addBinding(settings, 'shouldShowCameraPreview', { label: 'Show Camera' })

	// State handle for debugging and automated verification
	Reflect.set(globalThis, 'flappingToastersDebug', { flappers, poseTracker, settings, toasts })

	document.addEventListener('keydown', (event) => {
		switch (event.key) {
			case 'f': {
				void setFullscreen(document.fullscreenElement === null)

				break
			}

			case 'g': {
				pane.hidden = !pane.hidden

				break
			}

			case 'k': {
				settings.shouldShowCameraPreview = !settings.shouldShowCameraPreview
				pane.refresh()

				break
			}
			// No default
		}
	})
	return { poseTracker, retryButton, sounds }
}

async function setup(): Promise<void> {
	const dialog = requireElement(HTMLDialogElement, '#startup-dialog')
	const dialogTitle = requireElement(HTMLHeadingElement, '#dialog-title')
	const spinner = requireElement(HTMLDivElement, '#tracking-spinner')
	const trackingStatus = requireElement(HTMLDivElement, '#tracking-status')
	const trackingStatusText = requireElement(HTMLSpanElement, '#tracking-status-text')
	const startupRetry = requireElement(HTMLButtonElement, '#startup-retry')
	const minimumInstructionTime = 3000
	const minimumReadyTime = 1000
	let shownAt = performance.now()
	function showInstructions(): void {
		dialog.show()
		// Explicitly focus the heading on every opening; the links remain in the Tab order.
		dialogTitle.focus({ preventScroll: true })
	}

	showInstructions()
	dialog.addEventListener('cancel', (event) => {
		event.preventDefault()
	})

	try {
		let hasFlapped = false
		const { poseTracker, retryButton, sounds } = await initializeScene(() => {
			hasFlapped = true
		})
		const presence = new PlayerPresence()
		let isTrackingReady = false
		let readyAt = 0
		let dismissal: Animation | undefined
		let startupGeneration = 0
		let isPageHidden = false
		addEventListener('pagehide', () => {
			isPageHidden = true
			startupGeneration++
			isTrackingReady = false
			dismissal?.cancel()
			dismissal = undefined
			poseTracker.stop()
			sounds.stopMusic()
		})
		addEventListener('pageshow', (event) => {
			if (!event.persisted) {
				return
			}

			isPageHidden = false
			void begin()
		})

		function dismissInstructions(): void {
			if (dismissal !== undefined) {
				return
			}

			if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
				dialog.close()
				return
			}

			const animation = dialog.animate([{ opacity: 1 }, { opacity: 0 }], {
				duration: 400,
				easing: 'ease-out',
				fill: 'forwards',
			})
			dismissal = animation
			animation.onfinish = () => {
				if (dismissal !== animation) {
					return
				}

				dialog.close()
				animation.cancel()
				dismissal = undefined
			}
		}

		function showError(error: unknown): void {
			console.warn('Unable to start tracking:', error)
			dismissal?.cancel()
			dismissal = undefined
			spinner.hidden = true
			const isPermissionError =
				poseTracker.cameraState === 'denied' ||
				(error instanceof Error &&
					error.cause instanceof DOMException &&
					error.cause.name === 'NotAllowedError')
			trackingStatus.style.visibility = 'visible'
			if (isPermissionError) {
				trackingStatusText.textContent = 'Allow camera access, then retry camera tracking.'
			} else if (poseTracker.cameraState === 'failed') {
				trackingStatusText.textContent =
					'Unable to start the webcam. Check that it is connected and not in use, then retry.'
			} else {
				trackingStatusText.textContent =
					'Unable to start camera tracking. Check your connection and try again.'
			}

			startupRetry.hidden = false
			isTrackingReady = false
			hasFlapped = false
			presence.reset()
			retryButton.hidden = false
			retryButton.disabled = false
			if (dialog.open) {
				return
			}

			shownAt = performance.now()
			showInstructions()
		}

		async function begin(): Promise<void> {
			if (isPageHidden) {
				return
			}

			const generation = ++startupGeneration
			startupRetry.hidden = true
			if (!dialog.open) {
				shownAt = performance.now()
				showInstructions()
			}

			spinner.hidden = false
			trackingStatus.style.visibility = 'visible'
			trackingStatusText.textContent = 'Loading'
			isTrackingReady = false
			hasFlapped = false
			presence.reset()
			retryButton.disabled = true
			retryButton.hidden = true
			try {
				// Sound loading must not delay camera tracking or instruction dismissal.
				void sounds.load().catch((error: unknown) => {
					console.warn('Unable to load sounds:', error)
				})
				await poseTracker.start(
					(error) => {
						if (generation === startupGeneration) {
							showError(error)
						}
					},
					(poses) => {
						if (generation !== startupGeneration || !isTrackingReady || !dialog.open) {
							return
						}

						const now = performance.now()
						const isPlayerReady = presence.update(
							poses,
							poseTracker.video.videoWidth,
							poseTracker.video.videoHeight,
							now,
						)
						if (
							(isPlayerReady || hasFlapped) &&
							now - shownAt >= minimumInstructionTime &&
							now - readyAt >= minimumReadyTime
						) {
							dismissInstructions()
						}
					},
					(status) => {
						if (generation !== startupGeneration) {
							return
						}

						const isWaitingForCamera = status === 'waiting-camera'
						spinner.hidden = isWaitingForCamera
						trackingStatusText.textContent = isWaitingForCamera
							? 'Waiting for camera permission...'
							: 'Loading'
					},
				)
				if (generation !== startupGeneration) {
					return
				}

				isTrackingReady = true
				readyAt = performance.now()
				spinner.hidden = true
				trackingStatusText.textContent = 'Ready! Flap to start...'
			} catch (error) {
				if (generation !== startupGeneration) {
					return
				}

				poseTracker.stop()
				showError(error)
			}
		}

		const retryStartup = (): void => {
			void begin()
		}

		startupRetry.addEventListener('click', retryStartup)
		retryButton.on('click', retryStartup)
		// Paint the toast scene before automatically requesting the camera and loading vision.
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				void begin()
			})
		})
	} catch (error) {
		spinner.hidden = true
		trackingStatus.style.visibility = 'visible'
		trackingStatusText.textContent = 'Unable to load the game. Check your connection and reload.'
		startupRetry.textContent = 'Reload game'
		startupRetry.hidden = false
		startupRetry.addEventListener('click', () => {
			location.reload()
		})
		console.error('Unable to initialize the scene:', error)
	}
}

void setup()
