# Lala Tech — Operations

A shared, live task tracker with an admin/employee dashboard and in-app
realtime automation (assignment, due-soon, overdue, and completion
notifications). Plain HTML/CSS/JS, no build step, deploys straight to
GitHub Pages. Data lives in Firebase Firestore.

## 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (free Spark plan is enough).
2. In the project, go to **Build → Firestore Database → Create database** → start in **test mode** (tighten rules later, see below).
3. Go to **Project settings → General → Your apps → Web app (`</>`)**, register an app, and copy the `firebaseConfig` object it gives you.
4. Paste that object into `js/firebase-config.js`, replacing the placeholder values.

## 2. Seed demo data

In the Firestore console, create these documents manually (or write a small one-off script using the Firebase Admin SDK — either works for a demo).

**`users` collection:**

| doc id | name | role | avatarColor |
|---|---|---|---|
| admin1 | Manager | admin | #FF7A29 |
| rahul | Rahul | employee | #5B9CFF |
| aman | Aman | employee | #3DDC97 |
| priya | Priya | employee | #FFB627 |

**`tasks` collection** — a few starter tasks (mirrors the pitch's seed data), e.g.:

- "Client Proposal" — assignedTo: rahul, status: open, priority: high, dueDate: today
- "Website Fix" — assignedTo: aman, status: in_progress, priority: medium, dueDate: tomorrow
- "Invoice #124" — assignedTo: priya, status: open, priority: high, dueDate: today (leave it sitting past due for the demo to show the automation firing)
- "Report" — assignedTo: rahul, status: open, priority: low, dueDate: Sep 12

Required fields per task: `title, description, assignedTo, createdBy, status, priority, dueDate, createdAt, updatedAt`. Use Firestore's timestamp type for `dueDate`, `createdAt`, `updatedAt`.

## 3. Firestore security rules

Kept intentionally permissive for a demo — any signed-in/seeded user can read everything (shared visibility is the point) and write to tasks, comments, and notifications:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // demo only — tighten before any real use
    }
  }
}
```

## 4. Run locally

No build step needed — just serve the folder statically, e.g.:

```
npx serve .
```

or open `index.html` directly via a local web server (not `file://`, since Firestore's SDK needs `http(s)://`).

## 5. Deploy to GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo **Settings → Pages → Deploy from branch → `main` / root**.
3. Open the published URL and confirm both an admin and an employee account can log in.

## File structure

```
/
├── index.html
├── css/styles.css        design tokens + all components
├── js/firebase-config.js  your Firebase project keys
├── js/auth.js              account-picker login / session
├── js/data.js               Firestore CRUD
├── js/automation.js      due-soon / overdue notification engine
├── js/admin.js             admin dashboard views
├── js/employee.js        employee dashboard views
└── js/app.js                router, init, shared helpers, task detail panel
```

## Notes

- The automation engine (`js/automation.js`) runs client-side on load and
  every 60 seconds, writing notification docs to Firestore. Every open
  tab picks these up instantly via `onSnapshot` — this is the effect to
  show live in a demo: assign a task in one tab, watch the toast land in
  another.
- Presence dots on the Employees page are based on a `presence`
  collection, heartbeat-updated every 20s per logged-in user.
- The "Copy ops summary" button on the admin Overview page copies an
  ASCII-style snapshot to the clipboard.
- Firestore may ask for a composite index the first time a few of the
  filtered queries run (notifications-per-task lookups, the "not done"
  automation scan). When that happens, open the browser console — the
  error includes a direct link that creates the index with one click.
  Do this once, before the demo, so it doesn't happen live.