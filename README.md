# forHumanity

forHumanity is a community support app for submitting and tracking blanket delivery requests.

## Monorepo layout

- `backend/` — Node + Express + MongoDB API
- `frontend/` — React app

## Quick start

### 1) Backend

```bash
cd backend
cp .env.example .env 2>/dev/null || true
npm install
npm run dev
```

If `.env.example` does not exist inside backend, use the root `.env.example` values and create `backend/.env` manually:

```env
MONGODB_URI=mongodb://localhost:27017/forHumanity
JWT_SECRET=change-me
PORT=5000
CLIENT_ORIGIN=http://localhost:3000
```

### 2) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm start
```

Frontend defaults to `http://localhost:3000` and calls API at `REACT_APP_API_URL`.

## Scripts

### Backend

- `npm run dev` — run server with nodemon
- `npm start` — run server

### Frontend

- `npm start` — start dev app
- `npm run build` — production build
- `npm test` — tests

## Current app shell

- Home page (`/`)
- Request form (`/request`)
- Login/register page (`/login`)
- My requests (`/my-requests`, requires login)
