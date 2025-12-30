#pragma once

#include "stdio.h"
#include "ofMain.h"
#include "Mover.h"

class Toast : public Mover {
public:
	
	Toast();
    virtual void update();
    virtual void draw();
    
    int popStage;
    
    void updatePops();
    void popToast();
    
private:
    ofImage toastGraphic;
    ofImage *toastPopImage;
};