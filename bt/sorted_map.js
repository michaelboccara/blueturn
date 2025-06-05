import {gArrayBoundIndices} from './utils.js';

export default class SortedMap {
  constructor() {
    this._keys = [];
    this._values = [];
  }

  set(key, value) {
    const i = this._findInsertIndex(key);
    if (this._keys[i] === key) {
      this._values[i] = value;
    } else {
      this._keys.splice(i, 0, key);
      this._values.splice(i, 0, value);
    }
  }

  get(key) {
    const i = this._binarySearch(key);
    return i >= 0 ? this._values[i] : undefined;
  }

  has(key) {
    return this._binarySearch(key) >= 0;
  }

  delete(key) {
    const i = this._binarySearch(key);
    if (i >= 0) {
      this._keys.splice(i, 1);
      this._values.splice(i, 1);
      return true;
    }
    return false;
  }

  floorEntry(key) {
    const i = this._floorIndex(key);
    return i >= 0 ? [this._keys[i], this._values[i]] : undefined;
  }

  ceilEntry(key) {
    const i = this._ceilIndex(key);
    return i < this._keys.length ? [this._keys[i], this._values[i]] : undefined;
  }

  lowerEntry(key) {
    const i = this._floorIndex(key);
    if (i >= 0 && this._keys[i] === key) return i > 0 ? [this._keys[i - 1], this._values[i - 1]] : undefined;
    return i >= 0 ? [this._keys[i], this._values[i]] : undefined;
  }

  higherEntry(key) {
    const i = this._ceilIndex(key);
    if (i < this._keys.length && this._keys[i] === key) return i + 1 < this._keys.length ? [this._keys[i + 1], this._values[i + 1]] : undefined;
    return i < this._keys.length ? [this._keys[i], this._values[i]] : undefined;
  }

  _floorIndex(key) {
    let lo = 0, hi = this._keys.length - 1;
    let best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this._keys[mid] <= key) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  }

  _ceilIndex(key) {
    let lo = 0, hi = this._keys.length - 1;
    let best = this._keys.length;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this._keys[mid] >= key) {
        best = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return best;
  }

  _binarySearch(key) {
    let lo = 0, hi = this._keys.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this._keys[mid] === key) return mid;
      if (this._keys[mid] < key) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  }

  _findInsertIndex(key) {
    let lo = 0, hi = this._keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this._keys[mid] < key) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  *entries() {
    for (let i = 0; i < this._keys.length; i++) {
      yield [this._keys[i], this._values[i]];
    }
  }

  [Symbol.iterator]() {
    return this.entries();
  }

  get size() {
    return this._keys.length;
  }

  boundEntries(key) {
    const [lowerIndex, upperIndex] = gArrayBoundIndices(this._keys, key, true); 
    const lowerEntry = (lowerIndex >= 0 && lowerIndex < this._keys.length) ? [this._keys[lowerIndex], this._values[lowerIndex]] : null;
    const upperEntry = (upperIndex >= 0 && upperIndex < this._keys.length) ? [this._keys[upperIndex], this._values[upperIndex]] : null;
    return [lowerEntry, upperEntry];
  }

  neighborEntries(key) {
    const i = this._binarySearch(key);
    if (i === -1) return [undefined, undefined];

    const prev = i > 0 ? [this._keys[i - 1], this._values[i - 1]] : undefined;
    const next = i + 1 < this._keys.length ? [this._keys[i + 1], this._values[i + 1]] : undefined;

    return [prev, next];
  }
}
