/** Returns the browser vendor's camera permission instructions. */
export function getCameraPermissionHelpUrl(): string {
	const { userAgent } = navigator
	if (userAgent.includes('Firefox') || userAgent.includes('FxiOS')) {
		return 'https://support.mozilla.org/en-US/kb/how-manage-your-camera-and-microphone-permissions'
	}

	if (userAgent.includes('Edg')) {
		return 'https://support.microsoft.com/en-us/windows/privacy/windows-camera-microphone-and-privacy'
	}

	if (
		userAgent.includes('Safari') &&
		['Chrome', 'Chromium', 'CriOS', 'Android'].every((name) => !userAgent.includes(name))
	) {
		return ['iPhone', 'iPad', 'iPod'].some((name) => userAgent.includes(name))
			? 'https://support.apple.com/guide/iphone/iphb01fc3c85/ios'
			: 'https://support.apple.com/guide/mac-help/mchlf6d108da/mac'
	}

	return 'https://support.google.com/chrome/answer/2693767'
}
