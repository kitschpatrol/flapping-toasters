#pragma once

#include "Mover.h"
#include "ofMain.h"
#include "stdio.h"

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
	ofImage * toastPopImage;
};