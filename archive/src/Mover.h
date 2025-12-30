#pragma once

#include "stdio.h"
#include "ofMain.h"

class Mover {
    public:
    Mover();
    virtual void update();
    virtual void draw();
    float gravity;    
    float x, y;
    void handleResize(int lastW, int lastH);
    
protected:
    float vX, vY;
    float ax, ay;    
};
	