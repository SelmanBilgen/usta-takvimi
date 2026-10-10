const monthNames = [
  "ocak", "şubat", "mart", "nisan", "mayıs", "haziran",
  "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"
];

export function formatDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatDateTime(value: string) {
  if (!value) return "";
  const [datePart, timePart] = value.split(/[T ]/);
  const time = timePart?.slice(0, 5);
  return `${formatDate(datePart)}${time ? ` ${time}` : ""}`;
}

export function parseDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (isoMatch) return makeIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));

  const parts = trimmed.toLocaleLowerCase("tr-TR").replace(/[./-]/g, " ").split(/\s+/);
  if (parts.length !== 3) return null;

  const [dayText, monthText, yearText] = parts;
  const day = Number(dayText);
  const year = Number(yearText);
  const month = Number.isFinite(Number(monthText))
    ? Number(monthText)
    : monthNames.indexOf(monthText) + 1;

  if (!dayText || !yearText || month < 1) return null;
  return makeIsoDate(year, month, day);
}

function makeIsoDate(year: number, month: number, day: number): string | null {
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
