import { eslintConfig } from '@kitschpatrol/eslint-config'

export default eslintConfig({
	ts: {
		overrides: {
			// Browser-only Vite app; navigator is the browser API, not the experimental Node builtin
			'node/no-unsupported-features/node-builtins': 'off',
		},
	},
	type: 'app',
})
