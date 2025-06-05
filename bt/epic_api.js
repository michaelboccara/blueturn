import { gControlState } from './controlparams.js';
import NasaEpicAPI from './epic_nasa_api.js';
import BtEpicAPI from './epic_bt_api.js';

let gEpicAPI;
switch (gControlState.source) 
{
    case 'nasa':
        console.log('Using NASA server for EPIC data');
        gEpicAPI = new NasaEpicAPI();
        break;
    case 'bt-s3':
        console.log('Using BT/S3 cloud for EPIC data');
        gEpicAPI = new BtEpicAPI(false);
        break;
    case 'bt-cdn':
        console.log('Using BT/CDN for EPIC data');
        gEpicAPI = new BtEpicAPI(true);
        break;
    default:
        console.error('Unknown EPIC API source:' + gControlState.source + ', using NASA EPIC API as default');
        break;
}

export default gEpicAPI;
