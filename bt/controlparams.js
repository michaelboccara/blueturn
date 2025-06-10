// © 2025 Blueturn - Michael Boccara. 
// Licensed under CC BY-NC-SA 4.0.
// See https://creativecommons.org/licenses/by-nc-sa/4.0/

export let gControlState = {
    source: 'nasa',
    speed: 3600,
    play: true,
    day: undefined,
    time: undefined,
    range: undefined,
    showText: true,
    zoom: undefined,
    holding: false,
    snapping: false
};

export let gControlMap = new Map();
gControlMap.set('source', (v) => {gControlState.source = v;}); // 'nasa', 'bt-s3', 'bt-cdn'
gControlMap.set('speed', (v) => {gControlState.speed = parseInt(v);});
gControlMap.set('play', (v) => {gControlState.play = parseInt(v) != 0;});
gControlMap.set('day', (v) => {gControlState.day = v;});
gControlMap.set('time', (v) => {gControlState.time = v;});
gControlMap.set('range', (v) => {gControlState.range = parseInt(v) * 24 * 3600;});
gControlMap.set('showText', (v) => {gControlState.showText = parseInt(v) != 0;});
gControlMap.set('zoom', (v) => {gControlState.zoom = v;});

const urlParams = new URLSearchParams(window.location.search);

gControlMap.forEach((cb, param) => {
    const paramValue = urlParams.get(param);
    if (paramValue === null)
        return;
    console.log("URL param: ", param, " = ", paramValue);
    cb(paramValue);
});

console.log("Listening to messages...");

window.addEventListener("message", (event) => {
    //if (event.origin !== "https://app.blueturn.earth") return; // security check
    //console.log("Received message: ", event.data);
    gControlMap.forEach((cb, param) => {
        if (event.data.type === param) {
            console.log("Handling message: ", event.data);
            cb(event.data.value);
        }
    });
});
