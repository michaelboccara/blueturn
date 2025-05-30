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
  gPivotEpicImageData,
  gEpicZoom
} 
from './app.js';
import { gControlState } from './controlparams.js';
import gEpicImageLoader from './epic_image_loader.js';

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2');
const pageLoadTime = Date.now();

let epicZoomFactor = 1.0;
let epicMaxZoom = 2.0;

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
  const epicTextureUniformName = epicStructUniformName + '.texture';
  const epicHasTextureUniformName = epicStructUniformName + '.hasTexture';
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
  gEpicImageLoader.markUsed(epicImageData);

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
    let hasEpicTexture = false;
    let hasEpicData = false;
    if (epicImageData &&
        epicImageData.centroid_matrix)
    {
      hasEpicData = true;
      gl.uniform1f(
        gl.getUniformLocation(program, epicImageUniformName + '.earth_radius'), 
        epicImageData.earthRadius);
      gl.uniformMatrix3fv(
        gl.getUniformLocation(program, epicImageUniformName + '.centroid_matrix'),
        false,
        epicImageData.centroid_matrix
      );
      hasEpicTexture = glUseEpicTexture(program, epicImageData, epicImageUniformName);
    }
    else
    {
      glUseEpicTexture(program, null, epicImageUniformName);
    }

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

  function glUpdateUniforms()
  {
    const [hasEpicData0, hasEpicTexture0] = glUpdateEPICImage(gEpicImageData0, 'epicImage[0]');
    const [hasEpicData1, hasEpicTexture1] = glUpdateEPICImage(gEpicImageData1, 'epicImage[1]');
    const [hasEpicData, hasEpicTexture] = glUpdateEPICImage(gEpicImageData, 'curr_epicImage');
    gl.uniform1i(gl.getUniformLocation(program, 'showPivotCircle'), gControlState.showZoomCircle);
    if (gEpicImageData)
      gl.uniform1f(gl.getUniformLocation(program, 'curr_epicImage.mix01'), gEpicImageData.mix01 );

    let epicTargetZoomFactor = gEpicZoom ? epicMaxZoom : 1.0;
    if (gPivotEpicImageData)
    {
      epicZoomFactor += 0.03 * (epicTargetZoomFactor - epicZoomFactor); 
      glUpdateEPICImage(gPivotEpicImageData, 'pivot_epicImage');
      gl.uniform2f(gl.getUniformLocation(program, 'pivotScreenCoord'), 
        gPivotEpicImageData.pivot_coordinates.x, 
        gPivotEpicImageData.pivot_coordinates.y);
      gl.uniform1i(gl.getUniformLocation(program, 'epicZoomEnabled'), gControlState.zoomEnabled);
      gl.uniform1f(gl.getUniformLocation(program, 'epicZoomFactor'), epicZoomFactor);
    }
    else
    {
      epicZoomFactor = 1.0;
      gl.uniform1i(gl.getUniformLocation(program, 'epicZoomEnabled'), false);
      gl.uniform1f(gl.getUniformLocation(program, 'epicZoomFactor'), epicZoomFactor);
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
});
