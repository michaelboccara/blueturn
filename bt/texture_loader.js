export class TextureLoader {
  constructor(gl, { maxGPUMemoryBytes = 64 * 1024 * 1024 } = {}) {
    this.gl = gl;
    this.maxMemory = maxGPUMemoryBytes;
    this.textureCache = new Map(); // url → { texture, size, lastUsed }
    this.pendingLoads = new Map(); // url → { controller }
    this.totalMemory = 0;
  }

  loadTexture(url, { forceReload = false, onSuccess, onError, onAbort, onEvict } = {}) {
    if (!forceReload && this.textureCache.has(url)) {
      const entry = this.textureCache.get(url);
      entry.lastUsed = performance.now();
      onSuccess?.(url, entry.texture);
      return;
    }

    if (!forceReload && this.pendingLoads.has(url)) return;

    const controller = new AbortController();
    const signal = controller.signal;
    this.pendingLoads.set(url, controller);
    
    fetch(url, { mode: 'cors', cache: 'force-cache', signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blob => {
        return this._createTextureFromBlob(blob);
      })
      .then(([texture, width, height]) => {
        const size = width * height * 4; // estimate in bytes
        this._insertIntoCache(url, texture, size, onEvict);
        this.pendingLoads.delete(url);
        onSuccess?.(url, texture);
      })
      .catch(err => {
        this.pendingLoads.delete(url);
        if (err.name === 'AbortError') {
          onAbort?.(url, err);
        } else {
          onError?.(url, err);
        }
      });
  }

  _createTextureFromImage(image) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  }


  async _createTextureFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const tex = this._createTextureFromImage(image);
          const width = image.naturalWidth;
          const height = image.naturalHeight;
          URL.revokeObjectURL(image.src);
          resolve([tex, width, height]);
        } catch (err) {
          reject(err);
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(image.src);
        reject(new Error("Failed to load image from blob"));
      };
      image.src = URL.createObjectURL(blob);
    });
  }

  _insertIntoCache(url, texture, size, onEvict) {
    this._evictIfNeeded(size, onEvict);

    this.textureCache.set(url, {
      texture,
      size,
      lastUsed: performance.now()
    });
    this.totalMemory += size;
  }

  _evictIfNeeded(incomingSize, onEvict) {
    while (this.totalMemory + incomingSize > this.maxMemory && this.textureCache.size > 0) {
      // Find LRU entry
      let oldestUrl = null;
      let oldestTime = Infinity;

      for (const [url, entry] of this.textureCache.entries()) {
        if (entry.lastUsed < oldestTime) {
          oldestUrl = url;
          oldestTime = entry.lastUsed;
        }
      }

      if (oldestUrl) {
        const entry = this.textureCache.get(oldestUrl);
        this.gl.deleteTexture(entry.texture);
        this.totalMemory -= entry.size;
        this.textureCache.delete(oldestUrl);
        onEvict?.(oldestUrl, entry.texture);
      } else {
        break;
      }
    }
  }

  isPending(url) {
    return url && this.pendingLoads.has(url);
  }

  markUsed(url) {
    const entry = this.textureCache.get(url);
    if (entry) entry.lastUsed = performance.now();
  }

  abort(url) {
    const entry = this.pendingLoads.get(url);
    if (entry) {
      entry.controller.abort();
      this.pendingLoads.delete(url);
    }
  }

  abortUrlsExcept(urls) {
    let remainingPendingLoads = new Map();
    urls.forEach((excludedUrl) => {
      this._pendingLoads.forEach((controller, url) => {
        if(url != excludedUrl) {
          controller.abort();
        }
        else {
          remainingPendingLoads.set(url, controller);
        }
      });
    });
    this._pendingLoads = remainingPendingLoads;
  }

  clearCache() {
    for (const entry of this.textureCache.values()) {
      this.gl.deleteTexture(entry.texture);
    }
    this.textureCache.clear();
    this.pendingLoads.clear();
    this.totalMemory = 0;
  }
}
