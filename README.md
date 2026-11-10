# DH API

NestJS + TypeORM (Postgres) boilerplate: auth (JWT, roles, permissions), users, mailer, validation tokens, seeder.

- Runs on **http://localhost:4200** (Swagger at `/api`)
- Setup: edit `.env`, create a Postgres DB named `dh`, then `pnpm install && pnpm start:dev`

## Registration flow (invite only)

1. Admin / super admin: `POST /api/invitations` `{ "email": "..." }` – creates an invitation and mails a link `APP_DASHBOARD/first-time-register/<invitationId>` (valid 7 days; inviting the same email again replaces the pending one; existing users are rejected).
2. Dashboard calls `GET /api/invitations/<id>/valid`, then shows the form (first name, last name, password).
3. `POST /api/auth/first-time-register` `{ invitationId, firstName, lastName, password }` – the email is read from the invitation in the DB, the user is created with role `user`, the invitation is marked accepted and tokens are returned.

On a fresh DB the seeder creates the super admin from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` (`.env`).
