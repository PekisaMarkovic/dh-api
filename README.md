# DH API

Backend of **DH**, an app where companies keep track of the drinks in their warehouses and make proformas (price quotes) from them.

Built with NestJS, TypeORM and PostgreSQL. Two frontends use it: the admin app in the `dh-dashboard` repo and the public white label sites in the `dh-client` repo. Pictures are kept in Cloudflare R2.

- API: `http://localhost:4200/api`
- Swagger (all endpoints, try them out): `http://localhost:4200/api`

## What it does

- **Companies, warehouses, drinks.** A company has many warehouses, a warehouse has many drinks. Every drink has a price, a quantity in stock and two limits (warning and critical). One warehouse of a company is the **default** one, it is preselected everywhere a warehouse is chosen.
- **Customers.** The buyers that can be put on a proforma.
- **Proformas.** Pick a warehouse, pick drinks and quantities, create the proforma. The drinks are taken off the stock. An active proforma can be changed, an admin can return it to the stock. A proforma can be downloaded as a PDF.
- **Import goods from a document.** An admin uploads a photo or a PDF of a purchase document, the AI reads the drinks and quantities, the admin checks them and adds them to the stock. Every upload is kept in a history.
- **Low stock email.** Every morning every employee gets one email with what is low.
- **Invite-only registration.** Nobody can sign up on their own. An admin invites an email, the person gets a link and finishes the registration.
- **Users and roles.** Three roles: `super.admin`, `admin`, `user`. Every user keeps their own language (`en` or `sr`).
- **Drink pictures.** A drink can have one picture. It is made into an optimized WebP and kept in Cloudflare R2.
- **White label sites.** A company can have its own public site (the `dh-client` Next.js app). The admin of the company manages the texts, pictures, SEO and contact data of the site in the dashboard and **publishes** it. The site reads everything from the API, and visitors can send a message through its contact form.
- **Emails** go out through Brevo.

## Quick start

You need Node 20+, pnpm and PostgreSQL.

```bash
# 1. database (skip if you already have Postgres with a database called "dh")
../dh-db.sh                  # or: docker run -d --name dh-db -e POSTGRES_USER=root -e POSTGRES_PASSWORD=password \
                             #       -e POSTGRES_DB=dh -p 5432:5432 postgres:16

# 2. settings
cp .env.example .env         # then fill in what is empty, see "Environment variables"

# 3. run
pnpm install
pnpm start:dev
```

On the first start the tables are created and the first data is seeded (see below). Log in with `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from your `.env` on the dashboard. Then run `pnpm migration:run` (see "Migrations").

## Environment variables

| Variable | What it is |
| --- | --- |
| `ENVIROMENT` | `local` or `production` (yes, spelled like this). Production is stricter, see below. |
| `PORT` | Port of the API, `4200`. |
| `DB_HOST` `DB_PORT` `DB_USERNAME` `DB_PASSWORD` `DB_NAME` | PostgreSQL connection. |
| `DB_SSL` | `true` / `false` forces an encrypted connection. When it is left out, it is on everywhere except `ENVIROMENT=local`. |
| `JWT_SECRET` | Secret that signs the tokens. Use a long random value in production. |
| `JWT_EXPIRE` / `JWT_REFRESH_EXPIRE` | Life of the access token (`10m`) and of the refresh token (`30m`). |
| `APP_CLIENT` | Addresses of the white label client sites (Next.js) that CORS allows next to the dashboard, separated by a comma. Local default: `http://localhost:4350`. In production only the listed domains are allowed. |
| `APP_DASHBOARD` | Address of the dashboard. Used in the links of the emails and as the only origin CORS allows. Local: `http://localhost:4300`. Production: the real domain, e.g. `https://app.example.com`. |
| `APP_NAME` | Name of the app. |
| `BREVO_API_KEY` | Brevo API key (SMTP & API → API keys). |
| `MAIL_FROM_EMAIL` | Sender address. It has to be a verified sender in Brevo. |
| `MAIL_FROM_NAME` | Sender name, `DH`. |
| `BREVO_SANDBOX` | `true`: Brevo only checks the request and delivers nothing. `false`: really sends. |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | The first super admin, created by the seeder. Change the password. |
| `R2_ACCOUNT_ID` `R2_ACCESS_KEY` `R2_SECRET_ACCESS_KEY` | Credentials of the Cloudflare R2 bucket (Manage R2 API Tokens). |
| `R2_BUCKET_NAME` | Name of the bucket, e.g. `dh-images`. |
| `R2_ENDPOINT` | S3 address of R2 (`https://<account>.r2.cloudflarestorage.com`). If the bucket name is at the end of it, it is ignored. |
| `R2_PUBLIC_URL` | Public address of the bucket (`https://pub-....r2.dev` or your own domain), the address of a picture is this plus its key. |
| `REVALIDATE_SECRET` | Shared secret with the client sites. After a change in the dashboard the API calls `<APP_CLIENT>/api/revalidate` with it, so the change shows at once. Use the same value in `dh-client`. Without it the sites show the change within a minute. |
| `GEMINI_API_KEY` | Key of Google Gemini (aistudio.google.com/apikey), used to read the uploaded purchase documents. Without it the import answers `503`, everything else works. |

**Production rules.** With `ENVIROMENT=production` the API will not start if `APP_DASHBOARD` is empty or points to `localhost`, it will not send emails without `BREVO_API_KEY`, and the daily low stock email is only sent from a production server (so a local server never writes to real people).

**Local without Brevo.** Leave `BREVO_API_KEY` empty. Invitations still work: nothing is sent, but the invitation link is printed in the terminal, open it by hand.

## What happens on start (seeder)

Every start checks and fills in what is missing, it never overwrites anything:

1. If there are no roles: creates the permissions and the roles `super.admin`, `admin`, `user`.
2. Makes sure the super admin from `SUPER_ADMIN_EMAIL` exists.
3. Makes sure the company **DRINK HOUSE** exists (an older company called NakNak is renamed, and gets the data that is printed on documents if it has none).
4. Users without a company are attached to it (there is one company for now).

The seeder does **not** make white label sites. A site is a row of the `clients` table (`name`, `company_id`) that you insert by hand, its `client_id` (a GUID) is the `ACCESS_KEY` of the site. Everything else of the site is filled in in the dashboard.

## How things work

### Login and tokens

`POST /auth/login` returns an `access_token` and a `refresh_token`.

- The access token is a JWT with the email, roles, names, language and `companyId` in it.
- The refresh token is stored in the `validation_tokens` table. `POST /auth/refresh` (public) swaps it for a new pair, the old one stops working.
- A new login removes the older refresh tokens: **one session per user**.

### Roles and who sees what

`super.admin` is above `admin`, `admin` is above `user`.

- Everyone who is logged in can **read** warehouses, drinks, customers and proformas of their own company and **create proformas**.
- `admin` and `super.admin` can create, edit and delete warehouses, drinks and customers, **change** and **return** proformas, invite people, see the users of the company, **import goods from a document** and send the low stock email now.
- Only `super.admin` can create and delete companies.

**Companies are separated.** Every request is checked against the company of the user, asking for something of another company gives `403`. A `super.admin` can access every company.

### Lists: pages, search, errors

- Every list is paginated: `?page=1&limit=10&search=text` (10 per page by default, 100 at most). The answer is `{ items, meta }`. Search ignores the case and takes `%`, `_` and `\` literally.
- Every error has the same body: `{ statusCode, error, message, errors?, path, timestamp }`. `message` is one sentence the dashboard can show as it is, `errors` lists every problem of a validation error. Errors of the database (a taken unique value, a missing column) become a readable `409` / `400`. The text of an unexpected error is never sent out in production, only when `ENVIROMENT` is `local` or `development` (`Server error: <the real cause>`), so a developer sees what went wrong.

### Invitations (the only way to register)

1. An admin sends `POST /invitations` with an email. An invitation is saved (valid **7 days**) and an email goes out with the link `APP_DASHBOARD/first-time-register/<invitationId>`.
2. The dashboard asks `GET /invitations/:id/valid`. If the link is not valid (expired, used, unknown) it says so.
3. The person enters first name, last name and a password (at least 8 characters). The dashboard calls `POST /auth/first-time-register`.
4. The API reads the email from the invitation in the database, creates the user (role `user`, company of the invitation), marks the invitation as accepted and returns the tokens.

Details: inviting the same email again replaces the pending invitation, an email that already has a user gets `409`, and if the email could not be sent the invitation is removed again and the API answers `422`.

**Sending again.** When a link expired (or the email got lost) an admin calls `POST /invitations/:id/resend`. The email goes out again, the expiry starts again (7 days from now) and the invitation keeps its id, so the link in the first email works again too. It is refused with `409` if the invitation was already used or the person already has an account, and if the email cannot be sent the old expiry stays.

### Warehouses, drinks, customers

- `Company 1 → * Warehouse 1 → * Drink`. A drink also stores its `company_id`, so drinks can be searched per company without joins. The article code of a drink is unique inside the company.
- **Default warehouse.** Exactly one warehouse of a company is the default (`isDefault`). The first warehouse of a company becomes the default by itself, making another one the default takes it from the old one, and the default cannot be switched off directly (another warehouse has to become the default). When the default is deleted, the first remaining warehouse takes over. `GET warehouses` returns the default first.
- **Stock levels.** A drink has `warningQuantity` (orange) and `criticalQuantity` (red, has to be bought again), `0` means that level is off, the critical one has to be lower than the warning one. A quantity below zero is always critical. `GET drinks` can filter with `?stockLevel=warning|critical`, `?warehouseId=` and `?search=` (name or code).
- A warehouse **cannot be deleted while it has drinks** (`409`), empty it first.
- A customer has a code and a name, both unique inside the company (the name does not care about the case). `GET customers/options` returns only id and name, for a select.
- Everything is **soft deleted**: rows get `deleted_at` and stay in the table. Normal queries do not see them.

### Proformas

- The number looks like `PR-000001`, it is made from the id.
- **Creating** a proforma runs in one transaction: the drinks are locked and the quantity is taken off the stock. The stock **can go below zero**, the dashboard shows such a drink in red. If two people ask for the same drinks at the same moment, they are served one after the other.
- A line can have its **own price** and a **discount in percent** for this proforma only, the drink keeps its price. Each line keeps a **copy** of the drink name and code, so an old proforma never changes when a drink is edited.
- The buyer (customer) is optional, its name is copied to the proforma.
- **Changing** (`PATCH`, admin) works while the proforma is `active`: the buyer and the lines are replaced and the stock is corrected by the difference, in one transaction.
- **Return to stock** (admin only) adds the quantities back and sets the status to `returned`. It works **once**.
- Money is calculated in cents, so `3 × 0.10` is exactly `0.30`. Prices include 20 % VAT, the VAT is calculated out of the lines (`src/common/helpers/money.helpers.ts`).
- **PDF:** `GET /proformas/:id/pdf`. The layout copies the original document of the accounting software and lives in `src/pdf/services/pdf.service.ts`. It uses the built-in Helvetica, which has no č, ć, đ, š, ž: they are printed as c, c, dj, s, z, like in the original. The things the system does not know yet (unit of measure, weight, the document number is `<id>/<yy>`) are marked in `src/pdf/proforma-pdf.mock.ts`. The amount in words is made by `src/pdf/helpers/number-to-words.ts`.

### Import goods from a document (AI)

An admin uploads a photo or a PDF of a purchase document, only the names and the quantities are used.

1. `POST /purchase-import/parse` (multipart: `file` and `warehouseId`, jpg / png / webp / pdf, up to 10 MB). The file goes to Gemini, which returns the lines, and the name of the document (buyer, kind and number, like `PRIVATNA ZURKA Predracun 40/26`, the file name is shown when there is none). Every line is matched to a drink of the warehouse by its name (the order of the words, the case and diacritics do not matter). **The stock does not change yet.**
2. The admin checks the result: changes the drink or the quantity of a line, skips lines.
3. `POST /purchase-import/apply` adds the checked lines to the stock, all or nothing, in one transaction. A document can be added **in parts**: lines that were left out can be added later. A line that was already added is refused with `409`, so the stock is never counted twice.

What is remembered (tables `purchase_imports` and `purchase_import_items`): who uploaded, when, for which warehouse, the file name, size and SHA-256, the status (`parsing`, `parsed`, `failed`, `applied`), the model, how long it took, the error, **the answer of the AI as JSON** (`ai_response`) and for every line what the AI read, what we matched and what was really added. **The uploaded document itself is never stored**, it only exists in memory while it is read (it holds the data of the customers). The history is `GET /purchase-import` (paginated, search by title or file name), one document is `GET /purchase-import/:id`, `DELETE` removes it from the history (the stock that was added stays).

The AI lives in `src/ai`: `AiService` (limits and retries) and `providers/gemini.provider.ts`. The model, 2 requests at a time and 3 retries (with 1, 2 and 4 seconds in between, for `429` and `5xx`) are constants in `src/ai/ai.constants.ts`, the only setting from the environment is `GEMINI_API_KEY`. No key, a wrong key or no quota gives `503`, any other failure `502`.

### Pictures (Cloudflare R2)

- A picture is made into a **WebP** (quality 80, EXIF rotation applied, metadata dropped, never enlarged) with `sharp`, and uploaded to R2. Upload limit 5 MB. A file that is not an image gives `400`.
- Every picture is a row of the `images` table: `key`, public `url`, owner company, `mimeType`, `size`, `width`, `height`, `altText`. A drink or a site points to it, the old picture is deleted when it is replaced.
- **Folders in the bucket**: `<production|local>/company-<name>-<id>/...`. The top folder is `production` only when `ENVIROMENT=production`, everything else writes to `local`, so testing never touches the real pictures.
  - drinks: `.../drinks/<drinkId>/<time>.webp` (at most 1200 px), `PUT` and `DELETE drinks/:id/image` (admin).
  - a site: `.../client/<general|hero|story|promo|seo>/<time>.webp`. Biggest side: logo 600, hero 2000, story 1200, promo 1200, sharing picture (`og`) 1200.
- Every upload has a new name, so a browser or a CDN never shows an old picture.
- Code: `src/storage` (`StorageService` talks to R2, `ImageOptimizerService`, `ImagesService` keeps the file and the row together).

### White label sites (`clients`)

A **client** is the public site of a company. The `client_id` is a GUID and it is the `ACCESS_KEY` the site sends in the header `X-Access-Key`.

**Status.** A site is a `draft` until the admin publishes it. A draft site shows only a "coming soon" page and is hidden from Google. `POST /website/publish` works only when the site is **complete**, otherwise `400` lists what is missing (`GET /website` also returns `completeness.missing`). Needed: all general info (name, city, address, phone, Instagram, opening hours) and the logo, every text of hero, featured, story and promo, the pictures of hero, story and promo, at least one recommended drink, and the SEO texts and the sharing picture. `POST /website/unpublish` takes it back to a draft.

**What the admin edits** (`GET`/`PATCH /website`, pictures `PUT`/`DELETE /website/images/:slot` with the slots `logo`, `hero`, `story`, `promo`, `og`):

- general info in columns: city, address, phone, Instagram, opening hours (one day per line, up to 500 characters),
- the texts of the sections in the `sections` column (JSON): `hero`, `featured` (title, button and the picked drinks), `story`, `promo`, `seo` (title and description of the site and of the menu page: 70 and 160 characters at most),
- the pictures as rows of `images` (`logo`, `hero`, `story`, `promo`, `og`).

A form of one tab sends only its own fields. **A field that is sent can not be empty** (`400`), the phone and the Instagram address are checked. The picked drinks have to belong to the company. The messages from the contact form are `GET /website/contacts` (paginated, newest first). A company can have more sites, the oldest one is managed. A company without a site gets `404` from `GET /website` (the dashboard hides the menu item then).

**What the site reads (no login, header `X-Access-Key`).** A missing or unknown key is `401`.

- `GET /public/site`: status, general info, every section with its texts and pictures, the recommended drinks and the SEO data. A text that is not filled in is `null`.
- `GET /public/drinks?page=&limit=`: the drinks of the company (name, price, in stock or not, picture), nothing about warehouses or stock numbers.
- `POST /public/contact`: saves a message in `clients_contacted_by` (name and phone are required, email and message are not). Limited to **5 per minute** per address (`@nestjs/throttler`).

**Fresh content.** The site keeps what it reads in a cache. After the admin saves something the API calls `POST <APP_CLIENT>/api/revalidate` (header `x-revalidate-secret`, `REVALIDATE_SECRET`) of every address in `APP_CLIENT`, so the change shows at once. If a site does not answer, the request of the admin still succeeds (`SiteRevalidationService`).

### Low stock email

Every day at 8:00 (Belgrade time), on a production server only, every employee of every company gets one email with what is low: red (has to be bought again) and orange (warning), the emptiest first, in the language of the person. Nothing is sent to a company that has nothing low. An admin can send it now with `POST /stock-alerts/digest`.

### Emails

Two services on purpose:

- `BrevoService` only talks to the Brevo API (HTTP, no extra library).
- `MailerService` knows what the emails are: template, subject, data. Templates are in `src/mailer/templates` (`first-time-register.html`, `stock-digest.html`) and must use **inline styles only**, because the placeholder replacement (`{link}`, `{valid_days}`) would eat the braces of a `<style>` block. The names typed by people are escaped before they go into the html. Outside of production the subject starts with `[LOCAL]`.

## Endpoints

Everything is under `/api`. All need a login except where it says public.

| Area | Endpoints |
| --- | --- |
| Auth | `POST auth/login` (public), `auth/refresh` (public), `auth/first-time-register` (public), `auth/is-user-token-valid` (public), `auth/logout` |
| Users | `GET users/profile`, `PATCH users/profile` (phone, date of birth, language), `GET users` (super admin) |
| Invitations | `POST invitations` (admin), `GET invitations` (admin), `POST invitations/:id/resend` (admin), `GET invitations/:id/valid` (public) |
| Companies | `GET companies`, `GET companies/:id`, `GET companies/:id/users` (admin), `POST companies` (super admin), `PATCH companies/:id` (admin), `DELETE companies/:id` (super admin) |
| Warehouses | `GET warehouses`, `GET warehouses/:id`, `POST` `PATCH` `DELETE` (admin, with `isDefault`) |
| Drinks | `GET drinks` (`?warehouseId=` `?stockLevel=` `?search=`), `GET drinks/:id`, `POST` `PATCH` `DELETE` (admin), `PUT` / `DELETE drinks/:id/image` (admin, the picture of a drink) |
| Customers | `GET customers`, `GET customers/options`, `GET customers/:id`, `POST` `PATCH` `DELETE` (admin) |
| Proformas | `GET proformas`, `GET proformas/:id`, `POST proformas`, `PATCH proformas/:id` (admin), `GET proformas/:id/pdf`, `POST proformas/:id/return` (admin) |
| Purchase import | all admin: `POST purchase-import/parse`, `POST purchase-import/apply`, `GET purchase-import`, `GET purchase-import/:id`, `DELETE purchase-import/:id` |
| Stock alerts | `POST stock-alerts/digest` (admin) |
| Website | all admin: `GET website`, `PATCH website`, `PUT` / `DELETE website/images/:slot`, `POST website/publish`, `POST website/unpublish`, `GET website/contacts` |
| Public (header `X-Access-Key`) | `GET public/site`, `GET public/drinks`, `POST public/contact` |

## Project structure

```
src/
  auth/              login, tokens, roles, guards, decorators
  users/             user entity, profile
  invitations/       invite and validate
  companies/         companies and their users
  warehouses/        warehouses (default one)
  drinks/            drinks (with their picture)
  clients/           white label sites: admin (website), public routes, contact messages, publish
  storage/           Cloudflare R2, image optimization (WebP), the `images` table
  customers/         customers
  proformas/         proformas, stock, return
  purchase-import/   import goods from a document: parse, apply, history
  ai/                the AI (Gemini): service, provider, constants
  stock-alerts/      the daily low stock email
  pdf/               PDF generator, amount in words
  mailer/            BrevoService, MailerService, templates, texts
  seeder/            first data on start
  validation-token/  refresh tokens
  migrations/        database migrations
  db/                data source of the migrations, ssl setting
  common/            shared: audit columns, helpers (money, urls, query), filters, enums
  main.ts            bootstrap, Swagger, CORS
```

Each feature folder is `entities/`, `dto/`, `services/`, `controllers/` and a `*.module.ts`. Entities share `created_at`, `updated_at`, `deleted_at` from `common/entities/audit.entity.ts`.

## Migrations

Changes of the database go through migrations in `src/migrations` (TypeORM, files are named `<timestamp>-<Name>.ts`).

| Command | What it does |
| --- | --- |
| `pnpm migration:run` | Runs the migrations that have not run yet. |
| `pnpm migration:show` | Lists them and shows which ran. |
| `pnpm migration:revert` | Takes back the last one. |
| `pnpm migration:create src/migrations/Name` | Makes an empty migration to fill in. |
| `pnpm migration:generate` | Makes a migration out of the difference between the entities and the database. |

- Write `IF NOT EXISTS` / `IF EXISTS` in them, so a database that `synchronize` already changed (see below) does not make them fail.
- A migration is never edited after it ran anywhere, a new one is added instead.
- **`synchronize: true` is still on** (`app.module.ts`), so the schema also follows the entities by itself. The migrations do not build the schema from zero, they are the changes on top of it (a new database: start the API once, then `pnpm migration:run`). Before there is real data that matters, turn `synchronize` off and add a baseline migration of the whole schema.

## Tests

```bash
pnpm test          # all tests, about 760, a few seconds
pnpm test:watch    # re-run on every change
pnpm test:cov      # with the coverage
```

Unit tests with Jest, a `*.spec.ts` next to the code it tests. **They do not need a database**: repositories and other services are mocks (`Test.createTestingModule` and `useValue`), the AI and the mail provider too. Services are tested the most (rules, errors, the stock), controllers check what is passed on and **who may call what** (`rolesOf` in `src/common/testing`), plus guards, helpers and the PDF.

When you add a feature: test the happy path, every thrown error, and the rule that would hurt the most if it broke (for example the stock that must not be counted twice). `pnpm test` also has to pass before a deploy, see below.

## Deploy (Railway)

| Setting | Value |
| --- | --- |
| Build | default (`pnpm install`, `pnpm build`) |
| **Pre-deploy command** | `pnpm test && pnpm migration:run` |
| Start | default (`pnpm start`, that is `node dist/main`) |
| Variables | all from the table above, with `ENVIROMENT=production`, a real `APP_DASHBOARD`, the domains of the sites in `APP_CLIENT`, `BREVO_*`, `GEMINI_API_KEY`, `R2_*`, `REVALIDATE_SECRET` |

The pre-deploy command runs between the build and the start: if a test or a migration fails the new version is not started and the old one keeps running. **Do not put it in "Custom Start Command"**, then the container runs the tests and exits and the API never starts. Alternatively run the tests on GitHub (a workflow) and turn on **Wait for CI** on Railway.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm start:dev` | Run with auto restart. |
| `pnpm build` then `pnpm start` | Production build and run (`pnpm start` runs `node dist/main`, so it needs the build first; hosts like Railway do both). |
| `pnpm test` | Unit tests. |
| `pnpm lint` | ESLint. |
| `pnpm format` | Prettier. |
| `pnpm migration:*` | Migrations, see above. |

## Good to know

- **`sharp` is pinned to 0.34.** Version 0.35 has a different CommonJS export that does not work without `esModuleInterop`. It is imported as `import * as sharp from 'sharp'`.
- **Restart after adding a dependency.** `pnpm start:dev` decides at startup which packages are not bundled. A package installed while it runs gets bundled and breaks (this happened with `pdfkit`). Stop it and start it again.
- **Enum columns need an explicit type**, like `@Column({ type: 'varchar', ... })`. The webpack build loses the enum type and TypeORM fails with `Data type "Object" is not supported`.
- **Test with the real build** when something looks different from production: `pnpm build` and `node dist/main`, not only `ts-node`.
- **Do not import `Response` from `express` as a value** in a controller. With decorators it becomes a `require('express')`, which pnpm does not expose. Use `import type`.
- **`tsconfig.json` lists `types`** (`node`, `jest`, `multer`). TypeScript 6 (the one built into VS Code) no longer loads the `@types` packages by itself, without the list the editor does not know `describe` or `Express.Multer`. A new global type package has to be added there.
- **The AI can be unavailable.** A Gemini model can answer `503` when it is busy (the retries cover short peaks) or `429` when the quota is over. If you change the model in `ai.constants.ts`, upload a real document first.
