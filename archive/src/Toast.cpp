#include "Toast.h"

Toast::Toast() {
    
    if(ofRandom(0, 1) > 0.5) {
        toastGraphic.loadImage("mediumToast.png");        
    }
    else {
        toastGraphic.loadImage("lightToast.png");            
    }
    
    toastPopImage = new ofImage[4];
    
    for(int i = 1; i < 5; i++){
        toastPopImage[i-1].loadImage("toastPop" + ofToString( i ) + ".png" ); 
    }
    
    vX = -1;
    vY = 0.5;
    x = ofRandom(ofGetWidth(), ofGetWidth() * 1.5);
    y = ofRandom(-ofGetHeight(), ofGetHeight() * 0.25);
}

void Toast::update() {
    x += vX;
    y += vY;
    
    // loop the toast
    if (((x + toastGraphic.getWidth()) < 0) || (y > ofGetHeight())) {
        x = ofRandom(ofGetWidth(), ofGetWidth() * 1.5);
        y = ofRandom(-ofGetHeight(), ofGetHeight() * 0.25);
    }
}

void Toast::draw() {
    toastGraphic.draw(x, y);
}


void Toast::updatePops(){
    x += vX * 2;
    y += vY * 2;
    
    // loop the toast
    if (((x + toastPopImage[0].getWidth()) < 0) || (y > ofGetHeight())) {
        x = ofRandom(ofGetWidth(), ofGetWidth() * 1.5);
        y = ofRandom(-ofGetHeight(), ofGetHeight() * 0.25);
    }    
}

void Toast::popToast(){    
    toastPopImage[int( popStage / 2 )].draw( x, y );
    popStage++;
    
    if( popStage > 6 ) popStage = 6;
}