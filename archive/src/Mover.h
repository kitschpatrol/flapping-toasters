#pragma once

#include "ofMain.h"
#include "stdio.h"

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
