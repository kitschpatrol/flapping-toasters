#include "testApp.h"
void testApp::setup() {
	ofBackground(0, 0, 0);
	ofSetFrameRate(60);
	
    // set up kinect
    context.setup();
	depth.setup(&context);
	rgb.setup(&context);
	user.setup(&context);
	
    user.setSmoothing(0.1); // built in openni skeleton smoothing
	user.setUseMaskPixels(true);
	user.setUseCloudPoints(false);    

    // using hand tracking went worse than expected
	// hands.setup(&context);
	// hands.setSmoothing(0.1);		// built in openni hand track smoothing...
	// hands.setFilterFactors(0.1);	// custom smoothing/filtering (can also set per hand with setFilterFactor)...set them all to 0.1f to begin with        
    
	context.toggleRegisterViewport();
	context.toggleMirror();	
    
    // control panel
	panel.setup("Control Panel", ofGetWidth() - 315, 5, 300, 200);	
	panel.addPanel("Physics");	
	panel.addSlider("flap power", "flapPower", 3.4, 0, 10, false);
	panel.addSlider("gravity", "gravity", .14, 0, 5, false);
    panel.addToggle("show kinect", "drawKinect", true);
    
    // create flappers
    flapperCount = 15;
    flappers = new Flapper[flapperCount];    
    
    // create toast
    toastCount = 11;
    toasts = new Toast[toastCount];
    
    // music
    valkyries.loadSound("valkyries.wav");
}

void testApp::update() {
    // update sound
	ofSoundUpdate();
    
    // update kinect
	context.update();
    depth.update();
    rgb.update();
	user.update();    

	// find the hands via openni's skeleton tracking
    int pairsOfHandsFound = 0;
    
    // tracked user IDs start at 1, not 0
	for (int i = 1; i <= user.getNumberOfTrackedUsers(); i++) {

		ofxTrackedUser* tracked = user.getTrackedUser(i);
        
        if ((tracked != NULL) && tracked->left_lower_arm.found && tracked->right_lower_arm.found) {
            pairsOfHandsFound++;
            
            // start the music
            if(!valkyries.getIsPlaying()) {
                valkyries.play();
            }            
            
            flappers[tracked->id - 1].updateHands(tracked->left_lower_arm.position[1], tracked->right_lower_arm.position[1]);
        }
	}
    
    // stop the music and seek to the beginning if no one is playing
    if (pairsOfHandsFound == 0) {
        if (valkyries.getIsPlaying()) {
            valkyries.stop();
            valkyries.setPosition(0.0);
        }             
    }
    
    // update the toast
    for (int i = 0; i < toastCount; i++) {
        toasts[i].update();
    }        
    
    // update the flappers
    for (int i = 0; i < flapperCount; i++) {
        flappers[i].flapPower = panel.getValueF("flapPower");
        flappers[i].gravity = panel.getValueF("gravity");
        flappers[i].update();
    }
    
    lastWindowWidth = ofGetWidth();
    lastWindowHeight = ofGetHeight();
}


void testApp::draw() {
    ofBackground(0, 0, 0);
    ofSetColor(255, 255, 255);
    
    // draw the sprites
    ofEnableAlphaBlending();
    
    // draw the toast
    for (int i = 0; i < toastCount; i++) {
        toasts[i].draw();
    }    
    
    // draw the flappers
    for (int i = 0; i < flapperCount; i++) {
        flappers[i].draw();
    }
    
    ofDisableAlphaBlending();

    
    // draw the interface    
    if (panel.getValueB("drawKinect")) {
        ofPushMatrix();
        ofTranslate(ofGetWidth() - 320, ofGetHeight() - 240);
        ofScale(0.5, 0.5);
        
        rgb.draw(0, 0, 640, 480);    
        
        glEnable(GL_BLEND);
        glBlendFunc(GL_DST_COLOR, GL_ZERO);
        // user.drawUserMasks(0, 0); // method is gone?
        glDisable(GL_BLEND);    
        
        user.draw();    
        // hands.drawHands();
        
        ofSetColor(255, 255, 255);
        ofSetLineWidth(1);
        ofNoFill();
        ofRect(0, 0, 640, 480);
        ofSetLineWidth(0);    
        ofSetColor(255, 255, 255);    
        ofPopMatrix();    
    }
}

//--------------------------------------------------------------
void testApp::keyPressed(int key){
    // toggle full screen
    if (key == 'f') {
        ofToggleFullscreen();
    }
    
    // toggle the kinect
    if (key == 'k') {
        if(panel.getValueB("drawKinect")) {
            panel.setValueB("drawKinect", false);
        }
        else {
            panel.setValueB("drawKinect", true);            
        }
    }
}


//--------------------------------------------------------------
void testApp::keyReleased(int key){
	
}

//--------------------------------------------------------------
void testApp::mouseMoved(int x, int y ){
	
}

//--------------------------------------------------------------
void testApp::mouseDragged(int x, int y, int button){
	
}

//--------------------------------------------------------------
void testApp::mousePressed(int x, int y, int button){
    
}

//--------------------------------------------------------------
void testApp::mouseReleased(int x, int y, int button){
	
}

//--------------------------------------------------------------
void testApp::windowResized(int w, int h){
	cout << "resized!" << endl;
    cout << "Last size: " << lastWindowWidth << "\t" << lastWindowHeight << "\tNew Size: " << w << "\t" << h << endl;
    
    // resize everyone
    // draw the toast
    for (int i = 0; i < toastCount; i++) {
        toasts[i].handleResize(lastWindowWidth, lastWindowHeight);
    }    
    
    // draw the flappers
    for (int i = 0; i < flapperCount; i++) {
        flappers[i].handleResize(lastWindowWidth, lastWindowHeight);
    }
    
    // reposition panel?
    //panel.setPositoin(0, 0);
    
    lastWindowWidth = ofGetWidth();
    lastWindowHeight = ofGetHeight();    
    
}
