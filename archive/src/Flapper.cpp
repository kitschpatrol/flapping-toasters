#include "Flapper.h"

Flapper::Flapper() {
    // constructor
	cout << "Creating flapper" << endl;
    
    active = false;
    rollTimer = 0;
    
    handHistoryDepth = 10; // store the last 10 hand positions, newest first
    
    averageLeftVelocityX, averageRightVelocityX = 0;
    averageLeftVelocityY, averageRightVelocityY = 0;
    leftFlapReversalTime, rightFlapReversalTime = 0;
    leftFlapSpeed, rightFlapSpeed = 0;

    x = ofGetWidth();
    y = 0;
    
    vX = 0;
    vY = 0.5;
    
    ax = 0;
    ay = 0;
    
    gravity = 0.2;
    
    color = round(ofRandom(0, 255));
    
    flap1.loadSound("flap1.wav");
    flap1.setVolume(0.5);
    flap1.setMultiPlay(true);

    flap2.loadSound("flap2.wav");
    flap2.setVolume(0.5);    
    flap2.setMultiPlay(true);
    
    toastPop.loadSound("toaster.wav");
    toastPop.setMultiPlay(true);
    
    // load images
    spriteCount = 20;
    sprites = new ofImage[spriteCount];
    for (int i = 0; i < spriteCount; i++) {
        sprites[i].loadImage("roll" + ofToString(i + 1) + ".png");
    }
    
    // wings level by defaut
    activeSprite = &sprites[18];    
    
    gracePeriod = 5 * 1000;
    
    minFlapInterval = 100; // 100 frames between flaps
    lastFlapFrame = ofGetFrameNum();

}

void Flapper::flapUp() {
    cout << "FLAP UP" << endl;
    

    vY = 0.5;
    vY -= flapPower;
    //cout << vY << endl;
        
    
}

void Flapper::flapDown() {
    //cout << "FLAP DOWN" << endl;
}

void Flapper::flap() {
    // play sound
    if((rand() / RAND_MAX) > 0.5) {
        flap1.play();
    }
    else {
        flap2.play();        
    }        
}

void Flapper::clapIn(){
    int toastingTime = 1 * 1000;
    
    if( ofGetElapsedTimeMillis() - timeLastToastPop > toastingTime ){
        Toast pop;
        pop.x = x - 75;
        pop.y = y - 100;
        pop.popStage = 0;
        toastPops.push_back( pop );
        timeLastToastPop = ofGetElapsedTimeMillis();
        
        // play the sound
        toastPop.play();
        
    }
}

void Flapper::clapOut(){
    //cout << "CLAP OUT" << endl;
}

void Flapper::update() {
    x += vX;
    y += vY;
    
    if (toastPops.size() > 0) {
        for( int i = 0; i < toastPops.size(); i++ ) {
            toastPops[i].updatePops();
        }
    }
    
    // ground
    if (y > (ofGetHeight() - activeSprite->getHeight())) {
        y = ofGetHeight() - activeSprite->getHeight();
        vY = 0;
        vX = 0;
    }
    
    if(active && ((ofGetElapsedTimeMillis() - timeLastHandUpdate) > gracePeriod)) {
        active = false;
        cout << " GRACE PERIOD IS OVER " << endl;
        activeSprite = &sprites[6];
    }
    
    if(active) {
        vX = -1;
        vY += gravity;
        if( vY > 3.0 ){
            vY = 3.0;
        }
    }
    else {
        vX = 0;
        vY = 0;
        activeSprite = &sprites[6];
    }
    
    // which third of the arc are we in

    float flapPercent = ofMap(leftCurrentY, leftTop + .001, leftBottom + .002, 0, 1);
    
    //if(active) cout << "Left Current: " << leftCurrentY << "\tLeft Top: " << leftTop << "\tleft bottom: " << leftBottom << "\tFLAP PERCENT: " << flapPercent << endl;
    
    
    //wingAngle
    if(flapPercent < .33 & wingAngle > -15 && wingAngle < 15 ) {
        // wings up
        activeSprite = &sprites[17];
        rollTimer = 1;
    }
    else if ((flapPercent >= .33) && (flapPercent <= .66) && wingAngle > -15 && wingAngle < 15 ) {
        // wings level
        activeSprite = &sprites[18];
        rollTimer = 0;
    }
    else if (flapPercent > .66 & wingAngle > -15 && wingAngle < 15 ) {
        // wings down
        activeSprite = &sprites[19];
        rollTimer = 0;
    }
    else if( wingAngle <=-15 ){
        activeSprite = &sprites[ int( rollTimer / 3 ) ];
        x+=2;
        y+=2;
        rollTimer++;
        if( rollTimer >= 45 ){
            rollTimer = 0;
        }
    }
    else if( wingAngle >= 15 ){
        activeSprite = &sprites[ int( rollTimer / 3 )];
        x-=2;
        y-=2;
        rollTimer--;
        if( rollTimer <= 0 ){
            rollTimer = 45;
        }
    }
    
    // loop the toaster
    if ((x + activeSprite->getWidth()) < 0) {
        x = ofGetWidth();
        y = 0;
    }    
    
}

void Flapper::draw() {
    activeSprite->draw(x, y);
    for(int i = 0; i < toastPops.size(); i++ ){
        toastPops[i].popToast();
    }
}




void Flapper::updateHands(XnPoint3D leftHand, XnPoint3D rightHand) {
    
    active = true;
    timeLastHandUpdate = ofGetElapsedTimeMillis();
    
	// add hand positions to history
	if (leftHandHistory.size() <= handHistoryDepth) {
		leftHandHistory.insert(leftHandHistory.begin(), leftHand);
	}
	
	if (rightHandHistory.size() <= handHistoryDepth) {
		rightHandHistory.insert(rightHandHistory.begin(), rightHand);
	}
	
	// remove hand positions from history
	if (leftHandHistory.size() > handHistoryDepth) {
		leftHandHistory.pop_back();
	}
	
	if (rightHandHistory.size() > handHistoryDepth) {
		rightHandHistory.pop_back();
	}
    
    
    // Find average velocity for up and down motion
    float leftVelocityAccumulatorY = 0;
    float rightVelocityAccumulatorY = 0;
    ofPoint leftPointAccumulator;
    ofPoint rightPointAccumulator;
    
    for (int i = 0; i < handHistoryDepth - 1; i++) {
        leftVelocityAccumulatorY += leftHandHistory[i].Y - leftHandHistory[i + 1].Y;            
        rightVelocityAccumulatorY += rightHandHistory[i].Y - rightHandHistory[i + 1].Y;
        
        leftPointAccumulator.x += leftHandHistory[i].X;
        leftPointAccumulator.y += leftHandHistory[i].Y;
        
        rightPointAccumulator.x += rightHandHistory[i].X;
        rightPointAccumulator.y += rightHandHistory[i].Y;            
    }
    
    averageLeftVelocityY = leftVelocityAccumulatorY / (handHistoryDepth - 1);        
    averageRightVelocityY = rightVelocityAccumulatorY / (handHistoryDepth - 1);
    
    averageLeftPoint.x = leftPointAccumulator.x / (handHistoryDepth - 1);
    averageLeftPoint.y = leftPointAccumulator.y / (handHistoryDepth - 1);
    
    averageRightPoint.x = rightPointAccumulator.x / (handHistoryDepth - 1);
    averageRightPoint.y = rightPointAccumulator.y / (handHistoryDepth - 1);
    
    
    // determine direction
    float velocityThreshold = 5;
    
    leftCurrentX = leftHand.X;
    leftCurrentY = leftHand.Y;
    rightCurrentX = rightHand.X;
    rightCurrentY = rightHand.Y;    
    
    bool flapped = false;
    
    if ((averageLeftVelocityY >= velocityThreshold) && (lastAverageLeftVelocityY < velocityThreshold)) {
        //cout << "Left Starting down" << endl;
        
        //distance over time
        leftTop = leftHand.Y;            
        leftFlapSpeed = (float)leftFlapSize / (ofGetElapsedTimeMillis() - leftFlapReversalTime);
        leftFlapReversalTime = ofGetElapsedTimeMillis();
        
        flapUp();
        flapped = true;
    }
    
    if ((averageLeftVelocityY <= velocityThreshold) && (lastAverageLeftVelocityY > velocityThreshold)) {
        //cout << "Left Starting up" << endl;
        leftBottom = leftHand.Y;
        leftFlapSpeed = (float)leftFlapSize / (ofGetElapsedTimeMillis() - leftFlapReversalTime);
        leftFlapReversalTime = ofGetElapsedTimeMillis();     
        flapDown();        
        flapped = true;        
    }                
    
    if ((averageRightVelocityY >= velocityThreshold) && (lastAverageRightVelocityY < velocityThreshold)) {
        //cout << "Right Starting down" << endl;
        rightTop = rightHand.Y;
        rightFlapSpeed = (float)rightFlapSize / (ofGetElapsedTimeMillis() - rightFlapReversalTime);
        rightFlapReversalTime = ofGetElapsedTimeMillis();
        flapUp();          
        flapped = true;        
    }
    
    if ((averageRightVelocityY <= velocityThreshold) && (lastAverageRightVelocityY > velocityThreshold)) {
        //cout << "Right Starting up" << endl;
        rightBottom = rightHand.Y;
        rightFlapSpeed = (float)rightFlapSize / (ofGetElapsedTimeMillis() - rightFlapReversalTime);
        rightFlapReversalTime = ofGetElapsedTimeMillis();
        flapDown();        
        flapped = true;        
    }
    
    // singular flap
    if(flapped && ((ofGetFrameNum() - lastFlapFrame) > minFlapInterval)) {
        flap();
        lastFlapFrame = ofGetFrameNum();        
    }
    
    // store last for comparison on next frame
    lastAverageRightVelocityY = averageRightVelocityY;
    lastAverageLeftVelocityY = averageLeftVelocityY;
    
    // calculate size of latest flap
    leftFlapSize = abs(leftTop - leftBottom);
    rightFlapSize = abs(rightTop - rightBottom);
    
    // figure out fap angle
    wingAngle = atan2(averageRightPoint.y - averageLeftPoint.y, averageRightPoint.x - averageLeftPoint.x) * 180 / PI;
    
    //cout << "Left Spread: " << leftFlapSize << "\tLeft Top: " << leftTop << "\tLeft Bottom: " << leftBottom << "\tLeft Speed: " << leftFlapSpeed << "\tWing Angle: " << wingAngle << endl;    

    
    // Find average velocity for in and out motion
    float leftVelocityAccumulatorX = 0;
    float rightVelocityAccumulatorX = 0;
    
    for (int i = 0; i < handHistoryDepth - 1; i++) {
        leftVelocityAccumulatorX += leftHandHistory[i].X - leftHandHistory[i + 1].X;            
        rightVelocityAccumulatorX += rightHandHistory[i].X - rightHandHistory[i + 1].X;
    }
    
    averageLeftVelocityX = leftVelocityAccumulatorX / (handHistoryDepth - 1);        
    averageRightVelocityX = rightVelocityAccumulatorX / (handHistoryDepth - 1);
    
    // determine direction
    velocityThreshold = 10;
    
    leftCurrentX = leftHand.X;
    leftCurrentY = leftHand.Y;
    rightCurrentX = rightHand.X;
    rightCurrentY = rightHand.Y;    
    
    if ((averageLeftVelocityX >= velocityThreshold) && (lastAverageLeftVelocityX < velocityThreshold)) {
        cout << "Left clapping" << endl;
        
        //distance over time
        leftInner = leftHand.X;            
        leftClapSpeed = (float)leftClapSize / (ofGetElapsedTimeMillis() - leftClapReversalTime);
        leftClapReversalTime = ofGetElapsedTimeMillis();
        
        clapIn();  
    }
    
    if ((averageLeftVelocityX <= velocityThreshold) && (lastAverageLeftVelocityX > velocityThreshold)) {
        cout << "Left not" << endl;
        leftOuter = leftHand.X;
        leftClapSpeed = (float)leftClapSize / (ofGetElapsedTimeMillis() - leftClapReversalTime);
        leftClapReversalTime = ofGetElapsedTimeMillis();     
        
        clapOut();        
        
    }                
    
    if ((averageRightVelocityX >= velocityThreshold) && (lastAverageRightVelocityX < velocityThreshold)) {
        cout << "Right clapping" << endl;
        rightInner = rightHand.X;
        rightClapSpeed = (float)rightClapSize / (ofGetElapsedTimeMillis() - rightClapReversalTime);
        rightClapReversalTime = ofGetElapsedTimeMillis();
        
        //clapIn();          
        
    }
    
    if ((averageRightVelocityX <= velocityThreshold) && (lastAverageRightVelocityX > velocityThreshold)) {
        cout << "Right not" << endl;
        rightOuter = rightHand.X;
        rightClapSpeed = (float)rightClapSize / (ofGetElapsedTimeMillis() - rightClapReversalTime);
        rightClapReversalTime = ofGetElapsedTimeMillis();
        
        //clapOut();
    }
    
    // store last for comparison on next frame
    lastAverageRightVelocityX = averageRightVelocityX;
    lastAverageLeftVelocityX = averageLeftVelocityX;
    
    // calculate size of latest flap
    leftClapSize = abs(leftOuter - leftInner);
    rightClapSize = abs(rightOuter - rightOuter);
    
    //    cout << "Left Spread: " << leftClapSize << "\tLeft Outer: " << leftOuter << "\tLeft Inner: " << leftInner << "\tLeft Speed: " << leftClapSpeed << endl;

    
}