import gEpicAPI from './epic_api.js';
import {gGetTodayDateStr} from './utils.js';

export default class EpicDataLoader
{
    #CACHE_DATE = "";
    _pendingLoads = new Map();

    async init()
    {
        return this.loadEpicAvailableDays();
    }

    async _loadJsonCallURL(call, nocache = false)
    {
        return new Promise((resolve, reject) => {
            if (gEpicAPI.isUsingCache() && !nocache) {
                const cacheDate = localStorage.getItem(this.#CACHE_DATE);
                const cachedData = localStorage.getItem(call);
                if (cacheDate === gGetTodayDateStr() && cachedData) {
                    try {
                        //console.log("Using cached data for call \"" + call + "\"");
                        resolve(JSON.parse(cachedData));
                        return;
                    } catch (e) {
                        console.log("Error in cached data: " + e);
                        // If cached data is corrupted, we will fetch it again
                        localStorage.removeItem(call);
                        localStorage.removeItem(this.#CACHE_DATE);
                        nocache = true; // Force fetching fresh data
                        console.log("Fetching fresh data due to cache error.");
                    }
                }
            }

            let url = gEpicAPI.getEpicCallURL(call);
            const controller = new AbortController();
            const signal = controller.signal;            
            this._pendingLoads.set(call, controller);
            console.log("Loading Epic Data URL: " + url);
            url += "?" + gEpicAPI.getEpicCallURLSecretQuery(nocache)
            fetch(url, { mode: 'cors', cache: 'force-cache', signal })
            .then(response => {
                if (!response.ok) {
                    reject (new Error('Network response was not ok: ' + response.statusText));
                }
                return response.text();
            })
            .then(text => {
                if (gEpicAPI.isUsingCache() && !nocache) {
                    localStorage.setItem(this.#CACHE_DATE, gGetTodayDateStr());
                    localStorage.setItem(call, text);
                }
                this._pendingLoads.delete(call);
                resolve(JSON.parse(text));
            })
            .catch(error => {
                if (error.startsWith('Abort')) {
                    console.warn(error);
                    resolve(null); // Resolve with null if the request was aborted
                }
                else {
                    console.error('Error loading JSON from URL:', error);
                    reject(error); // rethrow to handle it in the calling code
                }
            });
        });
    }

    async loadEpicAvailableDays() {
        //console.log("Loading all available days from EPIC API...");
        return this._loadJsonCallURL(gEpicAPI.getEpicAvailableDaysCall());
    }

    async loadEpicDay(date = gGetTodayDateStr(), nocache = false) {
        console.log("Loading data for " + date + " from EPIC API...");
        return this._loadJsonCallURL(gEpicAPI.getEpicDayCall(date), nocache);
    }

    abortEpicDayLoadsExcept(days, reason) {
        let remainingPendingLoads = new Map();
        this._pendingLoads.forEach((controller, call) => {
            let doAbort = true;
            days.forEach((date) => {
                const excludedCall = gEpicAPI.getEpicDayCall(date);
                if (call === excludedCall) {
                    doAbort = false; // Do not abort the call for the excluded date
                }
            });
            if (doAbort) {
                console.log("Aborting EPIC API call: " + call + " for reason: " + reason);
                localStorage.removeItem(call);
                controller.abort(reason);
            }
            else {
                remainingPendingLoads.set(call, controller);
            }
        });
        this._pendingLoads = remainingPendingLoads;
    }

    clearCache(dayStr) {
        if (dayStr) {
            const call = gEpicAPI.getEpicDayCall(dayStr);
            localStorage.removeItem(call);
            this._pendingLoads.delete(call);
            console.log("Cleared cache for EPIC API call: " + call);
        } else {
            localStorage.removeItem(this.#CACHE_DATE);
            localStorage.clear();
            this._pendingLoads.clear();
            console.log("Cleared all EPIC API cache.");
        }
    }
};
