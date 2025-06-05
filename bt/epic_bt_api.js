export default class BtEpicAPI 
{
    _EPIC_IMAGES_S3_URL = "https://storage.googleapis.com/content.blueturn.earth/images/";
    _EPIC_IMAGES_CDN_URL = "https://content.blueturn.earth/images/";
    _IMAGE_FORMAT = 'jpg';
    _NO_CACHE = false;

    constructor(useCDN = false, noCache = false)
    {
        this._EPIC_IMAGES_URL = useCDN ? this._EPIC_IMAGES_CDN_URL : this._EPIC_IMAGES_S3_URL;
        this._NO_CACHE = noCache;
    }

    _getNoiseQueryString()
    {
        return "&noise=" + Math.floor(Date.now() / 1000);
    }

    isUsingCache()
    {
        return !this._NO_CACHE;
    }

    getEpicCallURL(call)
    {
        return this._EPIC_IMAGES_URL + call;
    }

    getEpicCallURLSecretQuery(nocache = false)
    {
        const noiseQueryStr = (!nocache && !this._NO_CACHE) ? this._getNoiseQueryString() : "";
        return noiseQueryStr;
    }

    getEpicAvailableDaysCall()
    {
        return 'available_dates.json';
    }

    // Date format: e.g., "2025-04-26"

    getEpicDayCall(date = _todayDatesStr)
    {
        return 'list/images_' + date + '.json';
    };

    getEpicImageURL(date, imageName)
    {
        if (!date || !imageName) {
            throw new Error("Invalid date or image name");
        }
        return this._EPIC_IMAGES_URL + this._IMAGE_FORMAT + "/" + imageName + "." + this._IMAGE_FORMAT;
    }

    getAvailableDateFromIndex(allDays, i)
    {
        return allDays[allDays.length - i - 1];
    }
}
