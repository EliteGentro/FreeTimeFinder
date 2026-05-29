import React, { useState, useMemo, useRef } from "react";
import { Sun, Moon, X, Upload, Calendar as CalendarIcon, CalendarCheck, Download, FolderOpen } from "lucide-react";

import { extractTextFromPDF } from "./utils/pdfUtils";
import {
  detectScheduleFormat,
  extractStudentName,
  extractScheduleEntriesIris,
  extractScheduleEntriesMitec,
} from "./utils/pdfConverter";

import useSchedulePeriods from "./hooks/useSchedulePeriods";
import { downloadICS } from "./utils/icsExport";
import { exportSnapshot, importSnapshot } from "./utils/snapshotUtils";
import Calendar from "./components/Calendar";
import FileUpload from "./components/FileUpload";
import Footer from "./components/Footer";

const MAIN_ID = "main";

const makeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Parses a single PDF file into a normalized Owner object:
 *   { id, name, entries, format, fileName }
 */
async function parsePdfFile(file, idOverride) {
  const text = await extractTextFromPDF(file);
  const format = detectScheduleFormat(text);
  let entries = [];
  if (format === "iris") {
    entries = extractScheduleEntriesIris(text);
  } else if (format === "mitec") {
    entries = extractScheduleEntriesMitec(text);
  } else {
    // Best-effort fallback: try both and keep whichever yields results.
    const a = extractScheduleEntriesIris(text);
    const b = extractScheduleEntriesMitec(text);
    entries = a.length >= b.length ? a : b;
  }
  const name =
    extractStudentName(text) ||
    file.name.replace(/\.pdf$/i, "").trim() ||
    "Unknown";

  return {
    id: idOverride || makeId(),
    name,
    entries,
    format,
    fileName: file.name,
  };
}

export default function App() {
  const [mainOwner, setMainOwner] = useState(null);
  const [friendOwners, setFriendOwners] = useState([]);
  const [loadingMain, setLoadingMain] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [importError, setImportError] = useState(null);
  const snapshotInputRef = useRef(null);

  const { periods, periodSlotData, owners } = useSchedulePeriods(
    mainOwner,
    friendOwners
  );

  const handleMainUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoadingMain(true);
    try {
      const owner = await parsePdfFile(files[0], MAIN_ID);
      setMainOwner(owner);
    } catch (err) {
      console.error("Main upload error:", err);
    } finally {
      setLoadingMain(false);
      e.target.value = "";
    }
  };

  const handleFriendsUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setLoadingFriends(true);
    try {
      const parsed = [];
      for (const f of files) {
        try {
          parsed.push(await parsePdfFile(f));
        } catch (err) {
          console.error(`Failed to parse ${f.name}:`, err);
        }
      }
      setFriendOwners((prev) => [...prev, ...parsed]);
    } finally {
      setLoadingFriends(false);
      e.target.value = "";
    }
  };

  const removeFriend = (id) =>
    setFriendOwners((prev) => prev.filter((f) => f.id !== id));
  const clearMain = () => setMainOwner(null);

  const handleExportSnapshot = () => {
    exportSnapshot(mainOwner, friendOwners);
  };

  const handleImportSnapshot = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const { mainOwner: m, friendOwners: fs } = await importSnapshot(file);
      if (m) setMainOwner(m);
      setFriendOwners((prev) => {
        // Merge imported friends, avoiding duplicate ids.
        const existingIds = new Set(prev.map((f) => f.id));
        const newFriends = fs.filter((f) => !existingIds.has(f.id));
        return [...prev, ...newFriends];
      });
    } catch (err) {
      setImportError(err.message);
    } finally {
      e.target.value = "";
    }
  };

  const hasData = useMemo(
    () => owners.length > 0 && periods.length > 0,
    [owners, periods]
  );

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
        <div className="max-w-5xl mx-auto px-6 py-10">
          {/* Top bar */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <CalendarIcon
                size={22}
                className="text-slate-700 dark:text-slate-300"
              />
              <span className="text-lg font-semibold tracking-tight">
                Free Time Finder
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Hidden file input for snapshot import */}
              <input
                ref={snapshotInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportSnapshot}
              />

              <button
                onClick={() => snapshotInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Import a previously saved snapshot"
              >
                <FolderOpen size={14} />
                Import
              </button>

              <button
                onClick={handleExportSnapshot}
                disabled={!mainOwner && friendOwners.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Export current schedules as a reusable snapshot"
              >
                <Download size={14} />
                Export
              </button>

              <a
                href="https://youtu.be/Ck3KbiHxB7w"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Tutorial
              </a>
              <button
                onClick={() => setDarkMode((p) => !p)}
                className="p-2 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </div>

          {/* Intro */}
          <header className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight mb-2">
              Find when everyone is free
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Upload your schedule and your friends' schedules (Iris or Mitec
              PDF). The app overlaps every calendar and shows shared free
              blocks, with a heat map for partial matches.
            </p>
          </header>

          {/* Import error banner */}
          {importError && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <span className="flex-1">{importError}</span>
              <button
                onClick={() => setImportError(null)}
                className="opacity-60 hover:opacity-100"
                aria-label="Dismiss error"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Uploads */}
          <section className="grid gap-4 md:grid-cols-2 mb-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
              <FileUpload
                label="Main schedule"
                description="Your own PDF"
                loading={loadingMain}
                onChange={handleMainUpload}
                icon={<Upload size={14} />}
              />
              {mainOwner && (
                <div className="mt-3 flex flex-col gap-2">
                  <OwnerChip
                    owner={mainOwner}
                    onRemove={clearMain}
                    accent="primary"
                  />
                  <button
                    onClick={() => downloadICS(mainOwner)}
                    className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <CalendarCheck size={13} />
                    Export to calendar app
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
              <FileUpload
                label="Friends' schedules"
                description="One or more PDFs"
                loading={loadingFriends}
                multiple
                onChange={handleFriendsUpload}
                icon={<Upload size={14} />}
              />
              {friendOwners.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {friendOwners.map((f) => (
                    <OwnerChip
                      key={f.id}
                      owner={f}
                      onRemove={() => removeFriend(f.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Results */}
          {hasData ? (
            <Calendar
              periods={periods}
              periodSlotData={periodSlotData}
              owners={owners}
              mainOwnerId={mainOwner?.id || null}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Upload at least one schedule to see results.
            </div>
          )}
        </div>
        <Footer />
      </div>
    </div>
  );
}

function OwnerChip({ owner, onRemove, accent }) {
  const palette =
    accent === "primary"
      ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${palette}`}
    >
      <span className="truncate max-w-[16rem]">{owner.name}</span>
      {owner.format && owner.format !== "unknown" && (
        <>
          <span className="opacity-60">·</span>
          <span className="uppercase tracking-wide opacity-60">
            {owner.format}
          </span>
        </>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 opacity-70 hover:opacity-100"
          aria-label={`Remove ${owner.name}`}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
