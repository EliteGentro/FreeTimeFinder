import React from "react";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const author = "Humberto Cisneros";

  return (
    <footer className="mt-8 py-4 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
      <p>
        © {currentYear} {author}. All rights reserved.
      </p>
      <p className="mt-1">
        <a
          href="https://github.com/EliteGentro"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline text-slate-700 dark:text-slate-300 mx-2"
        >
          GitHub
        </a>
        |
        <a
          href="https://www.linkedin.com/in/humberto-gcs/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline text-slate-700 dark:text-slate-300 mx-2"
        >
          LinkedIn
        </a>
      </p>
    </footer>
  );
}

