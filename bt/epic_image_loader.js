import gEpicAPI from './epic_api.js';
import { TextureLoader} from './texture_loader.js';

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2');

export default class EpicImageLoader
{
    #MAX_IMAGES=100;
    #textureLoader = new TextureLoader(gl, {
            maxGPUMemoryBytes: this.#MAX_IMAGES * 2048 * 2048 * 4 // 1.6GB
        });
    #url2EpicImageDataMap = new Map(); 

    async init() {
        return new Promise((resolve, reject) => {
            this.#textureLoader.init()
            .then(() => {
                //console.log("EpicImageLoader initialized");
                resolve();
            })
            .catch((err) => {
                console.error("EpicImageLoader initialization failed: " + err);
                reject(err);
            });
        });
    }

    _evictEpicImageTexture(evictedUrl) {
        const evictedEpicImageData = this.#url2EpicImageDataMap.get(evictedUrl);
        if (evictedEpicImageData)
        {
            // Remove the evicted image data from the map
            this.#url2EpicImageDataMap.delete(evictedUrl);
            evictedEpicImageData.imageURL = null;
            evictedEpicImageData.texture = null;
            // Avoid log spam
            //console.warn("Evicted image data for date: " + evictedEpicImageData.date);
        }
        else
        {
            console.error("Evicted image data not found for URL: " + evictedUrl);
        }
    }

    async loadImage(epicImageData) {
        return new Promise((resolve, reject) => {
            if (!epicImageData)
            {
                reject("epicImageData arg is not set");
                return;
            }
            const timeSec = epicImageData.timeSec;

            const url = gEpicAPI.getEpicImageURL(epicImageData.date, epicImageData.image);
            if (!epicImageData.texture && !this.#textureLoader.isPending(url))
            {
                //console.log("Loading image URL: " + url);
                epicImageData.imageURL = url;
                this.#url2EpicImageDataMap.set(url, epicImageData);
                this.#textureLoader.loadTexture(url, {
                    forceReload: false,
                    onSuccess: (url, tex) => {
                        epicImageData.texture = tex;
                        console.log("Loaded image: " + epicImageData.image + ", for date " + epicImageData.date);
                        resolve(tex);
                    },
                    onError: (url, err) => {
                        if (epicImageData && epicImageData.image)
                            console.error('Error loading texture for image ' + epicImageData.image + '. Error msg: ' + err); 
                        reject(err);
                    },
                    onAbort: (url, err) => {
                        console.warn('Aborted loading texture for image ' + epicImageData.image + ', ' + err); 
                        resolve(null);
                    },
                    onEvict: (evictedUrl, tex) => {
                        this._evictEpicImageTexture(evictedUrl);
                    }
                });
            }
            else if (epicImageData.texture)
            {
                //console.log("Using cached image URL: " + url);
                resolve(epicImageData.texture);
            }
            else
            {
                // can happen by some race condition
                //console.warn("Epic image already currently loading: " + url);
                resolve(null);
            }
        });
    }

    markUsed(epicImageData) {
        if (!epicImageData)
        {
            return;
        }
        if (!epicImageData.imageURL)
        {
            console.error("Undefined URL for EPIC image data " + epicImageData.date);
            return;
        }
        this.#textureLoader.markUsed(epicImageData.imageURL);
    }

    abortLoad(epicImageData, reason) {
        if (!epicImageData)
        {
            return;
        }
        if (!epicImageData.imageURL)
        {
            console.error("Undefined URL for EPIC image data " + epicImageData.date);
            return;
        }
        this.#textureLoader.abort(epicImageData.imageURL, reason);
    }

    abortEpicImageLoadsExcept(epicImageDataArray, reason) {
        let urls = [];
        epicImageDataArray.forEach((epicImageData) => {
            if (epicImageData && epicImageData.imageURL)
                urls.push(epicImageData.imageURL);
        });
        this.#textureLoader.abortUrlsExcept(urls, reason);
    }

}
