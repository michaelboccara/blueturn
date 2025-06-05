// © 2025 Blueturn - Michael Boccara. 
// Licensed under CC BY-NC-SA 4.0.
// See https://creativecommons.org/licenses/by-nc-sa/4.0/

const { vec3, mat3 } = window.glMatrix;


export function gCalcEarthRadiusFromDistance(distance)
{
    // Magic from SM
    return ((1024-158) / 1024) * (1386540) / distance;
}

export function gCalcLatLonNorthRotationMatrix(latitudeDeg, longitudeDeg) {
    const lat = latitudeDeg * Math.PI / 180.0;
    const lon = longitudeDeg * Math.PI / 180.0;

    // z axis
    const z = [
        -Math.cos(lat) * Math.cos(lon),
        -Math.sin(lat),
        Math.cos(lat) * Math.sin(lon)
    ];

    const tmpY = [0.0, 1.0, 0.0];

    // x axis
    const x = [];
    vec3.cross(x, tmpY, z);
    vec3.normalize(x, x);

    // y axis
    const y = [];
    vec3.cross(y, z, x);
    vec3.normalize(y, y);

    // mat3 in column-major order: [x, y, z]
    const m = mat3.fromValues(
        x[0], y[0], z[0],
        x[1], y[1], z[1],
        x[2], y[2], z[2]
    );

    return m;
}

export function gCalcNormalFromScreenCoord(screenCoord, earthRadiusPx, screenWidth, screenHeight) 
{
  // Convert screen coordinates to normalized device coordinates (NDC)
  const minSize = Math.min(screenWidth, screenHeight);
  let uv = {
    x: (2.0 * screenCoord.x - screenWidth) / minSize,
    y: (2.0 * screenCoord.y - screenHeight) / minSize
  };

  // Project to sphere in view space
  let earth_uv = {
    x: uv.x / (earthRadiusPx / (minSize / 2.0)),
    y: uv.y / (earthRadiusPx / (minSize / 2.0))
  };

  let xySq = earth_uv.x * earth_uv.x + earth_uv.y * earth_uv.y;
  let z = Math.sqrt(1.0 - xySq);
  // Normal in view space
  let normal = [earth_uv.x, earth_uv.y, z];
  return normal;
}

export function gCalcLatLonFromScreenCoord(screenCoord, centroidMatrix, earthRadiusPx, screenWidth, screenHeight) 
{
  let normal = gCalcNormalFromScreenCoord(screenCoord, earthRadiusPx, screenWidth, screenHeight);
  if (normal.z < 0.0) {
    // Normal is pointing away from the sphere
    return null;
  }

  let transCentroidMatrix = mat3.create();
  mat3.transpose(transCentroidMatrix, centroidMatrix);
  // Transform normal to globe coordinates
  let globeNormal = vec3.create();
  vec3.transformMat3(globeNormal, normal, transCentroidMatrix);

  const globeNormalLengthXZ = Math.sqrt(
    globeNormal[0] * globeNormal[0] + 
    globeNormal[2] * globeNormal[2]);
  
  let lat = Math.atan2(globeNormalLengthXZ, globeNormal[1]) / Math.PI * 180.0 - 90.0;
  let lon = 180.0 - Math.atan2(globeNormal[2], globeNormal[0]) / Math.PI * 180.0;
  if (lon >  180.0) lon -= 360.0;
  if (lon < -180.0) lon += 360.0;
  if (lat >  90.0 ) lat -= 180.0;
  if (lat < -90.0 ) lat += 180.0;
  return {
    lat: lat,
    lon: lon
  };
}

export function gArrayBoundIndices(array, key, strict) 
{
  let lo = 0, hi = array.length - 1;
  let lower = -1;
  let upper = array.length;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const midKey = array[mid];

    if (midKey < key) {
      lower = mid;
      lo = mid + 1;
    } 
    else if (midKey > key) {
      hi = mid - 1;
      upper = mid;
    }
    else {
      if (strict){
        lower = mid - 1;
        upper = mid + 1;
      }
      else {
        lower = upper = mid;
      }
      break;
    }
  }

  // At this point:
  // lower = greatest index where key < input
  // upper = smallest index where key > input (because we skipped equal keys)

  return [lower, upper];
}

export function gGetPrevDateStr(date = _todayDatesStr)
{
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    return prevDate.toISOString().slice(0, 10);
}

export function gGetNextDateStr(date)
{
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() + 1);
    return prevDate.toISOString().slice(0, 10);
}

const TodayDatesStr = new Date().toISOString().slice(0, 10);

export function gGetTodayDateStr()
{
    return TodayDatesStr;
}

export function gGetDayFromTimeSec(timeSec)
{
    const date = new Date(timeSec * 1000);
    return date.toISOString().slice(0, 10);
}

