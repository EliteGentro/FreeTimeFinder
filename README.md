# 📅 FreeTimeFinder

FreeTimeFinder is a lightweight, intuitive web application that helps you **find common free periods** between you and your friends.  
Simply upload your own schedule, add as many friends’ schedules as you like, and instantly see when everyone is available.

---

## 🚀 Features

- **Multi-user support** – Upload multiple schedules and compare them side-by-side.
- **Automatic free time detection** – Instantly compute shared free periods for all participants.
- **Flexible uploads** – Add your schedule first, then add as many friends' schedules as you want.
- **Period-based analysis** – Break schedules into weeks/periods for more accurate comparisons.
- **Privacy-friendly** – Schedules are processed locally in the browser (no server storage).

---

## 🖥️ How It Works

1. Upload your own schedule file.
2. Upload one or more friends’ schedules.
3. The app will:
   - Merge the schedules.
   - Divide them into **week periods**.
   - Compute free times per period.
4. View the resulting shared availability on an interactive UI.

---

## 📂 File Format

FreeTimeFinder works with schedule files in a specific PDF format.  
A valid file should contain:
- **Week periods** (start and end dates)
- **Events/Classes** with:
  - Day of week
  - Start time
  - End time
  - Event name (optional)

> 💡 Tip #1: If your school or service can export schedules to PDF, change the pdfConvert function.

> 💡 Tip #2: You can use the vite config file and the api util to pass the pdf text to a an LLM for formatting instead of creating the funcion.

---

## 🛠️ Tech Stack

- **Frontend:** React + Vite
- **Styling:** TailwindCSS
- **State Management:** React Hooks
- **Utilities:** Custom schedule parsing & period computation functions

---

## 📦 Installation

Clone the repository:

```bash
git clone https://github.com/yourusername/FreeTimeFinder.git
cd FreeTimeFinder

## 📦 Installation

Install dependencies:

```bash
npm install
```
Run locally:
```bash
npm run dev
```
The app will be available at http://localhost:5173.
