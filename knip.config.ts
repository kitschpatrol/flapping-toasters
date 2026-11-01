import { knipConfig } from '@kitschpatrol/knip-config'

export default knipConfig({
	// Referenced via resolve.alias in vite.config.ts, which Knip can't see
	ignore: ['src/compatibility/mediapipe-stub.ts'],
})
