import type { Platform, PostStatus } from "@prisma/client";
import { prisma } from "./db.js";

export function calculateScheduledTime(
  platform: Platform | string,
  timezone: string,
  urgency: "high" | "normal" | "low"
): Date {
  // Urgency override — post within 30 minutes.
  if (urgency === "high") {
    return new Date(Date.now() + 30 * 60 * 1000);
  }

  const now = new Date();

  // Convert "now" into the user's timezone for hour/day selection.
  const userNow = new Date(
    now.toLocaleString("en-US", { timeZone: timezone })
  );

  if (platform === "linkedin_personal" || platform === "linkedin_company") {
    const bestDays = [2, 3, 4]; // Tue..Thu
    const bestHours = [7, 8, 12]; // 7am, 8am, 12pm

    // Find next best window (within 7 days).
    return findNextWindow(userNow, bestDays, bestHours, timezone);
  }

  // Default: next day 8am.
  const tomorrow = new Date(userNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  return fakeLocalToUTC(tomorrow, timezone);
}

export function isInBlackout(
  scheduledTime: Date,
  blackoutStart: string | null,
  blackoutEnd: string | null,
  timezone: string
): boolean {
  if (!blackoutStart || !blackoutEnd) return false;

  const localTime = new Date(
    scheduledTime.toLocaleString("en-US", { timeZone: timezone })
  );

  const timeNum = localTime.getHours() * 100 + localTime.getMinutes();

  const startParts = blackoutStart.split(":").map(Number);
  const endParts = blackoutEnd.split(":").map(Number);
  const startH = startParts[0];
  const startM = startParts[1];
  const endH = endParts[0];
  const endM = endParts[1];
  if (
    startH === undefined ||
    startM === undefined ||
    endH === undefined ||
    endM === undefined
  ) {
    return false;
  }

  const startNum = startH * 100 + startM;
  const endNum = endH * 100 + endM;

  // Handle overnight blackout (e.g. 22:00 to 07:00).
  if (startNum > endNum) {
    return timeNum >= startNum || timeNum <= endNum;
  }

  return timeNum >= startNum && timeNum <= endNum;
}

function getLocalDayBounds(date: Date, timezone: string): { startOfDay: Date; endOfDay: Date } {
  const localDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
  const noonUtc = new Date(`${localDateStr}T12:00:00Z`);
  const localTimeAtNoon = new Date(noonUtc.toLocaleString("en-US", { timeZone: timezone }));
  const tzOffsetMs = noonUtc.getTime() - localTimeAtNoon.getTime();
  const startOfDay = new Date(new Date(`${localDateStr}T00:00:00Z`).getTime() + tzOffsetMs);
  const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);
  return { startOfDay, endOfDay };
}

export async function checkFrequencyCap(
  userId: string,
  platform: Platform | string,
  date: Date
): Promise<boolean> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { max_posts_per_day: true, timezone: true }
  });

  const cap = user?.max_posts_per_day ?? 3;
  const timezone = user?.timezone ?? "UTC";

  const { startOfDay, endOfDay } = getLocalDayBounds(date, timezone);

  const platformEnum = platform as Platform;
  const count = await prisma.posts.count({
    where: {
      user_id: userId,
      platform: platformEnum,
      status: { in: ["approved", "posted"] as PostStatus[] },
      scheduled_at: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });

  // true = cap reached, block scheduling
  return count >= cap;
}

function findNextWindow(
  from: Date,
  days: number[],
  hours: number[],
  timezone: string
): Date {
  const candidate = new Date(from);

  // Try up to 7 days ahead.
  for (let d = 0; d < 7; d++) {
    const checkDate = new Date(candidate);
    checkDate.setDate(checkDate.getDate() + d);

    if (days.includes(checkDate.getDay())) {
      for (const hour of hours) {
        // If same day, only use future hours.
        if (d === 0 && checkDate.getHours() >= hour) {
          continue;
        }

        checkDate.setHours(hour, 0, 0, 0);
        return fakeLocalToUTC(checkDate, timezone);
      }
    }
  }

  // Fallback — tomorrow 8am.
  const fallback = new Date(from);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(8, 0, 0, 0);
  return fakeLocalToUTC(fallback, timezone);
}

function fakeLocalToUTC(fakeLocalDate: Date, timezone: string): Date {
  // fakeLocalDate is built via the "fake local" trick:
  // its UTC numerics equal the user's wall-clock time values.
  // Compute the offset and shift to real UTC.
  const tzRepresentation = new Date(fakeLocalDate.toLocaleString("en-US", { timeZone: timezone }));
  const offsetMs = fakeLocalDate.getTime() - tzRepresentation.getTime();
  return new Date(fakeLocalDate.getTime() + offsetMs);
}

