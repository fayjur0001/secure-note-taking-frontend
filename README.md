# Secure Notes — Frontend

A functional client for the Secure Notes API, written in plain HTML and vanilla JavaScript with
no framework and no build step. The task focuses on the backend, so this UI is intentionally plain.

- **Live site:** `<add Netlify/Vercel URL here>`
- **Backend repo / API:** `<add links here>`

## Features

- Register and login (the JWT is stored in `localStorage`)
- My notes: create, edit, delete and a paginated list
- Profile: edit name, interests and password
- Posts: write a post, or view any user's posts (Aggregation Scenario 2)
- Interests: users grouped by interest, with an optional filter (Aggregation Scenario 1)
- Admin only: manage users (add, edit, delete, list) and view everyone's notes

## Configure

Edit `config.js` and point it at the backend:

```js
window.API_URL = 'https://your-api.onrender.com';
```

## Run locally

```bash
npx serve .            # or: python3 -m http.server 5500
```

Set `CORS_ORIGIN` on the backend to this origin, e.g. `http://localhost:5500`.

## Deploy

- **Netlify:** Add new site → Import from Git → no build command, publish directory `.`
- **Vercel:** New Project → Framework "Other" → no build command, output directory `.`
