# QuizBoard

A classroom assessment platform for timed quizzes, assignment submissions, and student progress tracking.

**Live website:** [QuizBoard by Shamikh and team](https://quizboard-io.netlify.app/)

Developed by **Muhammad Shamikh**, **Sadia Khan**, and **Abdul Rehman** for computer classroom assessments.

## Features

- Teacher and student accounts with password hashing and role-based access.
- Timed, image-based quizzes with Skip and Return, saved answers, and resume.
- Server-side scoring and one quiz attempt per student per Pakistan calendar day.
- Grades 4–7 and Hifz, custom sections, and student account management.
- Word, Excel, and PowerPoint assignments with teacher grading. Graded marks remain in reports after assignment deletion.
- Personal student reports and a shared leaderboard ranked by marks percentage, then completion time for ties.
- Grade, section, and roll number filters with matching CSV exports.
- Responsive design, dark mode, and English/Urdu support, including saved automatic question and option translations.

## Technology

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js, custom REST APIs
- **Database:** MongoDB Atlas with Mongoose
- **File storage:** Cloudinary

## Local Setup

Requires Node.js, a MongoDB connection, and a Cloudinary account.

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

### Automatic Urdu Translation

Use Node.js 18 or newer. Create an API key in [Google AI Studio](https://aistudio.google.com/api-keys), add `GEMINI_API_KEY` to `Backend/.env` locally and to Render's environment for the hosted backend, then restart/redeploy the backend. Keep the key private; it is never sent to the browser.

New or changed questions translate in the background. For existing questions, choose a grade (or All Grades) in **Manage Questions**, select **Translate to Urdu**, and use **Refresh** to check progress and open **Urdu preview**. Translations are stored once per question in MongoDB. Students switch the question and all options using the existing Urdu button without calling Gemini or changing their answers, score, order, or deadline. Missing translations fall back to English with a short notice.

The queue spaces requests at least 6 seconds apart (up to 10 requests per minute); pending jobs resume after restarts. Set `TRANSLATION_INTERVAL_MS=6000` in the backend environment, or use a higher value if your account needs a slower rate. If quota or credentials prevent translation, fix the cause and select **Translate to Urdu** again. Gemini limits depend on your account/model. Review generated translations before a class quiz, particularly abbreviations and negative questions. Images themselves are unchanged.

## Deployment

Host the static frontend on GitHub Pages or Netlify and the backend on Render. Set the backend environment variables on your host and update the hosted API URL in `frontend/config.js`. Keep `.env` out of version control.
