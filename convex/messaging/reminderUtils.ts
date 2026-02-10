export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type WeekdayKey = typeof WEEKDAY_KEYS[number];
export type ReminderSource = "plan" | "base";

export interface ReminderPlanEntry {
  date: string; // YYYY-MM-DD in project timezone calendar
  reminderTime: string; // HH:mm
  minStartTime?: string; // HH:mm
  phaseLabel?: string;
}

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
  const normalized = normalizeReminderTime(reminderTime);
  if (!normalized) return null;
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return { hour, minute };
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (n: number) => String(n).padStart(2, "0");

const toDateString = (year: number, month: number, day: number) =>
  `${year}-${pad2(month)}-${pad2(day)}`;

export const normalizeReminderTime = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${pad2(hour)}:${pad2(minute)}`;
};

export const normalizeReminderPlan = (
  entries?: Array<Partial<ReminderPlanEntry>> | null
): ReminderPlanEntry[] => {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const byDate = new Map<string, ReminderPlanEntry>();

  for (const entry of entries) {
    const date = typeof entry?.date === "string" ? entry.date.trim() : "";
    const reminderTime = normalizeReminderTime(entry?.reminderTime);
    if (!DATE_REGEX.test(date) || !reminderTime) continue;

    const minStartTime = normalizeReminderTime(entry?.minStartTime ?? undefined) ?? undefined;
    const phaseLabel =
      typeof entry?.phaseLabel === "string" && entry.phaseLabel.trim().length > 0
        ? entry.phaseLabel.trim()
        : undefined;

    byDate.set(date, {
      date,
      reminderTime,
      minStartTime,
      phaseLabel,
    });
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export const getReminderPlanEntryForDate = (
  reminderPlan: Array<ReminderPlanEntry> | undefined | null,
  date: string
): ReminderPlanEntry | null => {
  if (!reminderPlan?.length) return null;
  return reminderPlan.find((entry) => entry.date === date) ?? null;
};

const dateToDowKey = (dateStr: string): WeekdayKey => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return WEEKDAY_KEYS[d.getUTCDay()];
};

export const resolveReminderForDate = ({
  date,
  reminderTime,
  scheduleDays,
  reminderPlan,
}: {
  date: string;
  reminderTime?: string;
  scheduleDays?: string[] | null;
  reminderPlan?: Array<ReminderPlanEntry> | null;
}): { reminderTime: string; source: ReminderSource; planEntry?: ReminderPlanEntry } | null => {
  const normalizedPlan = normalizeReminderPlan(reminderPlan);
  const planEntry = getReminderPlanEntryForDate(normalizedPlan, date);
  if (planEntry) {
    return {
      reminderTime: planEntry.reminderTime,
      source: "plan",
      planEntry,
    };
  }

  const normalizedBaseReminder = normalizeReminderTime(reminderTime);
  if (!normalizedBaseReminder) return null;

  const schedule = scheduleDays?.length ? scheduleDays.map((d) => d.toLowerCase()) : null;
  if (schedule && !schedule.includes(dateToDowKey(date))) {
    return null;
  }

  return {
    reminderTime: normalizedBaseReminder,
    source: "base",
  };
};

export const shiftDateString = (dateStr: string, deltaDays: number): string => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
};

export const deriveReminderPlanFromDescription = ({
  description,
  startDate,
  maxDay = 30,
}: {
  description?: string;
  startDate: string; // YYYY-MM-DD
  maxDay?: number;
}): ReminderPlanEntry[] => {
  if (!description || !description.trim()) return [];
  const lines = description.split(/\r?\n/);
  const derived: ReminderPlanEntry[] = [];

  for (const line of lines) {
    const dayMatch = line.match(/D\s*(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?/i);
    const timeMatch = line.match(/(\d{1,2}):([0-5]\d)/);
    if (!dayMatch || !timeMatch) continue;

    const from = Number(dayMatch[1]);
    const to = dayMatch[2] ? Number(dayMatch[2]) : from;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) continue;
    if (from > maxDay) continue;

    const normalizedTime = normalizeReminderTime(`${timeMatch[1]}:${timeMatch[2]}`);
    if (!normalizedTime) continue;

    const upper = Math.min(to, maxDay);
    const phaseLabel = to === from ? `D${from}` : `D${from}-${to}`;
    for (let day = from; day <= upper; day += 1) {
      const date = shiftDateString(startDate, day - 1);
      derived.push({
        date,
        reminderTime: normalizedTime,
        minStartTime: normalizedTime,
        phaseLabel,
      });
    }
  }

  return normalizeReminderPlan(derived);
};

export const getNextReminderSchedule = ({
  timeZone,
  reminderTime,
  scheduleDays,
  reminderPlan,
  maxLookaheadDays = 120,
}: {
  timeZone?: string;
  reminderTime?: string;
  scheduleDays?: string[] | null;
  reminderPlan?: Array<ReminderPlanEntry> | null;
  maxLookaheadDays?: number;
}): {
  timestamp: number;
  date: string;
  reminderTime: string;
  source: ReminderSource;
  planEntry?: ReminderPlanEntry;
} | null => {
  const now = new Date();
  const nowParts = getZonedParts(now, timeZone);

  for (let i = 0; i <= maxLookaheadDays; i += 1) {
    const candidateDate = addDaysUtc(nowParts.year, nowParts.month, nowParts.day, i);
    const date = toDateString(candidateDate.year, candidateDate.month, candidateDate.day);
    const effective = resolveReminderForDate({
      date,
      reminderTime,
      scheduleDays,
      reminderPlan,
    });
    if (!effective) continue;

    const parsed = parseReminderTime(effective.reminderTime);
    if (!parsed) continue;

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

    return {
      timestamp: candidateUtc,
      date,
      reminderTime: effective.reminderTime,
      source: effective.source,
      planEntry: effective.planEntry,
    };
  }

  return null;
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
  reminderPlan,
}: {
  timeZone?: string;
  reminderTime?: string;
  scheduleDays?: string[] | null;
  reminderPlan?: Array<ReminderPlanEntry> | null;
}) => {
  const schedule = getNextReminderSchedule({
    timeZone,
    reminderTime,
    scheduleDays,
    reminderPlan,
  });
  return schedule?.timestamp ?? null;
};

export const shouldSendNow = ({
  timeZone,
  reminderTime,
  scheduleDays,
  reminderPlan,
}: {
  timeZone?: string;
  reminderTime?: string;
  scheduleDays?: string[] | null;
  reminderPlan?: Array<ReminderPlanEntry> | null;
}) => {
  const now = new Date();
  const nowParts = getZonedParts(now, timeZone);
  const today = toDateString(nowParts.year, nowParts.month, nowParts.day);
  const effective = resolveReminderForDate({
    date: today,
    reminderTime,
    scheduleDays,
    reminderPlan,
  });
  if (!effective) return false;
  const parsed = parseReminderTime(effective.reminderTime);
  if (!parsed) return false;
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
