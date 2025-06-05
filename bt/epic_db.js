import SortedMap from "./sorted_map.js";
import EpicDataLoader from "./epic_data_loader.js";
import EpicImageLoader from "./epic_image_loader.js";
import gEpicAPI from './epic_api.js';

import { 
    gCalcEarthRadiusFromDistance, 
    gCalcLatLonNorthRotationMatrix, 
    gArrayBoundIndices, 
    gGetPrevDateStr, 
    gGetNextDateStr} from './utils.js';
import { gControlState } from "./controlparams.js";

export default class EpicDB { 
    _epicDays = new SortedMap(); // Map of epic days by date string
    _epicFirstDay = undefined;
    _epicLastDay = undefined;
    _epicOldestTimeSec = undefined;
    _epicLatestTimeSec = undefined;
    _ready = false;
    #epicDataLoader = new EpicDataLoader();
    #epicImageLoader = new EpicImageLoader();
    async init() 
    {
        return new Promise((resolve, reject) => {
            this.#epicImageLoader.init()
            .then(() => {
                return this.#epicDataLoader.loadEpicAvailableDays()
            })
            .then((all_days1) => {
                if (!all_days1 || all_days1.length === 0) {
                    // Something is corrupted - better to clear the cache and reject
                    this.#epicDataLoader.clearCache();
                    reject("No available days found in EPIC DB");
                    return;
                }
                for (let i = 0; i < all_days1.length; i++) {
                    this._epicDays.set(gEpicAPI.getAvailableDateFromIndex(all_days1, i), null); // Initialize with empty values
                }
                this._epicLastDay = gEpicAPI.getAvailableDateFromIndex(all_days1, 0);
                console.log("Last available day from EPIC: " + this._epicLastDay);
                this._epicFirstDay = gEpicAPI.getAvailableDateFromIndex(all_days1, all_days1.length-1);
                this._loadEpicDay(this._epicLastDay)
                .then((lastDayData) => {
                    const lastEpicData = lastDayData[lastDayData.length - 1];
                    this._epicLatestTimeSec = lastEpicData.timeSec;
                    console.log("Latest available data from EPIC: " + lastEpicData.date + ", timeSec=" + this._epicLatestTimeSec);
                    this._ready = true; // enough to get the latest
                    resolve();        
                })
                .catch((error) => {
                    reject("Failed to load last day " + this._epicLastDay + " :" + error)
                });
                this._loadEpicDay(this._epicFirstDay)
                .then((firstDayData) => {
                    const firstEpicData = firstDayData[0];
                    this._epicOldestTimeSec = firstEpicData.timeSec;
                    console.log("Oldest available data from EPIC: " + firstEpicData.date + ", timeSec=" + this._epicOldestTimeSec);
                })
                .catch((error) => {
                    console.warn("Failed to load first day " + this._epicLastDay + " :" + error)
                    return;
                });
            })
            .catch((error) => {
                reject("Failed to load available days: " + error)
            });
        });
    }

    isReady() {return this._ready;}
    getFirstDay() {return this._epicFirstDay;}
    getLastDay() {return this._epicLastDay;}
    isDayAvailable(dayStr) {
        return this._epicDays.has(dayStr);
    }
    getOldestEpicImageTimeSec() {return this._epicOldestTimeSec;}
    getLatestEpicImageTimeSec() {return this._epicLatestTimeSec;}
    static getTimeSecFromDateTimeString(dateTimeStr) {return (new Date(dateTimeStr + "Z")).getTime() / 1000;}
    static getDayStrFromTimeSec(timeSec) {
        const date = new Date(timeSec * 1000);
        const dateStr = date.toISOString().split('T')[0];
        return dateStr; // YYYY-MM-DD format
    }

    getEpicDataForTimeSec(timeSec)
    {
        const dayStr = EpicDB.getDayStrFromTimeSec(timeSec);
        if (!this._epicDays.has(dayStr)) {
            return null; // No data for this day
        }
        const epicDayData = this._epicDays.get(dayStr);
        if (!epicDayData || epicDayData.length === 0) {
            return null; // No data for this day
        }
        // Check if there is an epic image for the given timeSec
        const epicImageData = epicDayData.find((epicImage) => {
            return epicImage.timeSec === timeSec;
        });
        return epicImageData;
    }

    hasEpicDataForTimeSec(timeSec)
    {
        return !!this.getEpicDataForTimeSec(timeSec);
    }

    isTimeSecFirstOfDay(timeSec) {
        // Check if the given timeSec is the first epic image of the day
        const dayStr = EpicDB.getDayStrFromTimeSec(timeSec);
        if (!this._epicDays.has(dayStr)) {
            return false; // No data for this day
        }
        const epicDayData = this._epicDays.get(dayStr);
        if (!epicDayData || epicDayData.length === 0) {
            return false; // No data for this day
        }
        // Check if the first epic image of the day matches the given timeSec
        return timeSec <= epicDayData[0].timeSec;
    }
    
    isTimeSecLastOfDay(timeSec) {
        // Check if the given timeSec is the last epic image of the day
        const dayStr = EpicDB.getDayStrFromTimeSec(timeSec);
        if (!this._epicDays.has(dayStr)) {
            return false; // No data for this day
        }
        const epicDayData = this._epicDays.get(dayStr);
        if (!epicDayData || epicDayData.length === 0) {
            return false; // No data for this day
        }
        // Check if the last epic image of the day matches the given timeSec
        return timeSec >= epicDayData[epicDayData.length - 1].timeSec;
    }
    
    _getPrevEpicImage(timeSec, strict = true) {
        const dayStr = EpicDB.getDayStrFromTimeSec(timeSec);
        if (!this._epicDays.has(dayStr)) {
            return null; // No data for this day
        }
        const epicDayData = this._epicDays.get(dayStr);
        if (!epicDayData || epicDayData.loading || epicDayData.length === 0) {
            return null; // No data for this day
        }

        // Find the last epic image before the given timeSec
        // turn into array of timeSec
        const epicDayTimeSecArray = epicDayData.map((epicImageData) => epicImageData.timeSec);
        const [i_prev, ] = gArrayBoundIndices(epicDayTimeSecArray, timeSec, strict);
        console.assert(i_prev < epicDayData.length, "i_prev should be < epicDayData.length, but got: " + i_prev);
        if (i_prev >= epicDayData.length) {
            return null; // No prev image found
        }
        if (i_prev >= 0) {
            return epicDayData[i_prev];
        }
        // If we are here, it means we reached the beginning of the day data, so go for prev day
        const prevDayStr = gGetPrevDateStr(dayStr);
        if (!this._epicDays.has(prevDayStr)) {
            return null; // No data for the prev day
        }
        const prevEpicDayData = this._epicDays.get(prevDayStr);
        if (!prevEpicDayData || prevEpicDayData.loading || prevEpicDayData.length === 0) {
            return null; // No data for the prev day
        }
        // Find the last epic image in the prev day data
        return prevEpicDayData[prevEpicDayData.length - 1]; // Last image of the prev day        
    }

    _getNextEpicImage(timeSec, strict = false) {
        const dayStr = EpicDB.getDayStrFromTimeSec(timeSec);
        if (!this._epicDays.has(dayStr)) {
            return null; // No data for this day
        }
        const epicDayData = this._epicDays.get(dayStr);
        if (!epicDayData || epicDayData.loading || epicDayData.length === 0) {
            return null; // No data for this day
        }
        // Find the first epic image after the given timeSec
        // turn into array of timeSec
        const epicDayTimeSecArray = epicDayData.map((epicImageData) => epicImageData.timeSec);
        const [, i_next] = gArrayBoundIndices(epicDayTimeSecArray, timeSec, strict);
        console.assert(i_next >= 0, "i_next should be >= 0, but got: " + i_next);
        if (i_next < 0) {
            return null; // No next image found
        }
        if (i_next < epicDayData.length) {
            return epicDayData[i_next];
        }
        // If we are here, it means we reached the end of the day data, so go for next day
        const nextDayStr = gGetNextDateStr(dayStr);
        if (!this._epicDays.has(nextDayStr)) {
            return null; // No data for the next day
        }
        const nextEpicDayData = this._epicDays.get(nextDayStr);
        if (!nextEpicDayData || nextEpicDayData.loading || nextEpicDayData.length === 0) {
            return null; // No data for the next day
        }
        // Find the first epic image in the next day data
        return nextEpicDayData[0]; // First image of the next day        
    }

    _getMixFactor(epicImageDataKey0, epicImageDataKey1, timeSec) {
        // Calculate the mix factor based on the timeSec and the key frames
        if (!epicImageDataKey0 || !epicImageDataKey1) {
            return 0;
        }
        const totalTime = epicImageDataKey1.timeSec - epicImageDataKeyKey0.timeSec;
        if (totalTime <= 0) {
            return 0;
        }
        return (timeSec - epicImageDataKey0.timeSec) / totalTime;
    }

    _loadEpicDay(dayStr, callback) {
        return new Promise((resolve, reject) => {
            if (!this._epicDays.has(dayStr)) {
                reject("Day " + dayStr + " is not available in EPIC DB");
                return;
            }
            const epicDayData = this._epicDays.get(dayStr);
            if (epicDayData && !epicDayData.loading && epicDayData.length > 0) {
                // Already loaded
                callback?.(epicDayData);
                resolve(epicDayData);
                return;
            }

            console.log("Loading EPIC data for day " + dayStr);
            this._epicDays.set(dayStr, { loading: true }); // Mark as loading
            this.#epicDataLoader.loadEpicDay(dayStr)
            .then((epicDayData) => {
                if (!epicDayData || epicDayData.length === 0) {
                    // Something is corrupted - better to clear the cache and reject
                    this.#epicDataLoader.clearCache();
                    reject("Epic day data not found for: " + dayStr);
                    return;
                }
                if (epicDayData.loading) {
                    reject("Epic day data already loading for: " + dayStr);
                    return;
                }
                this._epicDays.set(dayStr, epicDayData);
                epicDayData.forEach((epicImageData) => {
                    this._completeEpicMetadata(epicImageData);
                });
                callback?.(epicDayData);
                resolve(epicDayData);
            })
            .catch((error) => {
                this._epicDays.delete(dayStr); // Remove from map
                reject("Error loading epic day: " + error);
            });
        });
    }

    _completeEpicMetadata(epicImageData)
    {
        epicImageData.timeSec = EpicDB.getTimeSecFromDateTimeString(epicImageData.date);
        const dx = epicImageData.dscovr_j2000_position.x;
        const dy = epicImageData.dscovr_j2000_position.y;
        const dz = epicImageData.dscovr_j2000_position.z;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        epicImageData.earthRadius = gCalcEarthRadiusFromDistance(distance);
        epicImageData.centroid_matrix = gCalcLatLonNorthRotationMatrix(
            epicImageData.centroid_coordinates.lat, 
            epicImageData.centroid_coordinates.lon);
    }

    _abortLoadingDaysExcept(days, reason) {
        // Abort loading of days that are not in the given list
        this.#epicDataLoader.abortEpicDayLoadsExcept(days, reason);
    }
    
    _abortLoadingImagesExcept(epicImageDataArray, reason) {
        // Abort loading of images that are not in the given list
        this.#epicImageLoader.abortEpicImageLoadsExcept(epicImageDataArray, reason);
    }

    _loadImage(epicImageData, callback) {
        if (!epicImageData)
        {
            return;
        }

        if (epicImageData.texture) {
            // Already loaded
            callback?.();
            return;
        } 
        if (epicImageData.textureLoading) {
            // Already loading
            return;
        } 

        // Load the image for the given epicImageData
        epicImageData.textureLoading = true;
        this.#epicImageLoader.loadImage(epicImageData)
        .then((tex) => {
            epicImageData.textureLoading = false;
            if(!tex)
                return; // resolved with null, probably aborted
            callback?.();
        })
        .catch((error) => {
            console.error("Error loading epic image. Error msg: ", error);
            epicImageData.textureLoading = false;
            this._abortLoadingImagesExcept([], "Aborted all loading after error");
        });
    }

    async _predictAndLoadFrames(timeSec) {
        // Predict and load frames based on the given timeSec and timeSpeed
        // This is a heuristic to load frames around the given time
        let numLoadedForward = 0;
        if (gControlState.play) {
            // Preload frames for the coming 10s
            const TIME_PREDICT_SEC = 10;
            let nextTime = timeSec
            for (let i = 1; i <= TIME_PREDICT_SEC; i++) {
                nextTime += i * gControlState.timeSpeed;
                if (nextTime > this._epicLatestTimeSec) {
                    nextTime = this._epicLatestTimeSec - gControlState.loopRangeSec;
                    break;
                }
                try {
                    const [epicImageData0, epicImageData1] = await this.fetchBoundKeyFrames(nextTime);
                    if (!epicImageData0.texture && !epicImageData0.textureLoading) {
                        await this._loadImage(epicImageData0);
                        numLoadedForward++;
                    }
                    if (!epicImageData1.texture && !epicImageData1.textureLoading) {
                        await this._loadImage(epicImageData1);
                        numLoadedForward++;
                    }
                }
                catch (error) {
                    console.warn("Failed preloading epic images around timeSec " + nextTime + ": ", error);
                    // If we fail to load, we can just stop preloading
                    break;
                }
            }
        }
        if (numLoadedForward > 0) {
            console.log("Preloaded (for play) " + numLoadedForward + " epic images forward from timeSec " + timeSec);
        }
        const numLoadedForwardForPlay = numLoadedForward;
        let numLoadedBackward = 0;
        try
        {
            // Preload frames around the given timeSec
            let [epicImageData0, epicImageData1] = await this.fetchBoundKeyFrames(timeSec);
            const SCROLL_PREDICT_NUM_FRAMES = 10;
            for (let i = 1; i <= SCROLL_PREDICT_NUM_FRAMES; i++) {
                if (epicImageData1 && numLoadedForward < SCROLL_PREDICT_NUM_FRAMES)
                {
                    const timeSec = epicImageData1.timeSec;
                    epicImageData1 = this._getNextEpicImage(timeSec, true);
                    if (!epicImageData1)
                        await this.fetchBoundKeyFrames(timeSec);
                    epicImageData1 = this._getNextEpicImage(timeSec, true);
                    if (epicImageData1 && !epicImageData1.texture && !epicImageData1.textureLoading) {
                        await this._loadImage(epicImageData1);
                        numLoadedForward++;
                    }
                }
                if (epicImageData0)
                {
                    const timeSec = epicImageData0.timeSec;
                    epicImageData0 = this._getPrevEpicImage(timeSec, true);
                    if (!epicImageData0)
                        await this.fetchBoundKeyFrames(timeSec);
                    epicImageData0 = this._getPrevEpicImage(timeSec, true);
                    if (epicImageData0 && !epicImageData0.texture && !epicImageData0.textureLoading) {
                        await this._loadImage(epicImageData0);
                        numLoadedBackward++;
                    }
                }
            }
        }
        catch (error) {
            console.warn("Failed preloading epic images before timeSec " + timeSec + ": ", error);
            // If we fail to load, we can just stop preloading
        }
        if (numLoadedForward > numLoadedForwardForPlay) {
            console.log("Preloaded (for scroll) " + (numLoadedForward - numLoadedForwardForPlay) + " more epic images forward from timeSec " + timeSec);
        }
        if (numLoadedBackward > 0) {
            console.log("Preloaded (for scroll) " + numLoadedBackward + " epic images backward from timeSec " + timeSec);
        }
    }

    getBoundKeyFrames(timeSec) {
        // Get the bound key frames for the given timeSec
        // This will return the previous and next key frames around the given timeSec
        const epicImageDataKey0 = this._getPrevEpicImage(timeSec, true);
        const epicImageDataKey1 = this._getNextEpicImage(timeSec, false);
        return [epicImageDataKey0, epicImageDataKey1];
    }

    // return a promise with (epicImageDataKey0, epicImageDataKey1), 
    // 1. aborts loading of days that are not needed anymore, based on the current timeSec and timeSpeed
    // 2. Loads the day data for the given date
    // 3. Loads the next day data if necessary in order to get the upper bound frame
    // 4. Loads the previous day data if necessary in order to get the lower bound frame
    // 5. aborts loading of frames that are not the bound key frames
    // 6. Loads the images for the bound key frames
    // 7. predict and load epic frames to be loaded around the given timeSec, with a heuristic based on given time speed
    // 8. returns the key frames, the interpolated frame, and the mix factor for the given timeSec
    // Load the bound key frames for the given timeSec
    async fetchBoundKeyFrames(timeSec) 
    {
        return new Promise((resolve, reject) => {
            let [epicImageDataKey0, epicImageDataKey1] = this.getBoundKeyFrames(timeSec);
            if (epicImageDataKey0 && epicImageDataKey1)
            {
                // If both frames are already loaded, return them
                resolve([epicImageDataKey0, epicImageDataKey1]);
                return;
            }

            // Load metadata from days around the given date
            const date = new Date(timeSec * 1000);
            const dayStr = date.toISOString().slice(0, 10);
            const prevDayStr = gGetPrevDateStr(dayStr);
            const nextDayStr = gGetNextDateStr(dayStr);
            this._abortLoadingDaysExcept([dayStr, prevDayStr, nextDayStr], 
                "Aborted loading days except current:" + dayStr + ", previous:" + prevDayStr + ", next:" + nextDayStr);
            
            if (!epicImageDataKey0 && !epicImageDataKey1)
            {
                this._loadEpicDay(dayStr)
                .then(() => {
                    [epicImageDataKey0, epicImageDataKey1] = this.getBoundKeyFrames(timeSec);
                    if (epicImageDataKey0 && epicImageDataKey1)
                        resolve([epicImageDataKey0, epicImageDataKey1]);
                    else
                        resolve(null); // likely aborted
                })
                .catch((error) => {
                    reject("Error loading current day " + dayStr + ": " + error);
                });
                return;
            }
            else if (!epicImageDataKey0)
            {
                this._loadEpicDay(prevDayStr)
                .then(() => {
                    [epicImageDataKey0, epicImageDataKey1] = this.getBoundKeyFrames(timeSec);
                    if (epicImageDataKey0 && epicImageDataKey1)
                        resolve([epicImageDataKey0, epicImageDataKey1]);
                    else
                        resolve(null); // likely aborted
                })
                .catch((error) => {
                    reject("Error loading previous day " + dayStr + ": " + error);
                });
                return;
            }
            else //if (!epicImageDataKey1)
            {
                this._loadEpicDay(nextDayStr)
                .then(() => {
                    [epicImageDataKey0, epicImageDataKey1] = this.getBoundKeyFrames(timeSec);
                    if (epicImageDataKey0 && epicImageDataKey1)
                        resolve([epicImageDataKey0, epicImageDataKey1]);
                    else
                        resolve(null); // likely aborted
                })
                .catch((error) => {
                    reject("Error loading next day " + dayStr + ": " + error);
                });
                return;
            }
        });
    }

    _loadTwoImages(timeSec, epicImageData0, epicImageData1) {
        if (epicImageData0 && !epicImageData0.texture)
            this._loadImage(epicImageData0, () => {loadPredictedFrames(this);});
        if (epicImageData1 && !epicImageData1.texture)
            this._loadImage(epicImageData1, () => {loadPredictedFrames(this);});
        loadPredictedFrames(this);
        function loadPredictedFrames(self) {
            if (epicImageData0 && epicImageData0.texture && 
                epicImageData1 && epicImageData1.texture) {
                // All frames loaded, now we can return the key frames
                // But first start loading based on prediction
                self._predictAndLoadFrames(timeSec);
            }
        }
    }

    // returns bound frames, with strict prev and non-strict next
    // if one missing, returns nothing
    // starts an asynchronous loading of the missing bound frames
    fetchBoundFrames(timeSec) 
    {
        if (!this._ready)
        {
            console.error("EpicDB not initialized yet");
            return null;
        }

        let epicImageDataKey1 = this._getNextEpicImage(timeSec, false);
        let epicImageDataKey0 = this._getPrevEpicImage(timeSec, false);

        if (!epicImageDataKey0 || !epicImageDataKey1) {
            this.fetchBoundKeyFrames(timeSec)
            .then((boundPair) => {
                if (!boundPair || boundPair.length !== 2) {
                    return null; // likely aborted
                }
                const [epicImageData0, epicImageData1] = boundPair;
                // All days loaded, now we can process the images
                this._abortLoadingImagesExcept([epicImageData0, epicImageData1], "Aborted loading images except bound frames around timeSec: " + timeSec);
                this._loadTwoImages(epicImageData0, epicImageData1);
            })
            .catch((error) => {
                console.error("Error fetching bound key frames: ", error);
            });
        }
        else if (epicImageDataKey0.texture && epicImageDataKey1.texture) {
            this._predictAndLoadFrames(timeSec);
            return [epicImageDataKey0, epicImageDataKey1];
        }
        else {
            // Start loading the images for the bound frames
            this._loadTwoImages(timeSec, epicImageDataKey0, epicImageDataKey1);
            return [epicImageDataKey0, epicImageDataKey1];
        }


        return null;
    }

    markUsedEpicImage(epicImageData) {
        // Mark the epic image as used, so it won't be removed from the cache
        if (epicImageData && epicImageData.texture) {
            this.#epicImageLoader.markUsed(epicImageData);
        }
    }
}
