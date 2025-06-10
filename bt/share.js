import { gControlState, gControlMap } from './controlparams.js';
import { gDateText } from './app.js';
import { gGetDateFromTimeSec } from './utils.js';

function toSimpleString(value) {
  if (typeof value === 'string') {
    return value;          // no quotes around string
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';  // true -> "1", false -> "0"
  }
  if (typeof value === 'number') {
    return String(value);
  }
  // fallback for other types (optional)
  return JSON.stringify(value);
}

function buildURL() {
  let url = window.location.href;
  let first = true;
  gControlMap.forEach((cb, param) => {
    if (gControlState[param] !== undefined) {
        url += first ? "?" : "&";
        url += param + "=" + toSimpleString(gControlState[param]);
        first = false;
    }
  });
  return url;
}

function shareURL(url) {
    let shareText = "I am sharing the Whole Earth with you...\n";
    shareText += "Time info: " + gDateText + "\n";
    if(gControlState.zoom)
      shareText += "GPS Info: " + gControlState.zoom + "\n";
    const shareTextWithURL = shareText + url;
    console.log("Sharing this:\n" + shareTextWithURL);
    navigator.share({
        title: document.title,
        text: shareText,
        url: url
    })
    .then(() => {
        console.log('Successful share');
    })
    .catch((error) => console.log('Error sharing', error));
}

const USE_TINY_URL = false; // Set to true to use TinyURL for shorter links

export function share() {
    gControlState.play = false; // Stop playback before sharing
    if (!USE_TINY_URL) {
        shareURL(buildURL());
        return;
    }
    if (navigator.share) {
        fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(buildURL())}`)
        .then(res => res.text())
        .then(shortUrl => shareURL(shortUrl))
        .catch((error) => console.log('Error sharing', error));
    } else {
        // Fallback
        alert("Sharing not supported on this browser.");
    }
}

window.share = share;
