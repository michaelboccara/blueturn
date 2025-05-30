import SortedMap from "./sorted_map.js";
import gNasaEpicAPI from "./epic_api.js"
import gEpicDataLoader from "./epic_data_loader.js";
import gEpicImageLoader from "./epic_image_loader.js";

export default class EpicDB { 
    _epicDays = new SortedMap(); // Map of epic days by date string
    _epicImages = new SortedMap(); // Map of epic images by time
    _epicFirstDay = undefined;
    _epicLastDay = undefined;
    _epicOldestTimeSec = undefined;
    _epicLatestTimeSec = undefined;
    _ready = false;

    async init() 
    {
        return new Promise((resolve, reject) => {
            gEpicDataLoader.loadEpicAvailableDays()
            .then((all_days1) => {
                all_days1.forEach((day) => {
                    this._epicDays.set(day.date, null);
                }); 
                this._epicLastDay = all_days1[0].date;
                console.log("Last available day from EPIC: " + this._epicLastDay);
                this._epicFirstDay = all_days1[all_days1.length-1].date;
                this._loadEpicDay(this._epicLastDay)
                .then(() => {
                    const lastDayData = this._epicDays.get(this._epicLastDay);
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
                .then(() => {
                    const firstDayData = this._epicDays.get(this._epicFirstDay);
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
    getOldestEpicImageTimeSec() {return this._epicOldestTimeSec;}
    getLatestEpicImageTimeSec() {return this._epicLatestTimeSec;}
    static getTimeSecFromDateTimeString(dateTimeStr) {return (new Date(dateTimeStr)).getTime() / 1000;}

    hasEpicDataForTimeSec(timeSec)
    {
        return this._epicImages.has(timeSec);
    }

    _getPrevEpicImage(timeSec, strict = true) {
        // Find the latest epic image before the given time
        const [epicImageDataEntry, ] = this._epicImages.boundEntries(timeSec);
        return epicImageDataEntry ? epicImageDataEntry[1] : null;
    }

    _getNextEpicImage(timeSec, strict = false) {
        const [, epicImageDataEntry] = this._epicImages.boundEntries(timeSec);
        return epicImageDataEntry ? epicImageDataEntry[1] : null;
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
            if (this._epicDays.get(dayStr)) {
                // Already loaded
                callback?.();
                resolve();
                return;
            }

            console.log("Loading EPIC data for day " + dayStr);
            this._epicDays.set(dayStr, { loading: true }); // Mark as loading
            gEpicDataLoader.loadEpicDay(dayStr)
            .then((epicDayData) => {
                if (!epicDayData) {
                    reject("Epic day data not found for: " + dayStr);
                    return;
                }
                epicDayData.epicDayData = epicDayData;
                epicDayData.loading = false; // Mark as loaded
                this._epicDays.set(dayStr, epicDayData);
                epicDayData.forEach((epicImageData) => {
                    this._addKeyFrame(epicImageData);
                });
                callback?.();
                resolve();
            })
            .catch((error) => {
                this._epicDays.delete(dayStr); // Remove from map
                reject("Error loading epic day: " + error);
            });
        });
    }

    _abortLoadingDaysExcept(days) {
        // Abort loading of days that are not in the given list
        gEpicDataLoader.abortEpicDayLoadsExcept(days);
    }
    
    _abortLoadingImagesExcept(epicImageDataArray) {
        // Abort loading of images that are not in the given list
        gEpicImageLoader.abortEpicImageLoadsExcept(epicImageDataArray);
    }

    _loadImage(epicImageData, callback) {
        console.assert(epicImageData);
        if (epicImageData.texture) {
            // Already loaded
            callback?.();
        } if (epicImageData.textureLoading) {
            // Already loading
            return;
        } else {
            // Load the image for the given epicImageData
            epicImageData.textureLoading = true;
            gEpicImageLoader.loadImage(epicImageData)
            .then(() => {
                callback?.();
                epicImageData.textureLoading = false;
            })
            .catch((error) => {
                console.error("Error loading epic image: ", error);
                epicImageData.textureLoading = false;
            });
        }
    }

    _predictAndLoadFrames(timeSec, timeSpeed) {
        // Predict and load frames based on the given timeSec and timeSpeed
        // This is a heuristic to load frames around the given time
        const predictionTimeSec = timeSec + timeSpeed * 60; // Predict next frame based on time speed
        const epicImageData = this._getPrevEpicImage(predictionTimeSec);
        if (epicImageData) {
            this._loadImage(epicImageData);
        }
    }

    _addKeyFrame(epicImageData)
    {
        epicImageData.timeSec = EpicDB.getTimeSecFromDateTimeString(epicImageData.date);
        this._epicImages.set(epicImageData.timeSec, epicImageData);
    }
    // Load the next key frames after the given timeSec
    // strict: exclude same frame
    async _loadNextKeyFrame(timeSec, strict = false) 
    {
        return new Promise((resolve, reject) => {
            const date = new Date(timeSec * 1000);
            // Make sure we loaded data for given day
            // (otherwise next may be in a future day)
            const dayStr = date.toISOString().slice(0, 10);
            this._loadEpicDay(dayStr)
            .then(() => {
                // Is the next frame in current day?
                const epicImageDataKey = this._getNextEpicImage(timeSec, strict);
                if (epicImageDataKey) {
                    resolve(epicImageDataKey);
                    return;
                }
                // If not in current day, load the next day
                const nextDayStr = gNasaEpicAPI.getNextDateStr(dayStr);
                if (!this._epicDays.has(nextDayStr))
                {
                    console.warn("No data available for next day " + nextDayStr);
                    resolve(null);
                }
                return this._loadEpicDay(nextDayStr);
            })
            .then(() => {
                // Is the next frame in next day?
                const epicImageDataKey = this._getNextEpicImage(timeSec, strict);
                if (epicImageDataKey) {
                    // we can assert that it is the first item of the day
                    resolve(epicImageDataKey);
                    return;
                }
                reject("Epic next day for timeSec=" + timeSec + " not found");
                return;
            })
            .catch((error) => {
                reject("Failed to load Epic next day for timeSec=" + timeSec + ": " + error);
                return;
            });
        });
    }

    // Load the prev key frames, before the given timeSec
    // strict: exclude same frame
    async _loadPrevKeyFrame(timeSec, strict = false) 
    {
        let prevDayStr;
        return new Promise((resolve, reject) => {
            const date = new Date(timeSec * 1000);
            // Make sure we loaded data for given day
            // (otherwise prev may be in a past day)
            const dayStr = date.toISOString().slice(0, 10);
            this._loadEpicDay(dayStr)
            .then(() => {
                // Is the prev frame in current day?
                const epicImageDataKey = this._getPrevEpicImage(timeSec, strict);
                if (epicImageDataKey) {
                    resolve(epicImageDataKey);
                    return;
                }
                // If not in current day, load the prev day
                prevDayStr = gNasaEpicAPI.getPrevDateStr(dayStr);
                if (!this._epicDays.has(prevDayStr))
                {
                    console.warn("No data available for prev day " + nextDayStr);
                    resolve(null);
                }
                return this._loadEpicDay(prevDayStr);
            })
            .then(() => {
                // Is the prev frame in prev day?
                const epicImageDataKey = this._getPrevEpicImage(timeSec, strict);
                if (epicImageDataKey) {
                    // we can assert that it is the first item of the day
                    resolve(epicImageDataKey);
                    return;
                }
                reject("Epic prev image for timeSec=" + timeSec + " is null in day " + prevDayStr);
                return;
            })
            .catch((error) => {
                reject("Failed to load Epic prev key frame for timeSec=" + timeSec + ": " + error);
                return;
            });
        });
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
            let epicImageDataKey1 = this._getNextEpicImage(timeSec, false);
            let epicImageDataKey0 = this._getPrevEpicImage(timeSec, false);
            if (epicImageDataKey0 && epicImageDataKey1)
            {
                // If both frames are already loaded, return them
                resolve([epicImageDataKey0, epicImageDataKey1]);
                return;
            }

            // Load metadata from days around the given date
            const date = new Date(timeSec * 1000);
            const dayStr = date.toISOString().slice(0, 10);
            const prevDayStr = gNasaEpicAPI.getPrevDateStr(dayStr);
            const nextDayStr = gNasaEpicAPI.getNextDateStr(dayStr);
            this._abortLoadingDaysExcept([dayStr, prevDayStr, nextDayStr]);
            
            if (!epicImageDataKey1)
            {
                this._loadNextKeyFrame(timeSec)
                .then((epicImageDataKey) => {
                    epicImageDataKey1 = epicImageDataKey;
                    if (epicImageDataKey0)
                        resolve([epicImageDataKey0, epicImageDataKey1]);
                })
                .catch((error) => {
                    reject("Error loading bound key frames: " + error);
                });
            }

            if (!epicImageDataKey0)
            {
                this._loadPrevKeyFrame(timeSec)
                .then((epicImageDataKey) => {
                    epicImageDataKey0 = epicImageDataKey;
                    if (epicImageDataKey1)
                        resolve([epicImageDataKey0, epicImageDataKey1]);
                })
                .catch((error) => {
                    reject("Error loading bound key frames: " + error);
                });
            }
        });
    }


    // returns bound frames, with strict prev and non-strict next
    // if one missing, returns nothing
    // starts an asynchronous loading of the missing bound frames
    fetchBoundFrames(timeSec, timeSpeed = 0) 
    {
        if (!this._ready)
        {
            console.error("EpicDB not initialized yet");
            return null;
        }
        let epicImageDataKey1 = this._getNextEpicImage(timeSec, false);
        let epicImageDataKey0 = this._getPrevEpicImage(timeSec, false);
        if (epicImageDataKey0 && epicImageDataKey0.texture &&
            epicImageDataKey1 && epicImageDataKey1.texture) {
            return [epicImageDataKey0, epicImageDataKey1];
        }
        this.fetchBoundKeyFrames(timeSec)
        .then(([epicImageData0, epicImageData1]) => {
            // All days loaded, now we can process the images
            this._abortLoadingImagesExcept([epicImageData0, epicImageData1]);
            if (epicImageData0)
                this._loadImage(epicImageData0, () => {loadPredictedFrames(this);});
            if (epicImageData1)
                this._loadImage(epicImageData1, () => {loadPredictedFrames(this);});
            function loadPredictedFrames(self) {
                if (epicImageData0 && epicImageData0.texture && 
                    epicImageData1 && epicImageData1.texture) {
                    // All frames loaded, now we can return the key frames
                    // But first start loading based on prediction
                    self._predictAndLoadFrames(timeSec, timeSpeed);
                }
            }
        })
        .catch((error) => {
            console.error("Error fetching bound key frames: ", error);
        });
        return null;
    }
}
