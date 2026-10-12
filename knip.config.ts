import { knipConfig } from '@kitschpatrol/knip-config'

export default knipConfig({
	// Referenced via resolve.alias in vite.config.ts, which Knip can't see
	ignore: ['src/compatibility/mediapipe-stub.ts'],
	// Tweakpane's published types import @tweakpane/core, but no source references it directly
	ignoreDependencies: ['@tweakpane/core'],
})
