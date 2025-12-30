#pragma once

#include "stdio.h"
#include "ofMain.h"
#include "Mover.h"
#include "Toast.h"
#include "XnTypes.h"

class Flapper : public Mover {
public:
	
	Flapper();
    virtual void update();
    virtual void draw();    
    void updateHands(XnPoint3D leftHand, XnPoint3D rightHand);
    float flapPower;
    bool active;
    int gracePeriod;
    int timeLastHandUpdate;
    
private:
    int color;
    int rollTimer;
    
    void flap();
    void flapUp();
    void flapDown();
    void clapIn();
    void clapOut();
    
    
    int minFlapInterval;
    int lastFlapFrame;
    
    vector<Toast> toastPops;
    float timeLastToastPop;
    
    // input
    ofPoint leftHand, rightHand;
    
    // hand history
    int handHistoryDepth;
    vector<XnPoint3D> leftHandHistory;
    vector<XnPoint3D> rightHandHistory;	    
    
    // flap tracking
    float averageLeftVelocityX, averageRightVelocityX, averageLeftVelocityY, averageRightVelocityY;    
    float lastAverageLeftVelocityX, lastAverageRightVelocityX, lastAverageLeftVelocityY, lastAverageRightVelocityY;    
    ofPoint averageLeftPoint, averageRightPoint;
    float wingAngle;
    float leftCurrentX, rightCurrentX, leftCurrentY, rightCurrentY;
    float leftBottom, rightBottom;
    float leftTop, rightTop;
    float leftOuter, rightOuter;
    float leftInner, rightInner;
    float leftFlapSize, rightFlapSize;
    float leftClapSize, rightClapSize;
    float leftFlapSpeed, rightFlapSpeed;
    float leftClapSpeed, rightClapSpeed;
    int leftFlapReversalTime, rightFlapReversalTime; // time when we last reversed
    int leftClapReversalTime, rightClapReversalTime;

    // sound fx
    ofSoundPlayer flap1;
    ofSoundPlayer flap2;    
    ofSoundPlayer toastPop;
    
    // sprites
    int spriteCount;
    ofImage * sprites;
    ofImage * activeSprite;
};