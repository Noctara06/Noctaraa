# Midnight

Midnight is a full-stack story platform with:
- Reader mode
- Writer mode
- Admin dashboard
- Follow, comments, likes, library, progress, and notifications

## Project Structure

```text
New folder/
  backend/                  Express + Prisma + PostgreSQL API
  *.html / *.js / *.css     Static frontend pages
  app-api.js                Shared frontend API client
  app-config.js             Frontend API base configuration
```

## Local Setup

### 1. Backend

```powershell
cd "c:\Users\vikas\Downloads\Wattpadd\1\New folder\backend"
npm install
Copy-Item .env.example .env
```

Update `backend\.env` with your real PostgreSQL password and JWT secrets.

Run migrations and start the API:

```powershell
npm run prisma:migrate
npm run dev
```

Backend will run on:
- `http://localhost:5000`
- API base: `http://localhost:5000/api/v1`

### 2. Frontend

You can open the HTML files directly or serve them from a static server.

If you use:
- `file://` pages -> frontend auto-connects to `http://localhost:5000/api/v1`
- `http://localhost:5500` or another local static port -> frontend still defaults to `http://localhost:5000/api/v1`
- same-origin deployment -> frontend auto-uses `<current-origin>/api/v1`

If your deployed frontend and backend use different domains, edit [app-config.js](/c:/Users/vikas/Downloads/Wattpadd/1/New%20folder/app-config.js):

```js
window.MIDNIGHT_CONFIG = {
  apiBase: "https://your-backend-domain.com/api/v1"
};
```

Important for Netlify + Render:
- Put your actual Render API URL in `app-config.js`
- Example: `https://your-app.onrender.com/api/v1`

## QA / Recheck

### Automated smoke test

```powershell
cd "c:\Users\vikas\Downloads\Wattpadd\1\New folder\backend"
npm run test:smoke
```

Admin-inclusive smoke test:

```powershell
$env:SMOKE_ADMIN_EMAIL="vikashmeghwanshi210@gmail.com"
$env:SMOKE_ADMIN_PASSWORD="Vikash@210"
npm run test:smoke
```

### Manual browser checklist

1. Sign up and log in
2. Switch between Reader and Writer modes
3. Create, edit, and publish a story
4. Like, save, follow, comment, and subscribe to story updates
5. Check writer bell notifications
6. Check reader bell notifications
7. Open admin dashboard and test reports / block / manager actions

## Deployment Notes

### Backend

Set production env values:
- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`
- `BOOTSTRAP_ADMIN_EMAILS`

`CORS_ORIGIN` supports:
- one origin
- multiple comma-separated origins

Example:

```env
CORS_ORIGIN=https://midnight-app.vercel.app,https://admin.midnight.app
BOOTSTRAP_ADMIN_EMAILS=you@example.com
```

`BOOTSTRAP_ADMIN_EMAILS` is useful on Render deployments:
- sign up with that email first
- restart the backend
- that account will be promoted to `admin` automatically

### Frontend

Option 1:
- Host frontend and backend on the same origin
- Keep `app-config.js` empty

Option 2:
- Host frontend separately
- Set `window.MIDNIGHT_CONFIG.apiBase` in [app-config.js](/c:/Users/vikas/Downloads/Wattpadd/1/New%20folder/app-config.js)

## Current Status

- Phase 1: done
- Phase 2: done
- Phase 3: done
- Phase 4: in final polish / deploy-ready stage
