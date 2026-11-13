# Secure Notes — Frontend

A functional client for the Secure Notes API, written in plain HTML and vanilla JavaScript with
no framework, no template and no build step. The task focuses on the backend, so this UI is
intentionally plain.

| | |
|---|---|
| Live app | http://150.241.228.137:8096 |
| Live API | http://150.241.228.137:8096/api |
| Frontend repo | https://github.com/fayjur0001/secure-note-taking-frontend |
| Backend repo | https://github.com/fayjur0001/secure-note-taking-backend (includes the indexing and aggregation notes) |

Admin credentials for testing are in the submission email.

## Features

- Register and login (the JWT is stored in `localStorage`; logout reloads the page so no previous user's data stays in memory)
- My notes: create, edit, delete and a paginated list
- Profile: edit name, interests and password
- Posts: write and delete your own posts, and view any user's posts (Aggregation Scenario 2, `$lookup`)
- Interests: users grouped by interest, with an optional filter (Aggregation Scenario 1); click a name to see that user's posts
- Admin only: manage users (add, edit including role, delete, list) and view everyone's notes, optionally filtered by owner

All user content is rendered with `textContent`, never `innerHTML`, so a stored note or post cannot inject HTML or scripts.

## Files

| File | Purpose |
|---|---|
| `index.html` | markup and minimal CSS |
| `app.js` | API calls, rendering, pagination |
| `config.js` | the backend base URL (`window.API_URL`) |

## Run locally

1. Start the backend on `http://localhost:3000`. That is the default in `config.js`.
2. Serve this folder: `python3 -m http.server 5500`, or `npx serve .`.
3. Open http://localhost:5500. Set the backend's `CORS_ORIGIN` to `http://localhost:5500`.

## Deployment

In production the backend container serves this folder on the same origin as the API: the
folder is mounted read-only into the container, and a deploy-only `config.js` with
`API_URL = ''` replaces the local one. The backend repo's README describes this setup.

Because the API is on the same origin, CORS is not involved. A frontend-only change is
deployed with `git pull` in the server's `frontend/` folder; no rebuild or restart is needed.
