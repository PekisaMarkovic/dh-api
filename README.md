# DH API

Backend of **DH**, an app where companies keep track of the drinks in their warehouses and make proformas (price quotes) from them.

Built with NestJS, TypeORM and PostgreSQL. The frontend lives in the `dh-dashboard` repo.

- API: `http://localhost:4200/api`
- Swagger (all endpoints, try them out): `http://localhost:4200/api`

## What it does

- **Companies, warehouses, drinks.** A company has many warehouses, a warehouse has many drinks. Every drink has a price and a quantity in stock.
- **Proformas.** Pick a warehouse, pick drinks and quantities, create the proforma. The drinks are taken off the stock. An admin can return them to the stock if something goes wrong. A proforma can be downloaded as a PDF.
- **Invite-only registration.** Nobody can sign up on their own. An admin invites an email, the person gets a link and finishes the registration.
- **Users and roles.** Three roles: `super.admin`, `admin`, `user`. Every user keeps their own language (`en` or `sr`).
- **Emails** go out through Brevo.

## Quick start

You need Node 20+, pnpm and PostgreSQL.

```bash
# 1. database (skip if you already have Postgres with a database called "dh")
docker run -d --name dh-db -e POSTGRES_USER=root -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=dh -p 5432:5432 postgres:16

# 2. settings
cp .env.example .env        # then fill in what is empty, see "Environment variables"

# 3. run
pnpm install
pnpm start:dev
```

On the first start the tables are created and the first data is seeded (see below). Log in with `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from your `.env` on the dashboard.

## Environment variables

| Variable | What it is |
| --- | --- |
| `ENVIROMENT` | `local` or `production` (yes, spelled like this). Production is stricter, see below. |
| `PORT` | Port of the API, `4200`. |
| `DB_HOST` `DB_PORT` `DB_USERNAME` `DB_PASSWORD` `DB_NAME` | PostgreSQL connection. |
| `JWT_SECRET` | Secret that signs the tokens. Use a long random value in production. |
| `JWT_EXPIRE` / `JWT_REFRESH_EXPIRE` | Life of the access token (`60m`) and of the refresh token (`180m`). |
| `APP_DASHBOARD` | Address of the dashboard. Used in the links of the emails and as the only origin CORS allows. Local: `http://localhost:4300`. Production: the real domain, e.g. `https://app.example.com`. |
| `APP_NAME` | Name of the app. |
| `BREVO_API_KEY` | Brevo API key (SMTP & API → API keys). |
| `MAIL_FROM_EMAIL` | Sender address. It has to be a verified sender in Brevo. |
| `MAIL_FROM_NAME` | Sender name, `DH`. |
| `BREVO_SANDBOX` | `true`: Brevo only checks the request and delivers nothing. `false`: really sends. |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | The first super admin, created by the seeder. Change the password. |

**Production rules.** With `ENVIROMENT=production` the API will not start if `APP_DASHBOARD` is empty or points to `localhost`, and it will not send emails without `BREVO_API_KEY`.

**Local without Brevo.** Leave `BREVO_API_KEY` empty. Invitations still work: nothing is sent, but the invitation link is printed in the terminal, open it by hand.

## What happens on start (seeder)

Every start checks and fills in what is missing, it never overwrites anything:

1. If there are no roles: creates the permissions and the roles `super.admin`, `admin`, `user`.
2. Makes sure the super admin from `SUPER_ADMIN_EMAIL` exists.
3. Makes sure the company **NakNak** exists.
4. Users without a company are attached to NakNak (there is one company for now).

## How things work

### Login and tokens

`POST /auth/login` returns an `access_token` and a `refresh_token`.

- The access token is a JWT with the email, roles, names, language and `companyId` in it.
- The refresh token is stored in the `validation_tokens` table. `POST /auth/refresh` (public) swaps it for a new pair, the old one stops working.
- A new login removes the older refresh tokens: **one session per user**.

### Roles and who sees what

`super.admin` is above `admin`, `admin` is above `user`.

- Everyone who is logged in can **read** warehouses, drinks and proformas of their own company and **create proformas**.
- `admin` and `super.admin` can create, edit and delete warehouses and drinks, invite people, see the users of the company and **return a proforma to the stock**.
- Only `super.admin` can create and delete companies.

**Companies are separated.** Every request is checked against the company of the user, asking for something of another company gives `403`. A `super.admin` can access every company.

### Invitations (the only way to register)

1. An admin sends `POST /invitations` with an email. An invitation is saved (valid **7 days**) and an email goes out with the link `APP_DASHBOARD/first-time-register/<invitationId>`.
2. The dashboard asks `GET /invitations/:id/valid`. If the link is not valid (expired, used, unknown) it says so.
3. The person enters first name, last name and a password (at least 8 characters). The dashboard calls `POST /auth/first-time-register`.
4. The API reads the email from the invitation in the database, creates the user (role `user`, company of the invitation), marks the invitation as accepted and returns the tokens.

Details: inviting the same email again replaces the pending invitation, an email that already has a user gets `409`, and if the email could not be sent the invitation is removed again and the API answers `422`.

**Sending again.** When a link expired (or the email got lost) an admin calls `POST /invitations/:id/resend`. The email goes out again, the expiry starts again (7 days from now) and the invitation keeps its id, so the link in the first email works again too. It is refused with `409` if the invitation was already used or the person already has an account, and if the email cannot be sent the old expiry stays.

### Warehouses and drinks

- `Company 1 → * Warehouse 1 → * Drink`. A drink also stores its `company_id`, so drinks can be searched per company without joins.
- A warehouse **cannot be deleted while it has drinks** (`409`), empty it first.
- Everything is **soft deleted**: rows get `deleted_at` and stay in the table. Normal queries do not see them.

### Proformas

- The number looks like `PR-000001`, it is made from the id.
- **Creating** a proforma runs in one transaction: the drinks are locked, the quantity is checked against the stock (more than in stock is `400`) and the quantity is taken off the stock. If two people ask for the same stock at the same moment, exactly one wins.
- Each line keeps a **copy** of the drink name and price, so an old proforma never changes when a drink is edited.
- **Return to stock** (admin only) adds the quantities back and sets the status to `returned`. It works **once**.
- Money is calculated in cents, so `3 × 0.10` is exactly `0.30`.
- **PDF:** `GET /proformas/:id/pdf`. The layout is a **placeholder** and lives in one method, `renderProforma` in `src/pdf/services/pdf.service.ts`. It uses the Inter font (in `src/pdf/fonts`) because the built-in PDF fonts miss letters like č, ć, đ.

### Emails

Two services on purpose:

- `BrevoService` only talks to the Brevo API (HTTP, no extra library).
- `MailerService` knows what the emails are: template, subject, data. Template: `src/mailer/templates/first-time-register.html`. It must use **inline styles only**, because the placeholder replacement (`{link}`, `{valid_days}`) would eat the braces of a `<style>` block.

## Endpoints

Everything is under `/api`. All need a login except where it says public.

| Area | Endpoints |
| --- | --- |
| Auth | `POST auth/login` (public), `auth/refresh` (public), `auth/first-time-register` (public), `auth/is-user-token-valid` (public), `auth/logout` |
| Users | `GET users/profile`, `PATCH users/profile` (phone, date of birth, language), `GET users` (super admin) |
| Invitations | `POST invitations` (admin), `GET invitations` (admin), `POST invitations/:id/resend` (admin), `GET invitations/:id/valid` (public) |
| Companies | `GET companies`, `GET companies/:id`, `GET companies/:id/users` (admin), `POST companies` (super admin), `PATCH companies/:id` (admin), `DELETE companies/:id` (super admin) |
| Warehouses | `GET warehouses`, `GET warehouses/:id`, `POST` `PATCH` `DELETE` (admin) |
| Drinks | `GET drinks` (`?warehouseId=`), `GET drinks/:id`, `POST` `PATCH` `DELETE` (admin) |
| Proformas | `GET proformas`, `GET proformas/:id`, `POST proformas`, `GET proformas/:id/pdf`, `POST proformas/:id/return` (admin) |

## Project structure

```
src/
  auth/            login, tokens, roles, guards, decorators
  users/           user entity, profile
  invitations/     invite and validate
  companies/       companies and their users
  warehouses/      warehouses
  drinks/          drinks
  proformas/       proformas, stock, return
  pdf/             PDF generator + fonts
  mailer/          BrevoService, MailerService, email templates
  seeder/          first data on start
  validation-token/  refresh tokens
  common/          shared: audit columns, helpers (money, urls, query), enums
  main.ts          bootstrap, Swagger, CORS
```

Each feature folder is `entities/`, `dto/`, `services/`, `controllers/` and a `*.module.ts`. Entities share `created_at`, `updated_at`, `deleted_at` from `common/entities/audit.entity.ts`.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm start:dev` | Run with auto restart. |
| `pnpm build` then `pnpm start` | Production build and run (`pnpm start` runs `node dist/main`, so it needs the build first; hosts like Railway do both). |
| `pnpm lint` | ESLint. |
| `pnpm format` | Prettier. |

## Good to know

- **No migrations yet.** The database schema follows the entities automatically (`synchronize: true`). That is great for development, but changing or removing a field changes or **drops the column**. Before there is real data in production, switch to migrations (the `migration:*` scripts are ready, `src/migrations` is empty).
- **Restart after adding a dependency.** `pnpm start:dev` decides at startup which packages are not bundled. A package installed while it runs gets bundled and breaks (this happened with `pdfkit`). Stop it and start it again.
- **Enum columns need an explicit type**, like `@Column({ type: 'varchar', ... })`. The webpack build loses the enum type and TypeORM fails with `Data type "Object" is not supported`.
- **Test with the real build** when something looks different from production: `pnpm build` and `node dist/main`, not only `ts-node`.
- The fonts for the PDF are copied into `dist` by the `assets` part of `nest-cli.json`.
