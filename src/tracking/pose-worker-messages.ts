import type { Pose } from '@tensorflow-models/pose-detection'

export type PoseWorkerRequest =
	| { frame: ImageBitmap; timestamp: number; type: 'estimate' }
	| { modelUrl: string; type: 'initialize' }

export type PoseWorkerResponse =
	{ message: string; type: 'error' } | { poses: Pose[]; type: 'poses' } | { type: 'ready' }
