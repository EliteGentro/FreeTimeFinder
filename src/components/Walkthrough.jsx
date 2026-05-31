import React, { useEffect, useState } from "react";
import {
  X,
  Upload,
  Users,
  Grid3x3,
  Flame,
  Save,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/**
 * In-site walkthrough overlay.
 *
 * A small step-by-step guide that explains what the app does. The final step
 * offers to load demo data via `onLoadDemo` so the user can see the app working
 * before uploading any PDF.
 *
 * Props:
 *   open       boolean   – whether the overlay is visible
 *   onClose    () => void
 *   onLoadDemo () => void – loads demo schedules, then closes the overlay
 */

const STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to Free Time Finder",
    body: "This tool overlaps your schedule with your friends' schedules and shows exactly when everyone is free at the same time. Here's a quick tour.",
  },
  {
    icon: Upload,
    title: "1. Upload your schedule",
    body: "Add your own schedule as an Iris or Mitec PDF. Everything is processed locally in your browser — nothing is uploaded to a server.",
  },
  {
    icon: Users,
    title: "2. Add your friends",
    body: "Upload one or more friends' schedules. You can add as many as you like and remove any of them at any time.",
  },
  {
    icon: Grid3x3,
    title: "3. See shared free time",
    body: "The week grid highlights the 30-minute blocks where everyone selected is free. A per-day summary lists those shared windows below the grid.",
  },
  {
    icon: Flame,
    title: "4. Explore partial matches",
    body: "Switch to the Heat map to see partial overlaps — darker cells mean more people are free. Use the name chips to include or exclude individuals.",
  },
  {
    icon: Save,
    title: "5. Save & restore sessions",
    body: "Export your comparison as a snapshot file and import it later to continue without re-uploading any PDFs.",
  },
];

export default function Walkthrough({ open, onClose, onLoadDemo }) {
  const [step, setStep] = useState(0);

  // Reset to the first step whenever the overlay is (re)opened.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  // Close on Escape for keyboard accessibility.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  const goPrev = () => setStep((s) => Math.max(0, s - 1));
  const goNext = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="App walkthrough"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-xl p-6 sm:p-7">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close walkthrough"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 mb-4">
            <Icon size={26} />
          </div>
          <h2 className="text-lg font-semibold tracking-tight mb-2">
            {current.title}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {current.body}
          </p>
        </div>

        {/* Progress dots */}
        <div className="mt-6 flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-5 bg-slate-900 dark:bg-slate-100"
                  : "w-1.5 bg-slate-300 dark:bg-slate-700"
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={goPrev}
            disabled={isFirst}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            Back
          </button>

          {isLast ? (
            <button
              onClick={onLoadDemo}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-opacity"
            >
              <Sparkles size={15} />
              Try it with demo data
            </button>
          ) : (
            <button
              onClick={goNext}
              className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-opacity"
            >
              Next
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
