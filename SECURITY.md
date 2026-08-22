# Security Policy

## Dependency advisory exceptions

### Prisma CLI development dependency

- Advisory: `GHSA-ggr8-5vv4-36mx` in `deepmerge-ts`
- Affected path: `prisma` -> `@prisma/config` -> `deepmerge-ts`
- Scope: development-only Prisma CLI configuration processing; the application
  runtime does not import this dependency path
- Current constraint: no patched Prisma 7 release is available as of 2026-08-22
- Mitigation: Prisma configuration remains static, repository-controlled, and must
  not accept untrusted recursive objects
- Decision: do not apply npm's suggested breaking downgrade to Prisma 6
- Review date: 2026-09-22, or immediately when a patched Prisma 7 release is
  available
