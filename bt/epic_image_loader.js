import gNasaEpicAPI from './epic_api.js';
import { TextureLoader} from './texture_loader.js';
import { gCalcLatLonNorthRotationMatrix} from './utils.js';

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2');

class EpicImageLoader
{
    #MAX_IMAGES=100;
    #textureLoader = new TextureLoader(gl, {
            maxGPUMemoryBytes: this.#MAX_IMAGES * 2048 * 2048 * 4 // 1.6GB
        });
    epicImageDataMap = new Map(); 

    async loadImage(epicImageData) {
        const timeSec = epicImageData.timeSec;
        const foundEpicImageData = this.epicImageDataMap.get(timeSec);
        if (foundEpicImageData !== epicImageData) {
            this.epicImageDataMap.set(timeSec, epicImageData);
            this._completeEpicMetadata(epicImageData);
        }

        return new Promise((resolve, reject) => {
            const url = gNasaEpicAPI.getEpicImageURL(epicImageData.date, epicImageData.image);
            if (!epicImageData.texture && !this.#textureLoader.isPending(url))
            {
                //console.log("Loading image URL: " + url);
                epicImageData.imageURL = url;
                this.#textureLoader.loadTexture(url, {
                    forceReload: false,
                    onSuccess: (url, tex) => {
                        epicImageData.texture = tex;
                        console.log("Loaded image: " + epicImageData.image + ", for date " + epicImageData.date);
                        resolve(tex);
                    },
                    onError: (url, err) => {
                        console.error('Error loading texture for image ' + imageName + ', ' + err); 
                        reject(err);},
                    onAbort: (url, err) => {
                        const error = 'Aborted loading texture for image ' + imageName + ', ' + err;
                        console.warn(error); 
                        reject(error);},
                    onEvict: (url, tex) => {
                        epicImageData.texture = null;
                        console.warn("Evicted image: " + epicImageData.image + ", for date " + epicImageData.date);}
                });
            }
            else if (epicImageData.texture)
            {
                //console.log("Using cached image URL: " + url);
                resolve(epicImageData.texture);
            }
            else
            {
                console.warn("Epic image already currently loading: " + url);
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

    abortLoad(epicImageData) {
        if (!epicImageData)
        {
            return;
        }
        if (!epicImageData.imageURL)
        {
            console.error("Undefined URL for EPIC image data " + epicImageData.date);
            return;
        }
        this.#textureLoader.abort(epicImageData.imageURL);
    }

    abortEpicImageLoadsExcept(epicImageDataArray) {
        let urls = [];
        epicImageDataArray.forEach((epicImageData) => {
            if (epicImageData && epicImageData.imageURL)
                urls.push(epicImageData.imageURL);
        });
        this.#textureLoader.abortUrlsExcept(urls);
    }

    _calcEarthRadiusFromDistance(distance)
    {
        // Magic from SM
        return ((1024-158) / 1024) * (1386540) / distance;
    }

    _completeEpicMetadata(epicImageData)
    {
        const dx = epicImageData.dscovr_j2000_position.x;
        const dy = epicImageData.dscovr_j2000_position.y;
        const dz = epicImageData.dscovr_j2000_position.z;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        epicImageData.earthRadius = this._calcEarthRadiusFromDistance(distance);
        epicImageData.centroid_matrix = gCalcLatLonNorthRotationMatrix(
            epicImageData.centroid_coordinates.lat, 
            epicImageData.centroid_coordinates.lon);
    }

}

const gEpicImageLoader = new EpicImageLoader();
export default gEpicImageLoader;
