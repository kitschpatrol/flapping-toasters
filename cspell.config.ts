import { cspellConfig } from '@kitschpatrol/cspell-config'

export default cspellConfig({
	ignorePaths: [
		'archive/flappingToasters.xcodeproj/**',
		'archive/src/utils/ofxControlPanel/**',
		'archive/bin/data/openni/**',
		'archive/openFrameworks-Info.plist',
		'public/movenet-lightning/**',
	],
	words: ['dsav', 'facemesh', 'keypoints', 'openni', 'tfjs'],
})
