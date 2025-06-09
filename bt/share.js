import { gControlState, gControlMap } from './controlparams.js';
import { gEpicTimeSec } from './app.js';
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
    const day_time = gGetDateFromTimeSec(gEpicTimeSec);
    const day_time_split = day_time.split(' ');
    gControlState.day = day_time_split[0];
    gControlState.time = day_time_split[1];
    const date = new Date(gEpicTimeSec * 1000);
    const dayPretty = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timePretty = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });    
    navigator.share({
        title: document.title,
        text: "I am sharing the Whole Earth with you...\nDay: " + dayPretty + "\nTime: " + timePretty + " (UTC)\n",
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
