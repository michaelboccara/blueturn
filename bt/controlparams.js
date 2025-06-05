// © 2025 Blueturn - Michael Boccara. 
// Licensed under CC BY-NC-SA 4.0.
// See https://creativecommons.org/licenses/by-nc-sa/4.0/

export let gControlState = {
    source: 'nasa',
    timeSpeed: 3600,
    play: false,
    date: undefined,
    time: undefined,
    rangeSec: undefined,
    showText: true,
    zoomEnabled: true,
    showZoomCircle: true
};

let controlMap = new Map();
controlMap.set('source', (v) => {gControlState.source = v;}); // 'nasa', 'bt-s3', 'bt-cdn'
controlMap.set('speed', (v) => {gControlState.timeSpeed = parseInt(v);});
controlMap.set('play', (v) => {gControlState.play = parseInt(v) != 0;});
controlMap.set('date', (v) => {gControlState.date = v;});
controlMap.set('time', (v) => {gControlState.time = v;});
controlMap.set('range', (v) => {gControlState.rangeSec = parseInt(v) * 24 * 3600;});
controlMap.set('showText', (v) => {gControlState.showText = parseInt(v);});
controlMap.set('zoomEnabled', (v) => {gControlState.zoomEnabled = parseInt(v);});
controlMap.set('showZoomCircle', (v) => {gControlState.showZoomCircle = parseInt(v);});

const urlParams = new URLSearchParams(window.location.search);

controlMap.forEach((cb, param) => {
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
    controlMap.forEach((cb, param) => {
        if (event.data.type === param) {
            console.log("Handling message: ", event.data);
            cb(event.data.value);
        }
    });
});
