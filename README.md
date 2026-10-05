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
- Responsive design, dark mode, and English/Urdu support in the student portal.

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
   ```

2. Start the backend:

   ```bash
   cd Backend
   npm install
   npm start
   ```

3. Serve the `frontend` folder using VS Code Live Server, then open `index.html`. Local pages automatically connect to the backend on port `5000`. Create student accounts from the Teacher Panel.

Run automated tests from `Backend` with `npm test`.

## Deployment

Host the static frontend on GitHub Pages or Netlify and the backend on Render. Set the backend environment variables on your host and update the hosted API URL in `frontend/config.js`. Keep `.env` out of version control.
