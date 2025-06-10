// © 2025 Blueturn - Michael Boccara. 
// Licensed under CC BY-NC-SA 4.0.
// See https://creativecommons.org/licenses/by-nc-sa/4.0/

import { 
  gEpicDB,
  gInitEpicTime,
  gUpdateEpicTime, 
  gEpicImageData, 
  gEpicImageData0, 
  gEpicImageData1, 
  gZoom,
  gPivotEpicImageData
} 
from './app.js';
import { gControlState } from './controlparams.js';
import { gScreen } from './screen.js';

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2');
const pageLoadTime = Date.now();

let zoomFactor = 1.0;
let maxZoom = 2.0;
let mixBMEpicFactor = undefined;

// Load shader from file
async function loadShaderSource(url) {
  const res = await fetch(url);
  return res.text();
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Error compiling shader: " + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
  }
  return program;
}

function createTextureFromImage(image, tex = undefined) {
  if (!tex)
  {
    tex = gl.createTexture();
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  return tex;
}

function createTextureFromURL(url) {
  const tex = gl.createTexture();
  const image = new Image();
  image.src = url;
  image.onload = () => {
    createTextureFromImage(image, tex);
  };
  return tex;
}

function setActiveTexture(program, uniformName, tex, unit)
{
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  let uniformLocation = gl.getUniformLocation(program, uniformName)
  gl.uniform1i(uniformLocation, unit);
}

let nextTextureUnit = 1;
let epicTexUnit = new Map();

function glUseEpicTexture(program, epicImageData, epicStructUniformName)
{
  if (epicImageData && !epicImageData.image)
  {
    return true;
  }

  const epicHasDataUniformName = epicStructUniformName + '.hasData';
  const epicTextureUniformName = epicStructUniformName + '.texture';
  const epicHasTextureUniformName = epicStructUniformName + '.hasTexture';

  gl.uniform1i(gl.getUniformLocation(program, epicHasDataUniformName), !!epicImageData);

  if (!epicImageData || !epicImageData.texture)
  {
    setActiveTexture(program, epicTextureUniformName, null, 0);
    gl.uniform1i(gl.getUniformLocation(program, epicHasTextureUniformName), 0);
    return false;
  }

  if (!epicTexUnit.get(epicTextureUniformName))
  {
    epicTexUnit.set(epicTextureUniformName, nextTextureUnit);
    nextTextureUnit++;
  }
  setActiveTexture(program, epicTextureUniformName, epicImageData.texture, epicTexUnit.get(epicTextureUniformName));
  gl.uniform1i(gl.getUniformLocation(program, epicHasTextureUniformName), 1);
  gEpicDB.markUsedEpicImage(epicImageData);

  return true;
}

function loadTextureFromURL(program, path, uniformName)
{
  const tex = createTextureFromURL(path);
  setActiveTexture(program, uniformName, tex, nextTextureUnit);
  nextTextureUnit++;
  return tex;
}

const vsSource = `#version 300 es
in vec2 a_position;
out vec2 vertUV;
void main() {
  vertUV = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0, 1);
}
`;

gInitEpicTime();

Promise.all([
  loadShaderSource('./bt/epic_earth.frag.glsl'),
]).then(([fsSource]) => {
  const program = createProgram(gl, vsSource, fsSource);
  gl.useProgram(program);

  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1,  -1, 1,
    -1, 1,   1, -1,   1, 1,
  ]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Load textures
  loadTextureFromURL(program, './bt/images/world2.jpg', 'texEarthGround');
  loadTextureFromURL(program, './bt/images/light2.jpg', 'texEarthLights');

  // Set uniforms
  const resLoc = gl.getUniformLocation(program, 'iResolution');

  function glUpdateEPICImage(epicImageData, epicImageUniformName)
  {
    let hasEpicData = false;
    let hasEpicTexture = false;
    if (!epicImageData || !epicImageData.timeSec || !epicImageData.centroid_matrix || !epicImageData.earthRadius)
    {
      glUseEpicTexture(program, null, epicImageUniformName);
      return [false, false];
    }

    hasEpicData = true;
    gl.uniform1f(
      gl.getUniformLocation(program, epicImageUniformName + '.time_sec'), 
      epicImageData.timeSec);
    gl.uniform1f(
      gl.getUniformLocation(program, epicImageUniformName + '.earth_radius'), 
      epicImageData.earthRadius);
    gl.uniformMatrix3fv(
      gl.getUniformLocation(program, epicImageUniformName + '.centroid_matrix'),
      false,
      epicImageData.centroid_matrix
    );

    hasEpicTexture = glUseEpicTexture(program, epicImageData, epicImageUniformName);

    return [hasEpicData, hasEpicTexture];
  }

  class LoadEventTracker {
    #never = true;
    #was = undefined;
    #lostTime = undefined;
    #eventName = undefined;

    constructor(eventName) {
      this.#never = true;
      this.#was = undefined;
      this.#lostTime = undefined;
      this.#eventName = eventName;
    }

    sendEvent(has)
    {
      if (has && this.#never)
      {
        const elapsedTimeMs = Date.now() - pageLoadTime;
        const firstEventName = 'first-' + this.#eventName;
        console.log(firstEventName + ": " + elapsedTimeMs + "ms after page load");
        gtag('event', firstEventName, {
          timeSincePageLoadMs: elapsedTimeMs
        });
        this.#never = false;
      }
      if (!has && this.#was)
      {
        this.#lostTime = Date.now();
      }
      if (has && !this.#was && this.#lostTime != undefined)
      {
        const elapsedTimeMs = Date.now() - this.#lostTime;
        const lostEventName = 'lost-' + this.#eventName;
        console.log(lostEventName + " for " + elapsedTimeMs + "ms");
        gtag('event', lostEventName, {
          lossTime: elapsedTimeMs
        });
        this.#lostTime = undefined;
      }
      this.#was = has;
    }
  }

  const renderTracker = new LoadEventTracker('render');
  const epicImageTracker = new LoadEventTracker('epic-image');
  const epicDataTracker = new LoadEventTracker('bluemarble-image');
  
  function glSetBluemarbleEpicMixFactor(program)
  {
    let mixFactor;
      const MAX_GAP_IN_SEC = 2.0 * 3600.0; // max time distance from closest epic image: 2h
      const clamp = (num, a, b) =>
        Math.max(Math.min(num, Math.max(a, b)), Math.min(a, b));
    if (!gEpicImageData0 || !gEpicImageData1 || 
        (!gEpicImageData0.texture && !gEpicImageData1.texture))
    {
        // we can't even interpolate geometry, and we don't have any valid EPIC texture anchor
        mixFactor = 0.0;
    }
    else if (!gEpicImageData1.texture)
    {
        const boundDist0 = Math.abs(gEpicImageData.timeSec - gEpicImageData0.timeSec) / MAX_GAP_IN_SEC;
        mixFactor = 2.0 - clamp(boundDist0, 1.0, 2.0);
    }
    else if (!gEpicImageData0.texture)
    {
        const boundDist1 = Math.abs(gEpicImageData.timeSec - gEpicImageData1.timeSec) / MAX_GAP_IN_SEC;
        mixFactor = 2.0 - clamp(boundDist1, 1.0, 2.0);
    }
    else
    {
        const boundDist01 = Math.min(
            Math.abs(gEpicImageData.timeSec - gEpicImageData0.timeSec), 
            Math.abs(gEpicImageData.timeSec - gEpicImageData1.timeSec)) / MAX_GAP_IN_SEC;
        mixFactor = 2.0 - clamp(boundDist01, 1.0, 2.0);
    }

    function lerp( a, b, alpha ) {
        return a + alpha * ( b - a );
    }

    if (mixBMEpicFactor !== undefined)
      mixBMEpicFactor = lerp(mixBMEpicFactor, mixFactor, 0.1);
    else
      mixBMEpicFactor = mixFactor;

    gl.uniform1f(gl.getUniformLocation(program, 'mixBmEpic'), mixBMEpicFactor);
  }

  function glUpdateZoomCircleRadius()
  {
      let zoomCircleRadius = 200.0;
      const cursorPos = gScreen.getCursorPos();
      const pivotCursorVector = {
        x: cursorPos.x - gPivotEpicImageData.pivot_coordinates.x,
        y: cursorPos.y - gPivotEpicImageData.pivot_coordinates.y
      };
      const cursorPivotDistance = Math.sqrt(pivotCursorVector.x * pivotCursorVector.x + pivotCursorVector.y * pivotCursorVector.y);
      zoomCircleRadius = Math.max(zoomCircleRadius, cursorPivotDistance);
      gl.uniform1f(gl.getUniformLocation(program, 'zoomCircleRadius'), zoomCircleRadius);
  }

  function glUpdateUniforms()
  {
    const [hasEpicData0, hasEpicTexture0] = glUpdateEPICImage(gEpicImageData0, 'epicImage[0]');
    const [hasEpicData1, hasEpicTexture1] = glUpdateEPICImage(gEpicImageData1, 'epicImage[1]');
    const [hasEpicData, hasEpicTexture] = glUpdateEPICImage(gEpicImageData, 'curr_epicImage');
    if (gEpicImageData)
      gl.uniform1f(gl.getUniformLocation(program, 'curr_epicImage.mix01'), gEpicImageData.mix01 );
    glSetBluemarbleEpicMixFactor(program);


    if (gPivotEpicImageData)
    {
      const targetZoomFactor = gZoom ? maxZoom : 1.0;
      zoomFactor += 0.03 * (targetZoomFactor - zoomFactor); 
      glUpdateEPICImage(gPivotEpicImageData, 'pivot_epicImage');
      gl.uniform2f(gl.getUniformLocation(program, 'pivotScreenCoord'), 
        gPivotEpicImageData.pivot_coordinates.x, 
        gPivotEpicImageData.pivot_coordinates.y);
      gl.uniform1i(gl.getUniformLocation(program, 'zoomActive'), true);
      gl.uniform1f(gl.getUniformLocation(program, 'zoomFactor'), zoomFactor);

      gl.uniform1i(gl.getUniformLocation(program, 'showZoomCircle'), 1);
      glUpdateZoomCircleRadius();
    }
    else
    {
      zoomFactor = 1.0;
      gl.uniform1i(gl.getUniformLocation(program, 'zoomActive'), false);
      gl.uniform1f(gl.getUniformLocation(program, 'zoomFactor'), zoomFactor);
      gl.uniform1i(gl.getUniformLocation(program, 'showZoomCircle'), 1);
    }

    epicImageTracker.sendEvent(hasEpicTexture0 && hasEpicTexture1);
    epicDataTracker.sendEvent(hasEpicData);
  }

  function render(time) 
  {
    // Nothing to show without bound times
    if (gEpicDB.isReady())
    {
      gUpdateEpicTime(time);
      glUpdateUniforms();
    
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform3f(resLoc, canvas.width, canvas.height, 1.0);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    requestAnimationFrame(render);

    renderTracker.sendEvent(true);
  }

  requestAnimationFrame(render);

  let wakeLock = null;

  async function requestWakeLock() {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.error(`${err.name}, ${err.message}`);
    }
  }

  requestWakeLock();
});
