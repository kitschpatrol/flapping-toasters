> [!NOTE]
>
> This `/archive` folder preserves a copy of the original `readme.md` and project files from the 2011 C++ [openFrameworks](https://openframeworks.cc/) implementation of the Flapping Toasters project.
>
> See the [parent directory](../) for the web-based reimplementation.

---

# Flapping Toasters

Developed by [Michael Edgcumbe](https://noisederived.com/) and [Eric Mika](https://ericmika.com) in March 2011.

A final project for [ITP's](https://itp.nyu.edu/itp/) [3D Sensing and Visualization class](https://3dsav.blogspot.com/).

## Interaction

You embody a flying toaster. Strike the Ψ pose to get calibrated, and then start flapping. Tilt in either direction to do a barrel roll. Clap to release toast. Supports multiple players.

## Interface

- <kbd>tab</kbd> toggles the GUI
- <kbd>K</kbd> toggles the Kinect window
- <kbd>F</kbd> toggle full screen mode

## Links

- [Process Blog Post](https://frontiernerds.com/flapping-toasters-process)
- [Video](https://vimeo.com/22032605)
- [The Scarlet S](https://frontiernerds.com/scarlet-s)

## Notes

- Uses a Kinect + OpenNI skeleton tracking to detect arm flapping.
- Built with openFrameworks 0062
- Compiled against [gameoverhack's fork of ofxOpenNI](https://github.com/gameoverhack/ofxOpenNI/commit/a1ec3ffea09bdbd644e57cc9f5c2a1c20a65f02c)
- Vendors [ofxControlPanel](https://github.com/ofTheo/ofxControlPanel), which requires the ofxDirList addon.
- Includes some of the new 3D convenience functions from OF 007, although they aren't put to use. See `src/utils/ofx3dGraphics.h`.
- Xcode project file is for Xcode 4.
- Binaries are Intel-only, for Mac OS X 10.6.
- This project was renamed on GitHub from FlyingKinectToasters to FlappingToasters on April 4th 2011. The old link is broken.
- The project folder expects to be in a certain location relative to openFrameworks. Something like `~/Documents/openFrameworks0062/apps/examples/flappingToasters`
- Should work on Linux / Windows, but I haven't tested and don't have IDE project files for those platforms. Sorry.

**Problems**

- Sometimes ofxOpenNI freezes the keyboard on my laptop. External keyboards work fine. The rest of the machine continues to work fine.
- Startup is slow. This is getting better with subsequent revisions of ofxOpenNI, but don't lose hope if it takes forever to start. You'll also see disconcerting warnings like `Retrieving depth generator failed: No match found`. Persevere, they're not show-stoppers.
- Initial wing flapping animation is glitchy until the flap-detection system has enough data to automatically calibrate itself.

## Thanks

Thanks to [Kyle McDonald](https://kylemcdonald.net/) and [Zach Lieberman](http://zach.li/) for creating the 3DSAV class. More student projects here: [https://3dsav.blogspot.com/](https://3dsav.blogspot.com/)

Thanks to Wagner for the music.

Big thanks to After Dark for their brilliant and twisted screen savers (and for kindly refraining from suing us).
