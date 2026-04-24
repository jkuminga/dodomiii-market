const KST_OFFSET_HOURS = 9;

export function toKstDate(now: Date): Date {
  return new Date(now.getTime() + KST_OFFSET_HOURS * 60 * 60 * 1000);
}

export function formatOrderDate(now: Date): string {
  const kstDate = toKstDate(now);
  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

export function getDepositDeadlineAt(now: Date, deadlineDays: number): Date {
  const kstDate = toKstDate(now);

  return new Date(
    Date.UTC(
      kstDate.getUTCFullYear(),
      kstDate.getUTCMonth(),
      kstDate.getUTCDate() + deadlineDays,
      23 - KST_OFFSET_HOURS,
      59,
      59,
    ),
  );
}

export function toIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
