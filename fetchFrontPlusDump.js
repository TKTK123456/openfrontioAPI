async function fetchGameIdsByTimezone(targetOffset = 0) {
  const now = new Date();

  // Local timezone offset in hours (note: getTimezoneOffset returns minutes, opposite sign)
  const localOffset = -now.getTimezoneOffset() / 60;

  // Calculate difference to target timezone
  const offsetDiff = targetOffset - localOffset;

  // Shift time
  const shifted = new Date(now.getTime() + offsetDiff * 60 * 60 * 1000);

  // Format as YYYY-MM-DD
  const year = shifted.getFullYear();
  const month = String(shifted.getMonth() + 1).padStart(2, '0');
  const day = String(shifted.getDate()).padStart(2, '0');

  const dateStr = `${year}-${month}-${day}`;
  const url = `https://frontplus.io/json/game_ids/${dateStr}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Failed to fetch game IDs:', err);
    return null;
  }
}

));
dsByTimezoneon
