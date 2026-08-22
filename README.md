# French Review

A local-first personal web application for reviewing French A1 lessons.

## Requirements

- Node.js 24
- npm 11

## Local setup

Install dependencies and generate the Prisma client:

```bash
npm ci
```

Create or update the local SQLite database:

```bash
npm run db:migrate
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local databases are stored
under `prisma/` and are excluded from Git.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
