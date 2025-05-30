// © 2025 Blueturn - Michael Boccara. 
// Licensed under CC BY-NC-SA 4.0.
// See https://creativecommons.org/licenses/by-nc-sa/4.0/

function getEndOfDayMidnight(date = new Date()) {
  const nextDay = new Date(date);
  nextDay.setUTCHours(0, 0, 0, 0); // reset to start of current day
  nextDay.setDate(nextDay.getDate() + 1); // move to start of next day
  return nextDay;
}

function getStartOfDayMidnight(date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  return startOfDay;
}


