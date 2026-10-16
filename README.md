# QuizBoard

A classroom assessment platform for timed quizzes, assignment submissions, and student progress tracking.

**Live website:** [QuizBoard by Shamikh and team](https://quizboard-io.netlify.app/)

Developed by **Muhammad Shamikh**, **Sadia Khan**, and **Abdul Rehman** for computer classroom assessments.

## Features

- Teacher and student accounts with password hashing and role-based access.
- Timed, image-based quizzes with Skip and Return, saved answers, and resume.
- Student quiz screen with a numbered navigator, Previous/Skip/Next, automatic answer saves, explicit submission review, and a larger image viewer. The desktop layout fits the viewport; images preserve their aspect ratio. Mobile screens use a stacked layout.
- Server-side scoring and one quiz attempt per student per Pakistan calendar day.
- Grades 4–7 and Hifz, custom sections, and student account management.
- Word, Excel, and PowerPoint assignments with teacher grading. Graded marks remain in reports after assignment deletion.
- Personal student reports and a shared leaderboard ranked by marks percentage, then completion time for ties.
- Grade, section, and roll number filters with matching CSV exports.
- Bulk question import from typed PDF/Word documents and student registration from Excel, with a review preview, duplicate checks and progress.
- Responsive design, dark mode, and English/Urdu support, including saved automatic question and option translations.

## Technology

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js, custom REST APIs
- **Database:** MongoDB Atlas with Mongoose
- **File storage:** Cloudinary

## Local Setup

Requires Node.js 22.3 or newer, a MongoDB connection, and a Cloudinary account.

1. Create `Backend/.env` with your configuration:

   ```env
   MONGO_URI=<mongodb-connection-string>
   JWT_SECRET=<long-random-secret>
   ADMIN_USERNAME=<teacher-username>
   ADMIN_PASSWORD=<strong-teacher-password>
   CLOUDINARY_CLOUD_NAME=<cloud-name>
   CLOUDINARY_API_KEY=<api-key>
   CLOUDINARY_API_SECRET=<api-secret>
   GEMINI_API_KEY=<google-ai-studio-api-key>
   GEMINI_TRANSLATION_MODEL=gemini-3.5-flash-lite
   ```

2. Start the backend:

   ```bash
   cd Backend
   npm install
   npm start
   ```

3. Serve the `frontend` folder using VS Code Live Server, then open `index.html`. Local pages automatically connect to the backend on port `5000`. Create student accounts from the Teacher Panel.

Run automated tests from `Backend` with `npm test`.

### Bulk imports

Teachers can use **Import PDF / Word** in Add Question or Manage Questions, and **Import Excel Students** in Student Accounts. Uploading prepares a preview only; select and review rows before choosing **Import selected rows**. Download the sample files from the dialog.

- Questions: typed `.pdf` or `.docx`, up to 10 MB and 1,000 questions per file. Choose one grade for the file. Use continuous question numbers, options `A.`, `B.`, `C.` and optional `D.`, followed by an **Answer Key** with entries such as `1. A`. Alternatively, put `Answer: A` after each question. Correct extracted text/options/keys in the preview. Repeated or conflicting question/key numbers must be corrected in the source file. Scanned PDFs, legacy `.doc`, embedded images and complex mathematical/layout formatting are not imported; convert them to the sample format first.
- Students: `.xlsx`, up to 10 MB and 5,000 students per file. The first worksheet needs **Name**, **Roll Number**, **Password**, and either a **Grade** column or a selected default grade. **Section** is optional. Supported grades are 4–7 and Hifz. Row grade/section values override defaults; otherwise blank section becomes Unassigned. Store roll numbers and passwords as Excel Text values to preserve leading zeros. Formula cells are rejected. The existing password rules still apply: at least 6 characters, at most 72 UTF-8 bytes.
- Existing students are matched by roll number, grade and normalized section; they are never overwritten or given a new password. Duplicate questions in a grade are skipped using normalized text and options. File duplicates and invalid rows appear in the preview and cannot be selected.
- If the same roll number is reused across sections within one grade, assign different passwords: the current login distinguishes those accounts by password. The import flags repeated logins in a sheet and refuses to add an account whose roll/grade/password already matches another section.
- Import progress runs in the background. Closing the dialog does not cancel it; reopen from the same browser to resume viewing it. Jobs and checkpoints are stored in MongoDB and recover after a backend restart. Repeated commits/recovered rows reuse the same IDs. A paused job can be resumed within 24 hours. Uncommitted student passwords are encrypted using a key derived from `JWT_SECRET`, never included in previews, hashed using the normal login algorithm at registration, and removed from the import job when it finishes. Do not rotate `JWT_SECRET` while student imports are pending.
- Document readers run in a separate worker with a 45-second deadline and memory/expanded-archive limits. One file is parsed at a time per server, and bulk saves are queued. This does not certify capacity for a particular number of simultaneous school/lab users.

After updating the backend and frontend together, run `npm install` in `Backend` (or `npm ci` on your host) and restart the backend. No new API key or cloud file-storage service is needed for these imports. Automated checks use an isolated database and fake records; they do not connect to the live school database.

## Project Structure

```text
frontend/          Website pages, styles, scripts and app icons
Backend/           Server, database models, APIs and services
Backend/test/      Automated checks and isolated local preview
index.html         Shortcut to the frontend when serving the repo root
```

Uploads, generated reports, temporary previews, dependencies and local credentials are excluded from Git. Uploaded files are managed through Cloudinary; they do not belong in the source repository.

### Automatic Urdu Translation

Use Node.js 22.3 or newer. Create an API key in [Google AI Studio](https://aistudio.google.com/api-keys), add `GEMINI_API_KEY` to `Backend/.env` locally and to Render's environment for the hosted backend, then restart/redeploy the backend. Keep the key private; it is never sent to the browser.

New or changed questions translate in the background. For existing questions, choose a grade (or All Grades) in **Manage Questions**, select **Translate to Urdu**, and use **Refresh** to check progress and open **Urdu preview**. Translations are stored once per question in MongoDB. Students switch the question and all options using the existing Urdu button without calling Gemini or changing their answers, score, order, or deadline. Missing translations fall back to English with a short notice.

The queue spaces requests at least 6 seconds apart (up to 10 requests per minute); pending jobs resume after restarts. Set `TRANSLATION_INTERVAL_MS=6000` in the backend environment, or use a higher value if your account needs a slower rate. If quota or credentials prevent translation, fix the cause and select **Translate to Urdu** again. Gemini limits depend on your account/model. Review generated translations before a class quiz, particularly abbreviations and negative questions. Images themselves are unchanged.

## Deployment

For Cloudflare Pages, select the `master` branch, framework **None**, build command `exit 0`, and output directory `frontend`. Run the backend on Render from the `Backend` directory using `npm install` and `npm start`. Set the backend environment variables on your host; the hosted API URL is configured in `frontend/config.js`. Keep `.env` out of version control.
