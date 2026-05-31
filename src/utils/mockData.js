// mockData.js
//
// Demo schedules used to let visitors preview the app before uploading any
// PDF. The shapes match exactly what `parsePdfFile` produces in App.jsx:
//
//   Owner = { id, name, entries, format, fileName }
//   ScheduleEntry = { name, days, startTime, endTime, startDate, endDate, type }
//
// Dates use the same "dd.mm.yyyy" string format the parsers emit, and all
// entries are "course" typed so they fall into a single Course Period.

const TERM_START = "01.09.2025";
const TERM_END = "05.12.2025";

const course = (name, days, startTime, endTime) => ({
  name,
  days,
  startTime,
  endTime,
  startDate: TERM_START,
  endDate: TERM_END,
  type: "course",
});

const DEMO_MAIN = {
  id: "demo-main",
  name: "You (demo)",
  format: "demo",
  fileName: "demo-your-schedule.pdf",
  entries: [
    course("Calculus II", ["Mon", "Wed", "Fri"], "08:00", "09:30"),
    course("Physics Lab", ["Tue", "Thu"], "10:00", "12:00"),
    course("Software Design", ["Mon", "Wed"], "13:00", "14:30"),
    course("World History", ["Fri"], "15:00", "17:00"),
  ],
};

const DEMO_FRIENDS = [
  {
    id: "demo-friend-1",
    name: "Alex (demo)",
    format: "demo",
    fileName: "demo-alex.pdf",
    entries: [
      course("Linear Algebra", ["Mon", "Wed"], "09:00", "10:30"),
      course("Chemistry", ["Tue", "Thu"], "11:00", "13:00"),
      course("Economics", ["Wed", "Fri"], "14:00", "15:30"),
    ],
  },
  {
    id: "demo-friend-2",
    name: "Sam (demo)",
    format: "demo",
    fileName: "demo-sam.pdf",
    entries: [
      course("Data Structures", ["Mon", "Thu"], "08:00", "10:00"),
      course("Statistics", ["Tue", "Fri"], "10:30", "12:00"),
      course("Philosophy", ["Wed"], "16:00", "18:00"),
    ],
  },
  {
    id: "demo-friend-3",
    name: "Jordan (demo)",
    format: "demo",
    fileName: "demo-jordan.pdf",
    entries: [
      course("Biology", ["Mon", "Wed", "Fri"], "10:00", "11:30"),
      course("Spanish", ["Tue", "Thu"], "13:00", "14:30"),
    ],
  },
];

/** Returns a fresh deep copy of the demo data so app state stays mutable. */
export const getDemoData = () => ({
  mainOwner: structuredClone(DEMO_MAIN),
  friendOwners: structuredClone(DEMO_FRIENDS),
});
