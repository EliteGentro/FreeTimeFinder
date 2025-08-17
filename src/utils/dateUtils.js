export const dayMap = {
  Lun: "Mon",
  Mar: "Tue",
  Mié: "Wed",
  Mie: "Wed", // sometimes accent lost
  Jue: "Thu",
  Vie: "Fri",
  Sáb: "Sat",
  Sab: "Sat",
  Dom: "Sun",
  Lu: "Mon",
  Ma: "Tue",
  Mi: "Wed",
  Ju: "Thu",
  Vi: "Fri",
  Sa: "Sat",
  Do: "Sun",
};

export const toDateStart = (ddmmyyyy) => {
  const [d, m, y] = ddmmyyyy.split(".").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

export const toDateEnd = (ddmmyyyy) => {
  const [d, m, y] = ddmmyyyy.split(".").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
};

export const timeToMinutes = (hhmm) => {
  const [h, mm] = hhmm.split(":").map(Number);
  return h * 60 + mm;
};

export const minutesToHHMM = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(
    2,
    "0"
  )}`;

export const parseDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.trim().split(".");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (
    isNaN(day) ||
    isNaN(month) ||
    isNaN(year) ||
    day < 1 ||
    month < 1 ||
    year < 1900
  )
    return null;
  return new Date(year, month - 1, day);
};

export const formatDateDot = (date) => {
  if (!date) return "";
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
};
