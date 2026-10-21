# QuizBoard

Classroom quizzes, assignments and student progress reports.

Developed by Muhammad Shamikh, Sadia Khan and Abdul Rehman.

Website: https://quizboard-app.pages.dev/

## Features

- Teacher and student accounts, grade and section management.
- Timed quizzes with images, saved answers, resume and automatic scoring.
- PDF/Word question imports and Excel student registration.
- Student and father names in registration and profiles.
- Assignment uploads, grading and saved assignment history.
- Searchable student reports, class PDFs and filtered PDF/Excel exports.
- Roll number and password login with automatic grade and section lookup.
- English/Urdu support, dark mode and responsive layouts.

## Project structure

```text
Backend/
  assets/          Report fonts and licences
  middleware/      Authentication
  models/          Database models
  routes/          API routes
  services/        Application services
  uploads/         Local runtime upload folders
  index.js         Server entry point
  change-admin.js  Teacher account management
  .env.example     Configuration template
frontend/
  admin/           Teacher panel and import templates
  student/         Student panel
  config.js        API connection settings
  style.css        Shared styles
index.html         Local frontend shortcut
```

## Local setup

Requires Node.js 22.3 or newer, MongoDB and Cloudinary.

1. Copy `Backend/.env.example` to `Backend/.env` and enter your configuration. Keep `.env` private. Existing installations can keep their current file.
2. In a terminal:

   ```powershell
   cd Backend
   npm install
   npm start
   ```

3. Open `frontend/index.html` through VS Code Live Server. Local pages connect to the backend on port 5000.

## Imports

Use **Import PDF / Word** for questions or **Import Excel Students** for accounts. Download the template from the relevant dialog, upload the completed file, review it and import the selected rows.

Question imports include **Quiz time in minutes (all grades)**, which can also be changed in the preview. The shared duration is saved when questions are imported; active quizzes keep their existing deadline. **Manage Questions** shows the total for the selected grade or all grades.

Questions accept typed PDF or DOCX files, up to 10 MB and 1,000 questions. Include numbered questions, options A-C or A-D and an answer key. Scanned pages and embedded question images need manual entry.

Student spreadsheets accept up to 5,000 rows. Use Name, Father Name, Roll Number, Password, Grade and Section. Father Name and Section are optional; a selected grade can supply missing Grade values. Store roll numbers and passwords as Excel text. Passwords require at least six characters and at most 72 UTF-8 bytes. Existing accounts are not overwritten.

## Student reports

**Reports → All Results** shows every saved attempt, newest first. Choose **Latest Attempt** for one result per student within the selected grade and section. PDF and Excel downloads use the same grade, section, roll-number and attempt filters. **Top 5 Scorers** on the dashboard uses each student's highest percentage from all saved attempts. Equal percentages are ordered by completion time, with unavailable timing last. View all results opens the selected grade in All Attempts mode.

Open **Reports → Student Report**, search by name or roll number and select the correct account. Reports include saved quiz results and graded assignments, including archived assignment marks. **Download PDF** exports the full saved history. Father names appear in student profiles and individual reports; All Results shows student names only.

For a whole class, select a grade in **Reports → Grade Reports**, optionally choose a section, then use **Download Grade PDF**. All matching students are included in one file, with each student's report starting on a new page. Individual and grade PDFs carry the Dar-e-Arqam School Metroville Campus name and logo.

Students sign in with their roll number and password. Grade and section are read from the saved account. If a roll number is used in more than one account, the password identifies the account; identical roll numbers and passwords across accounts require the teacher to resolve the duplicate credentials. Individual PDFs download using the student's name.

## Urdu translation

Set `GEMINI_API_KEY` in the backend environment to enable automatic Urdu translation. **Manage Questions → Translate to Urdu** also processes existing questions. Translations are saved in MongoDB and can be reviewed before use. Keep the API key on the server.

## Deployment

Cloudflare Pages: branch `master`, framework **None**, build command `exit 0`, output directory `frontend`.

Render: root directory `Backend`, install command `npm install`, start command `npm start`. Set environment variables on Render and configure the hosted API in `frontend/config.js`. Deploy matching frontend and backend versions.

MongoDB contains account and assessment records. Cloudinary stores uploaded files. The Noto Sans Arabic report font licence is in `Backend/assets/fonts/OFL.txt`.
