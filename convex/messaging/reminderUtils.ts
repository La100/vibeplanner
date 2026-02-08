export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type WeekdayKey = typeof WEEKDAY_KEYS[number];

export const weekdayKeyFromShort = (short: string): WeekdayKey => {
  const lower = short.toLowerCase();
  return (WEEKDAY_KEYS.find((d) => d === lower.slice(0, 3)) as WeekdayKey) || "mon";
};

export const getZonedParts = (date: Date, timeZone?: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: weekdayKeyFromShort(map.weekday || "mon"),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
};

export const getTimeZoneOffsetMinutes = (timeZone: string | undefined, date: Date) => {
  const zoned = getZonedParts(date, timeZone);
  const asUTC = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  );
  return (asUTC - date.getTime()) / 60000;
};

export const toUtcTimestampFromLocal = (
  timeZone: string | undefined,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
) => {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, utcGuess);
  return utcGuess.getTime() - offsetMinutes * 60000;
};

export const parseReminderTime = (reminderTime?: string) => {
  if (!reminderTime) return null;
  const match = reminderTime.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return { hour, minute };
};

export const addDaysUtc = (year: number, month: number, day: number, delta: number) => {
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + delta);
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
};

export const getNextReminderTimestamp = ({
  timeZone,
  reminderTime,
  scheduleDays,
}: {
  timeZone?: string;
  reminderTime?: string;
  scheduleDays?: string[] | null;
}) => {
  const parsed = parseReminderTime(reminderTime);
  if (!parsed) return null;

  const now = new Date();
  const nowParts = getZonedParts(now, timeZone);
  const schedule = scheduleDays?.length ? scheduleDays.map((d) => d.toLowerCase()) : null;

  for (let i = 0; i < 8; i += 1) {
    const candidateDate = addDaysUtc(nowParts.year, nowParts.month, nowParts.day, i);
    const candidateUtc = toUtcTimestampFromLocal(
      timeZone,
      candidateDate.year,
      candidateDate.month,
      candidateDate.day,
      parsed.hour,
      parsed.minute
    );
    if (candidateUtc <= now.getTime() + 1000) {
      continue;
    }
    const candidateWeekday = getZonedParts(new Date(candidateUtc), timeZone).weekday;
    if (schedule && !schedule.includes(candidateWeekday)) {
      continue;
    }
    return candidateUtc;
  }

  return null;
};

export const shouldSendNow = ({
  timeZone,
  reminderTime,
  scheduleDays,
}: {
  timeZone?: string;
  reminderTime?: string;
  scheduleDays?: string[] | null;
}) => {
  const parsed = parseReminderTime(reminderTime);
  if (!parsed) return false;
  const now = new Date();
  const nowParts = getZonedParts(now, timeZone);
  const schedule = scheduleDays?.length ? scheduleDays.map((d) => d.toLowerCase()) : null;
  const weekday = nowParts.weekday;
  if (schedule && !schedule.includes(weekday)) {
    return false;
  }
  const expectedUtc = toUtcTimestampFromLocal(
    timeZone,
    nowParts.year,
    nowParts.month,
    nowParts.day,
    parsed.hour,
    parsed.minute
  );
  const diff = Math.abs(now.getTime() - expectedUtc);
  return diff <= 2 * 60 * 1000;
};
