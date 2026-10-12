/**
 * Runtime-tunable settings, live-adjustable from the control panel or the
 * `flappingToastersDebug` console handle. Gestures use shoulder-relative travel
 * instead of a calibrated flap arc.
 */
export const settings = {
	clapVelocityThreshold: 10,
	enableMusic: true,
	enableSoundEffects: true,
	flapPower: 7.5,
	flapSoundInterval: 180,
	flapTravelThreshold: 0.35,
	gracePeriod: 5 * 1000,
	graphicsScale: 2,
	gravity: 0.14,
	minKeypointScore: 0.3,
	// Minimum shoulder span as a fraction of camera width to dismiss the instructions.
	minPlayerShoulderWidth: 0.18,
	// Ignore bodies whose shoulder span is smaller than this fraction of camera width.
	minTrackingShoulderWidth: 0.03,
	musicLingerTime: 2000,
	rollAngleThreshold: 15,
	shouldShowCameraPreview: true,
	toastCount: 11,
	toastInterval: 1000,
}
