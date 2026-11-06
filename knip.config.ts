import { knipConfig } from '@kitschpatrol/knip-config'

export default knipConfig({
	// Referenced via resolve.alias in vite.config.ts, which Knip can't see
	ignore: ['src/compatibility/mediapipe-stub.ts'],
	ignoreDependencies: [
		'@kitschpatrol/chagent', // Typically invoked through bumpp's --execute argument, which Knip doesn't parse
	],
})
