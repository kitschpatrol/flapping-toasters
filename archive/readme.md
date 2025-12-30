**Flapping Toasters**  
Developed by [Michael Edgcumbe](http://www.neocyde.net/) and [Eric Mika](http://ericmika.com) in March 2011.
A final project for [ITP](http://itp.nyu.edu/itp/)'s [3D Sensing and Visualization class](http://3dsav.blogspot.com/).

**Interaction**  
You embody a flying toaster. Strike the psi pose to get calibrated, and then start flapping. Tilt in either direction to do a barrel roll. Clap to release toast. Supports multiple players.

**Interface**  
Tab toggles the GUI  
K toggles the Kinect window  
F toggle full screen mode

**Links**  
[Process Blog Post](http://frontiernerds.com/flapping-toasters)  
[Video](http://vimeo.com/kitschpatrol/flapping-toasters)  
[The Scarlet S](http://frontiernerds.com/scarlet-s)  

**Notes**  

- Uses a Kinect + OpenNI skeleton tracking to detect arm flapping.

- Built with openFrameworks 0062

- Compiled against [gameoverhack's fork of ofxOpenNI](https://github.com/gameoverhack/ofxOpenNI/commit/a1ec3ffea09bdbd644e57cc9f5c2a1c20a65f02c)

- Inclues ofxControlPanel, which requires the ofxDirList addon.

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

**Thanks**  
Thanks to [Kyle McDonald](http://kylemcdonald.net/) and [Zach Lieberman](http://thesystemis.com/) for creating the 3DSAV class.
More student projects here: [http://3dsav.blogspot.com/](http://3dsav.blogspot.com/)

Thanks to Wagner for the music.

Big thanks to After Dark for their brilliant and twisted screen savers (and for kindly refraining from suing us).
