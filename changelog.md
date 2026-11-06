# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add a camera-framing silhouette that adapts to the preview, hides after stable player detection, and returns after sustained tracking loss.

### Maintenance

- Refresh shared-config, pnpm, Vite, Vitest, and Cloudflare development tooling, and remove stale Knip and pnpm exceptions.
- Replace the `skills` prepare hook with pnpm-native skill installation and use `shx` for portable repository cleanup.
- Update GitHub Actions used for Node setup, release creation, changelog generation, and dependency-update pull requests.
- Schedule automated dependency updates for the first of each month instead of weekly, and standardize their pull-request title.

## [1.0.1] - 2026-10-12

### Fixed

- Correct Cloudflare routing by registering `/flapping-toasters` and its `/*` subpaths separately.

### Maintenance

- Fix CI dependency installation by allowing required `esbuild` and `workerd` build scripts, and stop tracking the generated skills lockfile.

## [1.0.0] - 2026-10-11

### Added

- Introduce browser play for up to six webcam participants: flap arms for lift, clap to pop toast, and tilt arms for barrel rolls.
- Track poses locally with a bundled MoveNet model and CPU fallback, scaling gestures to shoulder width and using visible elbows when wrists leave the frame.
- Provide a mirrored camera preview with skeleton overlays, loading and permission status, camera help links, and retry controls.
- Add live controls for graphics scale, physics, gestures, tracking, toast density, and sound, plus keyboard shortcuts for fullscreen, controls, and camera visibility.
- Play flap and toast-pop sound effects and Ride of the Valkyries music, with independent sound toggles and music that stops after players leave.
- Recreate the original toaster and drifting-toast animations with crisp display scaling, window-resize handling, and consistent motion across frame rates.

### Documentation

- Document browser access, webcam positioning, and gesture controls in the readme and startup instructions.
- Preserve the legacy Kinect usage and build guide, updating its archive notice, attribution, and project links.

### Maintenance

- Move the original 2011 openFrameworks/Kinect sources, assets, and Xcode project into `archive/`.
- Establish TypeScript/Vite builds, pnpm tooling, Vitest coverage, shared linting, cross-platform CI, and Cloudflare deployment and GitHub release automation.

[Unreleased]: https://github.com/kitschpatrol/flapping-toasters/compare/v1.0.1...HEAD
[1.0.0]: https://github.com/kitschpatrol/flapping-toasters/releases/tag/v1.0.0
[1.0.1]: https://github.com/kitschpatrol/flapping-toasters/compare/v1.0.0...v1.0.1
