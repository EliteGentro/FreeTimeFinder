import React from "react";

export default function FileUpload({
  label,
  description,
  loading,
  onChange,
  multiple,
  icon,
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {label}
        </label>
        {description && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {description}
          </span>
        )}
      </div>

      <label className="mt-2 flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 px-3 py-2 transition-colors">
        <span className="text-slate-500 dark:text-slate-400">{icon}</span>
        <span className="text-sm text-slate-600 dark:text-slate-300">
          Choose PDF{multiple ? "s" : ""}
        </span>
        <input
          type="file"
          accept="application/pdf"
          multiple={multiple}
          onChange={onChange}
          className="hidden"
        />
      </label>

      {loading && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Processing…
        </p>
      )}
    </div>
  );
}
