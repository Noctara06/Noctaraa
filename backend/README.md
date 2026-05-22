# Midnight Backend

Scalable Node.js backend scaffold using **Express + modular architecture**.

## Stack
- Node.js
- Express (REST API)
- PostgreSQL
- Prisma ORM
- bcrypt (password hashing)
- JWT access + refresh token auth
- dotenv (environment config)
- helmet, cors, morgan

## Folder Architecture
```text
backend/
  prisma/
    schema.prisma
  src/
    app.js
    server.js
    config/
      env.js
      prisma.js
    common/
      AppError.js
      auth/
        tokens.js
      middlewares/
        auth.middleware.js
        error.middleware.js
        not-found.middleware.js
    modules/
      health/
        health.controller.js
        health.routes.js
      auth/
        auth.controller.js
        auth.routes.js
        auth.service.js
      users/
        users.controller.js
        users.routes.js
        users.service.js
      reports/
        reports.controller.js
        reports.routes.js
        reports.service.js
      stories/
        stories.controller.js
        stories.routes.js
        stories.service.js
      reader/
        reader.controller.js
        reader.routes.js
        reader.service.js
      notifications/
        notifications.controller.js
        notifications.routes.js
        notifications.service.js
    routes/
      index.js
  scripts/
    smoke-test.js
  .env.example
  package.json
```

## Quick Start
1. Install dependencies:
```bash
npm install
```

2. Copy env:
```bash
cp .env.example .env
```

3. Generate Prisma client:
```bash
npm run prisma:generate
```

4. Run migrations:
```bash
npm run prisma:migrate
```

5. Run dev server:
```bash
npm run dev
```

6. Run smoke test:
```bash
npm run test:smoke
```

Optional admin verification:
```bash
SMOKE_ADMIN_EMAIL=admin@example.com SMOKE_ADMIN_PASSWORD=your-password npm run test:smoke
```

PowerShell admin verification:
```powershell
$env:SMOKE_ADMIN_EMAIL="admin@example.com"
$env:SMOKE_ADMIN_PASSWORD="your-password"
npm run test:smoke
```

Server:
- `http://localhost:5000`
- API prefix: `/api/v1`

CORS:
- `CORS_ORIGIN` supports `*`
- or one origin
- or a comma-separated allow-list

Example:
```env
CORS_ORIGIN=http://localhost:5500,https://your-frontend-domain.com
```

Auth env keys:
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN` (default `15m`)
- `JWT_REFRESH_EXPIRES_IN` (default `7d`)
- `BCRYPT_SALT_ROUNDS` (default `12`)

## REST API Structure
- `GET    /api/v1/health`
- `POST   /api/v1/auth/signup`
- `POST   /api/v1/auth/login`
- `POST   /api/v1/auth/refresh`
- `POST   /api/v1/auth/logout`
- `GET    /api/v1/users` (protected: admin/manager)
- `GET    /api/v1/users/:id` (protected: self/admin/manager)
- `PATCH  /api/v1/users/:id` (protected: self update, admin manage role/block)
- `GET    /api/v1/stories`
- `GET    /api/v1/stories/:id`
- `POST   /api/v1/stories` (protected)
- `PATCH  /api/v1/stories/:id` (protected + owner/admin/manager)
- `DELETE /api/v1/stories/:id` (protected + owner/admin/manager)
- `POST   /api/v1/reports` (protected)
- `GET    /api/v1/reports` (protected: admin/manager)
- `PATCH  /api/v1/reports/:id` (protected: admin/manager)
- `DELETE /api/v1/reports/:id` (protected: admin/manager)
- `GET    /api/v1/reader/state` (protected)
- `POST   /api/v1/reader/likes/:storyId` (protected)
- `DELETE /api/v1/reader/likes/:storyId` (protected)
- `POST   /api/v1/reader/library/:storyId` (protected)
- `DELETE /api/v1/reader/library/:storyId` (protected)
- `PUT    /api/v1/reader/progress/:storyId` (protected)
- `POST   /api/v1/reader/follows/:authorId` (protected)
- `DELETE /api/v1/reader/follows/:authorId` (protected)
- `POST   /api/v1/reader/subscriptions/:storyId` (protected)
- `DELETE /api/v1/reader/subscriptions/:storyId` (protected)
- `GET    /api/v1/reader/comments/:storyId` (protected)
- `POST   /api/v1/reader/comments/:storyId` (protected)
- `GET    /api/v1/notifications` (protected)
- `POST   /api/v1/notifications/read-all` (protected)

## Notes
- Database models include `Role`, `User`, `Genre`, `Story`, `Chapter`, `Report`, and `RefreshToken` with relational constraints.
- Users now support profile metadata (`username`, `bio`, `avatarColor`, socials) plus `blocked` moderation state.
- Stories now support `visibility`, `contentWarning`, `scheduledAt`, `publishedAt`, and `coverUrl`.
- Reader activity now supports likes, library, reading progress, follows, story comments, story subscriptions, and notifications.
- Indexing is added on query-heavy fields (`email`, `roleId`, `authorId`, `genreId`, `status`, chapter order, timestamps, refresh token validity fields).
- Protected endpoints require `Authorization: Bearer <accessToken>` header.
