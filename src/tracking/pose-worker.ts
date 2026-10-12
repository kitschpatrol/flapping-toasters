import type { PoseDetector } from '@tensorflow-models/pose-detection'
import {
	createDetector,
	movenet,
	SupportedModels,
	TrackerType,
} from '@tensorflow-models/pose-detection'
import * as tf from '@tensorflow/tfjs'
import type { PoseWorkerRequest, PoseWorkerResponse } from './pose-worker-messages'

let detector: PoseDetector | undefined
const canvas = new OffscreenCanvas(1, 1)
const context = canvas.getContext('2d', { willReadFrequently: true })

function respond(message: PoseWorkerResponse): void {
	postMessage(message)
}

async function handleRequest(request: PoseWorkerRequest): Promise<void> {
	try {
		if (request.type === 'initialize') {
			// Keep even the compatibility fallback off the main thread.
			let hasWebGl = false
			try {
				hasWebGl = await tf.setBackend('webgl')
			} catch {
				// Some browsers cannot create a WebGL context inside a worker.
			}

			if (!hasWebGl) {
				await tf.setBackend('cpu')
			}

			await tf.ready()
			detector = await createDetector(SupportedModels.MoveNet, {
				enableTracking: true,
				modelType: movenet.modelType.MULTIPOSE_LIGHTNING,
				modelUrl: request.modelUrl,
				trackerType: TrackerType.BoundingBox,
			})
			respond({ type: 'ready' })
			return
		}

		const { frame } = request
		let input: tf.Tensor3D | undefined
		try {
			if (detector === undefined || context === null) {
				throw new Error('Pose tracking is not ready.')
			}

			canvas.width = frame.width
			canvas.height = frame.height
			context.drawImage(frame, 0, 0)
			input = tf.browser.fromPixels(context.getImageData(0, 0, frame.width, frame.height))
			const poses = await detector.estimatePoses(input, {}, request.timestamp)
			respond({ poses, type: 'poses' })
		} finally {
			input?.dispose()
			frame.close()
		}
	} catch (error) {
		respond({ message: error instanceof Error ? error.message : String(error), type: 'error' })
	}
}

addEventListener('message', (event: MessageEvent<PoseWorkerRequest>) => {
	void handleRequest(event.data)
})
