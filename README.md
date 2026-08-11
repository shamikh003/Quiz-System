# Quiz System — Upgraded

This is an upgraded version of your quiz project. Everything still works the
same way from a user's point of view (login → take quiz → see results;
teacher panel → add questions → view results) but the internals are much
stronger.

## What changed

### 🔒 Security (the big one)
- **Correct answers no longer reach the student's browser.** Previously,
  `GET /api/questions` sent every answer's correct option straight to the
  quiz page — anyone could open DevTools and see every correct answer before
  answering. Now:
  - `GET /api/quiz/questions` (used by the quiz page) strips the `correct`
    field out entirely.
  - The student's answers are sent to a new `POST /api/quiz/submit`
    endpoint, and the **server** grades them and saves the result. The score
    can no longer be faked from the browser console.
- **Real teacher login.** The old admin panel used a hardcoded password
  (`teacher123`) sitting in plain JavaScript — visible to anyone who viewed
  the page source. Now there's a proper `Admin` account in the database with
  a bcrypt-hashed password, and a JWT token is issued on login.
- **All admin actions require a valid token**, checked server-side: creating,
  editing, deleting questions; changing the quiz timer; deleting results.
  Before, anyone could hit those endpoints directly with `curl` or Postman —
  no password required at the API level at all.
- **Rate limiting** added to slow down brute-force login attempts and general
  API abuse.
- A default admin account (`ADMIN_USERNAME` / `ADMIN_PASSWORD` from your
  `.env`) is auto-created the first time the server starts, so you always
  have a way in.

### 📝 New features
- **Edit and delete individual questions** (previously you could only wipe
  the entire question bank).
- **Progress bar** during the quiz ("Question 3 of 10").
- **Leaderboard with rank + medals** on the results page.
- **CSV export** of results, one click.
- **Dark mode toggle**, remembered across visits.
- Clearer error messages instead of generic alerts (e.g. wrong password,
  validation errors on the question form).

### 🛠 Backend restructuring
The old single 90-line `index.js` is now organized into:
```
Backend/
  index.js              -> app setup, DB connection, admin seeding
  models/models.js       -> Admin, Question, Result, Settings schemas
  middleware/auth.js     -> JWT verification
  routes/auth.js         -> POST /api/auth/login
  routes/questions.js    -> quiz + admin question endpoints
  routes/results.js      -> quiz submission + leaderboard + delete
  routes/settings.js     -> timer settings
```
This makes it much easier to extend later (e.g. adding subjects, multiple
quizzes, more roles).

## How to test locally

### 1. Backend
```bash
cd Backend
cp .env.example .env
# edit .env: set MONGO_URI (your MongoDB Atlas connection string),
# JWT_SECRET (any long random string), and optionally ADMIN_USERNAME/ADMIN_PASSWORD
npm install
npm start
```
You should see `MongoDB Connected...` and `Backend server is live on
http://localhost:5000`. The first time it starts, it will also print that it
created a default admin account.

### 2. Frontend
The frontend is plain HTML/CSS/JS — no build step. Open `index.html`,
`quiz.html`, or `results.html` directly in a browser, or serve the
`frontend` folder with any static server, e.g.:
```bash
cd frontend
npx serve .
```

**Important:** each frontend JS file has this line near the top:
```js
const BACKEND_URL = 'https://quiz-system-hpy5.onrender.com';
```
For local testing, change it to `http://localhost:5000` in `admin.js`,
`quiz.js`, and `results.js`. When you deploy the backend for real, put your
deployed backend's URL back in.

### 3. Try it out
1. Open `index.html` → log in with the admin username/password from your
   `.env` (defaults: `admin` / `changeme123` unless you changed them).
2. Add a few questions, set the quiz time.
3. Open `quiz.html` in another tab/browser → take the quiz as a student.
4. Open `results.html` → see the leaderboard, export CSV. Log in as admin
   (on `index.html`) to also see the "Clear All Results" button appear here.
5. Go back to the admin panel → "Manage Questions" tab → try editing and
   deleting a single question.

## Deploying
- **Backend**: redeploy to Render (or wherever you host it) with the new
  `Backend/` folder. Set the environment variables (`MONGO_URI`,
  `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`) in your host's dashboard
  — don't commit `.env`.
- **Frontend**: same as before (e.g. GitHub Pages, Netlify, Vercel) — just
  make sure `BACKEND_URL` in the three JS files points at your deployed
  backend.

## Suggested next steps
- Change the default admin password immediately after first login (there's
  no "change password" UI yet — for now you can update it directly by
  editing the `ADMIN_PASSWORD` env var and clearing the `Admin` collection
  so it reseeds, or by adding a small change-password endpoint).
- Add question categories/subjects if you want multiple quizzes.
- Add per-question timers or negative marking if needed.
