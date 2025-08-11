import React from "react";

export default function FileUpload({ label, loading, onChange, multiple }) {
  return (
    <div>
      <label className="block text-lg font-semibold text-gray-700 dark:text-gray-300 transition-colors duration-300">
        {label}
      </label>
      <input
        type="file"
        accept="application/pdf"
        multiple={multiple}
        className="mt-2 block w-full text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-2 transition-colors duration-300"
        onChange={onChange}
      />
      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
          {loading === "main"
            ? "Processing main schedule..."
            : "Processing friends' schedules..."}
        </p>
      )}
    </div>
  );
}
