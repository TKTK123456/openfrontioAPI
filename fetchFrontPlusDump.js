/**
 * Fetch game IDs from frontplus.io
 * @param {number} timezoneOffset - Target timezone offset in hours (e.g., +1)
 * @param {Object} [options] - Optional settings
 * @param {string|Date} [options.date] - Date to fetch (YYYY-MM-DD or Date object), defaults to today
 * @param {string} [options.startTime] - Optional start time filter, format "HH:MM:SS"
 * @param {string} [options.endTime] - Optional end time filter, format "HH:MM:SS"
 * @returns {Promise<Array<string>>} Array of game_ids matching criteria
 */
async function fetchGameIds(timezoneOffset, options = {}) {
  const { date = new Date(), startTime, endTime } = options;

  // Ensure date is a Date object
  const targetDate = typeof date === "string" ? new Date(date) : date;

  // Local timezone offset in hours
  const localOffset = -targetDate.getTimezoneOffset() / 60;

  // Difference to target timezone
  const offsetDiff = timezoneOffset - localOffset;

  // Shift date to target timezone
  const shiftedDate = new Date(targetDate.getTime() + offsetDiff * 60 * 60 * 1000);

  // Format YYYY-MM-DD
  const year = shiftedDate.getFullYear();
  const month = String(shiftedDate.getMonth() + 1).padStart(2, '0');
  const day = String(shiftedDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const url = `https://frontplus.io/json/game_ids/${dateStr}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    // Convert all dates to target timezone
    const mapped = data.map(entry => {
      const entryDate = new Date(entry.date);
      const adjusted = new Date(entryDate.getTime() + offsetDiff * 60 * 60 * 1000);
      return { ...entry, date: adjusted };
    });

    // Filter by time if startTime/endTime provided
    const filtered = mapped.filter(entry => {
      if (!startTime && !endTime) return true;
      const timeStr = entry.date.toTimeString().split(' ')[0]; // HH:MM:SS
      if (startTime && timeStr < startTime) return false;
      if (endTime && timeStr > endTime) return false;
      return true;
    });

    // Return only game_ids
    return filtered.map(entry => entry.game_id);

  } catch (err) {
    console.error('Failed to fetch game IDs:', err);
    return [];
  }
}

// Usage examples:

// UTC+1, default today
fetchGameIds(1).then(ids => console.log(ids));

// UTC+1, specific date and time filter
fetchGameIds(1, {
  date: '2025-08-12',
  startTime: '12:00:00',
  endTime: '14:00:00'
}).then(ids => console.log(ids));
