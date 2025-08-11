import React, { useState } from "react";
import { extractTextFromPDF } from "./utils/pdfUtils";
//import { sendToLLM } from "./utils/api";
import Calendar from "./components/Calendar";
import useParsedSchedule from "./hooks/useParsedSchedule";
import useSchedulePeriods from "./hooks/useSchedulePeriods";
import FileUpload from "./components/FileUpload";
import { extractScheduleEntries } from "./utils/pdfConverter";
import PeriodFreeTimes from "./components/PeriodFreeTimes";
import Footer from "./components/Footer";

export default function App() {
  const [mainScheduleRaw, setMainScheduleRaw] = useState("");
  const [friendsSchedulesRaw, setFriendsSchedulesRaw] = useState("");
  const [loadingMain, setLoadingMain] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const mainSchedule = useParsedSchedule(mainScheduleRaw);
  const friendsSchedules = useParsedSchedule(friendsSchedulesRaw);

  const { periods, periodFreeTimes } = useSchedulePeriods(
    mainSchedule,
    friendsSchedules
  );

  const handleUpload = async (e, isMainUser) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (isMainUser) setLoadingMain(true);
    else setLoadingFriends(true);

    let combinedText = "";

    for (const file of files) {
      try {
        const pdfText = await extractTextFromPDF(file);
        //const llmResponse = await sendToLLM(pdfText);
        const llmResponse = extractScheduleEntries(pdfText);
        combinedText += llmResponse + "\n";
      } catch (err) {
        console.error("Upload/parse error:", err);
      }
    }

    if (isMainUser) setMainScheduleRaw(combinedText.trim());
    else setFriendsSchedulesRaw((prev) => prev + "\n" + combinedText.trim());

    if (isMainUser) setLoadingMain(false);
    else setLoadingFriends(false);
  };

  return (
    <div className={`${darkMode ? "dark" : ""}`}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 transition-colors duration-300">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => setDarkMode((prev) => !prev)}
              className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              {darkMode ? "🌞 Light Mode" : "🌙 Dark Mode"}
            </button>
            <a
              href="https://www.youtube.com/watch?v=F6jDsWlSsEc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-3xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Tutorial
            </a>
          </div>

          <h1 className="text-3xl font-bold mb-6 text-center text-indigo-600 dark:text-indigo-400">
            📅 Free Time Finder
          </h1>

          <h2 className="text-sm font-bold mb-6 text-justify text-indigo-600 dark:text-indigo-400">
            A free time range finder between your and your friends' schedule.
            This program only works with the specific IRIS pdf schedule format,
            and an academic program of 17 weeks with 5 periods including 3
            5-week course periods and 2 single-week periods in between.
          </h2>

          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 space-y-6 transition-colors duration-300">
            <FileUpload
              label="Upload Main User Schedule (PDF)"
              loading={loadingMain}
              onChange={(e) => handleUpload(e, true)}
            />

            <FileUpload
              label="Upload Friends' Schedules (PDF)"
              loading={loadingFriends}
              multiple
              onChange={(e) => handleUpload(e, false)}
            />

            {periodFreeTimes.length > 0 && (
              <>
                <PeriodFreeTimes
                  periodFreeTimes={periodFreeTimes}
                  periods={periods}
                />
                <Calendar periods={periods} periodFreeTimes={periodFreeTimes} />
              </>
            )}
          </div>
        </div>
        <Footer></Footer>
      </div>
    </div>
  );
}
