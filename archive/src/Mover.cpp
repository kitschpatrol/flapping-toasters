#include "Mover.h"
Mover::Mover() {
    cout << "Mover constructor" << endl;
}

void Mover::handleResize(int lastW, int lastH) {
    // reposition the mover to closest point in new window dimension
    x = ofMap(x, 0.0, (float)lastW, 0.0, (float)ofGetWidth());
    y = ofMap(y, 0.0, (float)lastH, 0.0, (float)ofGetHeight());
}

void Mover::update() {
    // override me!
}

void Mover::draw() {
    // override me!
}