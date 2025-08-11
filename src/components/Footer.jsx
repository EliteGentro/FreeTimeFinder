import React from "react";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const author = "Humberto Cisneros";

  return (
    <footer className="mt-8 py-4 border-t border-gray-300 dark:border-gray-700 text-center text-sm text-gray-600 dark:text-gray-400">
      <p>
        © {currentYear} {author}. All rights reserved.
      </p>
      <p className="mt-1">
        <a
          href="https://github.com/EliteGentro"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline dark:text-indigo-400 mx-2"
        >
          GitHub
        </a>
        |
        <a
          href="https://www.linkedin.com/in/humberto-gcs/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline dark:text-indigo-400 mx-2"
        >
          LinkedIn
        </a>
      </p>
    </footer>
  );
}
