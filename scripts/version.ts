/* eslint-disable ts/no-restricted-types, unicorn/no-null -- Preserve the existing version.json schema. */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import packageJson from '../package.json' with { type: 'json' }

// eslint-disable-next-line ts/strict-void-return -- promisify ignores execFile's ChildProcess return.
const execFileAsync = promisify(execFile)
const root = new URL('../', import.meta.url)

async function git(args: string[]): Promise<null | string> {
	try {
		const { stdout } = await execFileAsync('git', args, { cwd: root })
		const value = stdout.trim()
		return value === '' ? null : value
	} catch {
		// Source archives and shallow checkouts may lack some or all Git metadata.
		return null
	}
}

const [tag, commit, branch, commitDate] = await Promise.all([
	git(['describe', '--tags', '--abbrev=0']),
	git(['rev-parse', '--short', 'HEAD']),
	git(['rev-parse', '--abbrev-ref', 'HEAD']),
	git(['log', '-1', '--format=%cI']),
])
const { name, version } = packageJson

const versionJson = {
	date: new Date().toISOString(),
	// Build metadata after '+' does not make a version a prerelease.
	deployment: version.split('+', 1)[0]!.includes('-') ? 'preview' : 'main',
	git: {
		branch,
		commit,
		commitDate: commitDate === null ? null : new Date(commitDate).toISOString(),
		tag,
	},
	package: { name, version },
}

console.log(JSON.stringify(versionJson, undefined, 2))
