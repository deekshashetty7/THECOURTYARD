function toUtcDateKey(date) {
  const current = new Date(date);
  const year = current.getUTCFullYear();
  const month = String(current.getUTCMonth() + 1).padStart(2, '0');
  const day = String(current.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseUtcDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function isWeekday(dateKey) {
  const day = parseUtcDateKey(dateKey).getUTCDay();
  return day !== 0 && day !== 6;
}

function addDays(dateKey, days) {
  const date = parseUtcDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return toUtcDateKey(date);
}

function getDateRange(startDate, endDate) {
  const dates = [];
  let current = parseUtcDateKey(startDate);
  const end = parseUtcDateKey(endDate);

  while (current <= end) {
    dates.push(toUtcDateKey(current));
    current = new Date(current);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function parseTimeToMinutes(timeLabel) {
  const match = String(timeLabel).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]) % 12;
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === 'PM') {
    hour += 12;
  }

  return hour * 60 + minutes;
}

function normalizeTimeRange(timeRange) {
  const parts = String(timeRange).split(' - ').map(part => part.trim());
  if (parts.length !== 2) {
    return null;
  }

  const startMinutes = parseTimeToMinutes(parts[0]);
  const endMinutes = parseTimeToMinutes(parts[1]);

  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  return `${startMinutes}-${endMinutes}`;
}

function getTimeRangeFromHour(hour) {
  const formatHour = value => {
    const period = value >= 12 ? 'PM' : 'AM';
    const displayHour = value % 12 || 12;
    return `${displayHour}:00 ${period}`;
  };

  return `${formatHour(hour)} - ${formatHour(hour + 1)}`;
}

function getSlotPrice(dateKey, hour, pricing) {
  if (!isWeekday(dateKey)) {
    return pricing.peak;
  }

  return pricing.offPeak;
}

function getSubscriptionWeekdays(startDate, endDate) {
  return getDateRange(startDate, endDate).filter(isWeekday);
}

function buildDailySlots(dateKey, court, pricing, startHour = 5, endHour = 22) {
  const slots = [];

  for (let hour = startHour; hour <= endHour; hour += 1) {
    slots.push({
      id: `${dateKey}-${hour}-${court}`,
      date: dateKey,
      court,
      time: getTimeRangeFromHour(hour),
      price: getSlotPrice(dateKey, hour, pricing),
      status: 'available',
    });
  }

  return slots;
}

module.exports = {
  toUtcDateKey,
  parseUtcDateKey,
  isWeekday,
  addDays,
  getDateRange,
  normalizeTimeRange,
  getTimeRangeFromHour,
  getSlotPrice,
  getSubscriptionWeekdays,
  buildDailySlots,
};
