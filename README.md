# DH API

This is the backend of **DH**, an app that helps drink shops keep track of their stock, write proformas (price quotes) for their customers and run their own public website, with online orders if they want them.

It's a NestJS app on top of PostgreSQL (through TypeORM). Two frontends talk to it: the admin app in `dh-dashboard` and the public shop sites in `dh-client`. Pictures live in Cloudflare R2 and emails go out through Brevo.

Once it's running locally, the API is at `http://localhost:4200/api`, and the same address opens Swagger, where you can browse and try every endpoint.

## What it does

- **Warehouses and drinks.** A company has one or more warehouses, and each warehouse holds drinks with a price, a quantity in stock and two alert levels (warning and critical). One warehouse is the company's **default**, and it's preselected everywhere you pick a warehouse.
- **Categories.** Each company sorts its drinks into its own categories (Pivo, Vino, ...). A drink can sit in several categories. The dashboard and the site both filter by them, and on the site every category gets its own page (`/karta-pica/vino`).
- **Customers and proformas.** You pick a warehouse, add drinks and quantities, optionally a customer, and the proforma is created. The drinks come off the stock right away. Proformas can be edited, returned to stock and downloaded as a PDF.
- **Importing goods from a document.** An admin uploads a photo or a PDF of a purchase invoice, the AI reads the drinks and quantities, the admin checks them and adds them to the stock. Every upload is kept in a history.
- **Low stock email.** Every morning each employee gets one email listing what is running low.
- **Invite-only accounts.** Nobody can sign up on their own. An admin invites an email address, the person gets a link and finishes the registration there.
- **Public shop sites.** A company can have its own website (the `dh-client` app). The admin manages its texts, pictures, SEO and contact details in the dashboard and publishes it when it's ready. Visitors can send a message through the contact form.
- **Online orders.** If ordering is turned on for a site, visitors can fill a cart and send an order. The shop's courier delivers it. Employees get an email about every new order and move it through its statuses in the dashboard, and the buyer gets a confirmation email.

There are three roles: `super.admin`, `admin` and `user`. Every user picks their own language (English or Serbian).

## Getting started

You'll need Node 24 or newer (production runs Node 26, see `.nvmrc`), pnpm and PostgreSQL.

```bash
# 1. A database. Skip this if you already have Postgres with a database called "dh".
../dh-db.sh                  # starts it in Docker, or run it yourself:
                             # docker run -d --name dh-db -e POSTGRES_USER=root -e POSTGRES_PASSWORD=password \
                             #   -e POSTGRES_DB=dh -p 5432:5432 postgres:16

# 2. Settings
cp .env.example .env         # then fill in the empty values, see "Environment variables"

# 3. Run it
pnpm install
pnpm start:dev
```

The first start creates the tables and seeds the first data (more on that below). After that, run `pnpm migration:run` once, then log in to the dashboard with `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from your `.env`.

Please install with **pnpm**, not npm. There's a small patch in `patches/` that only pnpm applies, and without it the API won't start on Node 25+ (see "Good to know").

## Environment variables

| Variable                                                  | What it's for                                                                                                                                                                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENVIROMENT`                                              | `local` or `production`. Yes, it's spelled like that. Production is stricter, see below.                                                                                                                                                            |
| `PORT`                                                    | The port the API listens on, `4200`.                                                                                                                                                                                                                |
| `DB_HOST` `DB_PORT` `DB_USERNAME` `DB_PASSWORD` `DB_NAME` | The PostgreSQL connection.                                                                                                                                                                                                                          |
| `DB_SSL`                                                  | `true` or `false` to force an encrypted connection. If you leave it out, SSL is on everywhere except with `ENVIROMENT=local`.                                                                                                                       |
| `JWT_SECRET`                                              | Signs the login tokens. Use a long random value in production.                                                                                                                                                                                      |
| `JWT_EXPIRE` / `JWT_REFRESH_EXPIRE`                       | How long the access token (`10m`) and the refresh token (`30m`) live.                                                                                                                                                                               |
| `APP_CLIENT`                                              | The addresses of the shop sites, comma separated. CORS allows them next to the dashboard, and the API tells them to refresh their cache after a change. Locally it defaults to `http://localhost:4350`. In production only the listed domains work. |
| `APP_DASHBOARD`                                           | The address of the dashboard. It's used in the links inside emails and it's the main origin CORS allows. Locally `http://localhost:4300`, in production your real domain.                                                                           |
| `APP_NAME`                                                | The name of the app.                                                                                                                                                                                                                                |
| `BREVO_API_KEY`                                           | Your Brevo API key (SMTP & API → API keys).                                                                                                                                                                                                         |
| `MAIL_FROM_EMAIL` / `MAIL_FROM_NAME`                      | The sender of the emails. The address has to be a verified sender in Brevo.                                                                                                                                                                         |
| `BREVO_SANDBOX`                                           | `true` makes Brevo only validate the request and deliver nothing. Handy locally, because `false` really sends emails to real people.                                                                                                                |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`              | The first super admin, created by the seeder. Change the password.                                                                                                                                                                                  |
| `R2_ACCOUNT_ID` `R2_ACCESS_KEY` `R2_SECRET_ACCESS_KEY`    | Credentials for the Cloudflare R2 bucket (Manage R2 API Tokens).                                                                                                                                                                                    |
| `R2_BUCKET_NAME`                                          | The bucket name, for example `dh-images`.                                                                                                                                                                                                           |
| `R2_ENDPOINT`                                             | The S3 address of R2 (`https://<account>.r2.cloudflarestorage.com`). If it ends with the bucket name, that part is ignored.                                                                                                                         |
| `R2_PUBLIC_URL`                                           | The public address of the bucket (`https://pub-....r2.dev` or your own domain such as `https://images.drinkhouse.rs`). A picture's address is this plus its key. Only keys are stored, so changing it moves every picture at once.                  |
| `REVALIDATE_SECRET`                                       | A secret shared with the shop sites. After a change in the dashboard the API calls `<APP_CLIENT>/api/revalidate` with it, so the change shows immediately. Use the same value in `dh-client`. Without it, changes show up within a minute or so.    |
| `GEMINI_API_KEY`                                          | A Google Gemini key (aistudio.google.com/apikey), used to read uploaded purchase documents. Without it the import answers `503`, everything else works.                                                                                             |

**Production rules.** With `ENVIROMENT=production` the API refuses to start if `APP_DASHBOARD` is empty or points to `localhost`, it won't send emails without `BREVO_API_KEY`, and the daily low stock email only goes out from a production server, so a local copy never writes to real people. Outside production every email subject starts with `[LOCAL]`.

**Working locally without Brevo.** Leave `BREVO_API_KEY` empty. Invitations still work: nothing is sent, but the invitation link is printed in the terminal so you can open it yourself.

## What happens on startup

Every start checks a few things and fills in only what's missing. It never overwrites anything:

1. If there are no roles yet, it creates the permissions and the roles `super.admin`, `admin` and `user`.
2. It makes sure the super admin from `SUPER_ADMIN_EMAIL` exists.
3. It makes sure the company **DRINK HOUSE** exists. An older company called NakNak is renamed to it and gets the details printed on documents if it has none.
4. Users without a company are attached to it (there's only one company for now).

The seeder doesn't create shop sites. A site is a row in the `clients` table, and its `client_id` (a GUID) is the `ACCESS_KEY` the site uses. Create one with `scr/create_client.py` in the workspace folder (see "Data scripts"). Until a company has a site, the dashboard doesn't show the "Web sajt" page.

## How it works

### Logging in

`POST /auth/login` returns an `access_token` and a `refresh_token`.

- The access token is a JWT that carries the user's email, roles, name, language and `companyId`.
- The refresh token is stored in `validation_tokens`. `POST /auth/refresh` swaps it for a fresh pair and the old one stops working.
- Logging in again removes older refresh tokens, so each user has **one session** at a time.

### Roles and companies

`super.admin` can do everything an `admin` can, and an `admin` can do everything a `user` can.

- Every logged-in user can **read** the warehouses, drinks, customers, proformas and orders of their own company, **create proformas** and change the status of orders.
- Admins can also create, edit and delete warehouses, drinks, categories and customers, edit and return proformas, invite people, see the company's users, import goods from documents and trigger the low stock email.
- Only a super admin can create and delete companies.

**Companies never see each other's data.** Every request is checked against the user's company, and asking for something that belongs to another company returns `403`. A super admin can reach every company.

### Lists, search and errors

- Every list is paginated: `?page=1&limit=10&search=text` (10 per page by default, 100 at most). The answer looks like `{ items, meta }`. Search ignores case and treats `%`, `_` and `\` as plain characters.
- Every error has the same shape: `{ statusCode, error, message, errors?, path, timestamp }`. `message` is a single sentence the dashboard can show as is, and `errors` lists each problem of a validation error. Database errors (a value that's already taken, a missing column) are turned into a readable `409` or `400`. The text of an unexpected error is never sent out in production. With `ENVIROMENT` set to `local` or `development` you get `Server error: <the real cause>`, so you can see what broke.

### Invitations

Invitations are the only way to get an account.

1. An admin sends `POST /invitations` with an email. The invitation is valid for **7 days**, and an email goes out with the link `APP_DASHBOARD/first-time-register/<invitationId>`.
2. The dashboard checks the link with `GET /invitations/:id/valid` and says so if it's expired, already used or unknown.
3. The person enters their first name, last name and a password (at least 8 characters), and the dashboard calls `POST /auth/first-time-register`.
4. The API takes the email from the invitation, creates the user (role `user`, the invitation's company), marks the invitation as accepted and logs the person in.

Inviting the same email again replaces the pending invitation. An email that already belongs to a user gets `409`. If the email can't be sent, the invitation is removed again and the API answers `422`.

### Warehouses, drinks and customers

- The model is `Company 1 → * Warehouse 1 → * Drink`. A drink also stores its `company_id`, so company-wide searches don't need joins. Article codes are unique within a company.
- **The default warehouse.** Exactly one warehouse per company is the default (`isDefault`). The first warehouse becomes the default on its own. Making another one the default takes the flag away from the old one, and you can't simply switch it off (another warehouse has to take over). When the default is deleted, the first remaining warehouse becomes the default. `GET warehouses` lists the default first.
- **Stock levels.** A drink has a `warningQuantity` (orange) and a `criticalQuantity` (red, needs to be bought again). `0` turns a level off, and the critical level has to be lower than the warning level. A quantity below zero always counts as critical.
- `GET drinks` can filter by `?warehouseId=`, `?stockLevel=warning|critical`, `?categoryIds=1,4` (drinks in any of these categories) and `?search=` (name or code).
- A warehouse **can't be deleted while it still has drinks** (`409`). Empty it first.
- A customer has a code and a name, both unique within the company (the name check ignores case). `GET customers/options` returns just ids and names for a select.
- Nothing is really deleted. Rows get a `deleted_at` date and normal queries simply don't see them.

### Categories

- Each company has its own categories. Drinks and categories are linked many-to-many through `drink_categories`, one row per drink and category. The table has an index on `category_id`, because the site's menu filters by it all the time.
- Category names are unique within a company, ignoring case (`409`). Each category also gets a **slug** made from its name (`Točeno pivo` → `toceno-pivo`, with `-2` added if it's taken), and the site uses it in the address. Renaming a category changes its slug.
- You put a drink into categories by sending `categoryIds` with `POST` or `PATCH drinks`. The list replaces the old one, and `[]` removes them all. A category from another company is rejected with `400`.
- The filter is a subquery (`src/categories/category.filter.ts`), so a filtered drink still comes back with **all** of its categories, not just the matching one.
- Deleting a category takes its drinks out of it. The drinks themselves stay.
- `GET categories` returns every category with a `drinksCount`. `GET public/drinks/categories` returns only the ones that actually have drinks.

### Proformas

- Proforma numbers look like `PR-000001` and come from the id.
- **Creating** a proforma happens in one transaction: the drinks are locked and their quantities are taken off the stock. Stock **may go below zero**, and the dashboard shows those drinks in red. If two people order the same drinks at the same moment, they're served one after the other.
- Each line can have its **own price** and a **discount in percent** that apply to this proforma only, and the drink keeps its normal price. Every line keeps a **copy** of the drink's name and code, so old proformas never change when a drink is edited.
- The customer is optional. If there is one, their name is copied onto the proforma.
- **Editing** (`PATCH`, admins only) works while the proforma is `active`. The customer and the lines are replaced, and the stock is corrected by the difference, all in one transaction.
- **Returning to stock** (admins only) adds the quantities back and sets the status to `returned`. It can only happen once.
- Money is calculated in cents, so `3 × 0.10` is exactly `0.30`. Prices include 20% VAT, and the VAT is worked out from the lines (`src/common/helpers/money.helpers.ts`).
- **PDF.** `GET /proformas/:id/pdf` produces a PDF that copies the layout of the accounting software's original (`src/pdf/services/pdf.service.ts`). It uses the built-in Helvetica font, which has no č, ć, đ, š or ž, so they're printed as c, c, dj, s and z, just like the original. Details the system doesn't know yet (unit of measure, weight, the `<id>/<yy>` document number) are marked in `src/pdf/proforma-pdf.mock.ts`. The amount in words comes from `src/pdf/helpers/number-to-words.ts`.

### Importing goods from a document (AI)

An admin uploads a photo or PDF of a purchase invoice. Only the drink names and quantities are used.

1. `POST /purchase-import/parse` takes a multipart `file` (jpg, png, webp or pdf, up to 10 MB) and a `warehouseId`. Gemini reads the document and returns its lines, plus a title like `PRIVATNA ZURKA Predracun 40/26` (the file name is used if there isn't one). Each line is matched to a drink in that warehouse by name, ignoring word order, case and diacritics. **The stock doesn't change yet.**
2. The admin reviews the result: they can change the matched drink or the quantity of any line, or skip lines.
3. `POST /purchase-import/apply` adds the reviewed lines to the stock in one transaction, all or nothing. A document can be added **in parts**, so skipped lines can be added later. A line that was already added is rejected with `409`, so nothing is ever counted twice.

The tables `purchase_imports` and `purchase_import_items` remember who uploaded what and when, for which warehouse, the file name, size and SHA-256, the status (`parsing`, `parsed`, `failed`, `applied`), the model, how long it took, any error, **the raw AI answer as JSON** (`ai_response`), and for every line what the AI read, what it was matched to and what was actually added. **The document itself is never stored.** It only exists in memory while it's being read, because it holds customer data. The history is `GET /purchase-import` (paginated, searchable by title or file name), a single upload is `GET /purchase-import/:id`, and `DELETE` removes it from the history (the stock that was added stays).

The AI code lives in `src/ai`: `AiService` handles limits and retries, and `providers/gemini.provider.ts` talks to Gemini. The model, the limit of 2 parallel requests and 3 retries (waiting 1, 2 and 4 seconds, on `429` and `5xx`) are constants in `src/ai/ai.constants.ts`. The only setting from the environment is `GEMINI_API_KEY`. A missing or wrong key, or an exhausted quota, gives `503`, and any other failure gives `502`.

### Pictures (Cloudflare R2)

- Every uploaded picture is converted to **WebP** with `sharp` (quality 80, EXIF rotation applied, metadata dropped, never upscaled) and uploaded to R2. The upload limit is 5 MB, and a file that isn't an image gets `400`.
- Each picture is a row in `images`: `key`, public `url`, the owning company, `mimeType`, `size`, `width`, `height` and `altText`. Drinks and sites point to these rows, and an old picture is deleted when it's replaced.
- Files are stored under `<production|local>/company-<name>-<id>/...`. The top folder is `production` only with `ENVIROMENT=production`. Everything else writes to `local`, so testing never touches real pictures.

### Public shop sites (`clients`)

A **client** is the public website of a company. Its `client_id` is a GUID, and it's the `ACCESS_KEY` the site sends in the `X-Access-Key` header.

**Draft and published.** A site is a `draft` until an admin publishes it. A draft shows only a "coming soon" page and stays hidden from Google. `POST /website/publish` works only once the site is **complete**, otherwise it returns `400` with a list of what's missing (`GET /website` also returns it in `completeness.missing`). A complete site has all the general info (name, city, address, phone, Instagram, opening hours), the logo, every text of the hero, featured, story and promo sections, the hero, story and promo pictures, the recommended drinks (an even number, because the site shows them in pairs), and the SEO texts and sharing picture. `POST /website/unpublish` turns it back into a draft.

**What the admin edits** with `GET` and `PATCH /website`, and with `PUT` / `DELETE /website/images/:slot` for the `logo`, `hero`, `story`, `promo` and `og` pictures:

- general info, stored in columns: city, address, phone, Instagram and opening hours (one day per line, up to 500 characters),
- the section texts, stored as JSON in the `sections` column: `hero`, `featured` (title, button and the hand-picked drinks), `story`, `promo` and `seo` (title and description of the site and the menu page, 70 and 160 characters at most),
- the pictures, stored as rows in `images`.

Each tab of the dashboard sends only its own fields, and **a field that's sent can't be empty** (`400`). Phone numbers and the Instagram address are validated, and the recommended drinks have to belong to the company. Messages from the contact form are at `GET /website/contacts` (paginated, newest first). If a company has more than one site, the oldest one is the one being managed. A company without a site gets `404` from `GET /website`, and the dashboard hides the menu item.

**What the site reads.** These routes need no login, just the `X-Access-Key` header. A missing or unknown key gets `401`.

- `GET /public/site`: the status, general info, every section with its texts and pictures, the recommended drinks, the SEO data and `isOrderingAllowed`. Anything that isn't filled in comes back as `null`.
- `GET /public/drinks?page=&limit=&search=&categoryIds=`: the company's drinks with name, price, whether they're in stock, and picture. Nothing about warehouses or stock numbers.
- `GET /public/drinks/categories`: the categories that have drinks (id, name, slug and count), used by the site's menu.
- `POST /public/contact`: saves a contact form message in `clients_contacted_by` (name and phone are required, email and message aren't). Limited to **5 per minute** per IP address.
- `POST /public/orders`: sends an order from the cart, see "Orders". Also limited to **5 per minute** per IP address.

**Ordering** is off for every site by default (`clients.is_ordering_allowed = false`). For now you turn it on directly in the database. The site reads the flag from `GET /public/site`, and the dashboard asks `GET /orders/enabled` before it shows the Orders page.

**Keeping the sites fresh.** The sites cache what they read. After an admin saves something, the API calls `POST <APP_CLIENT>/api/revalidate` on every address in `APP_CLIENT` (with the `x-revalidate-secret` header), so the change shows right away. If a site doesn't answer, the admin's request still succeeds (`SiteRevalidationService`).

### Orders

- An order comes from a site's cart through `POST /public/orders`. It carries the buyer's full name, email, phone, **delivery address**, the **delivery day**, and the drinks as ids with quantities. If the site doesn't allow ordering, the request is rejected with `403`.
- **The delivery day** is a plain date without a time, in Serbian time. It can be today, or from tomorrow if the order comes in after 15:00, and at most one month ahead. The rules are in `src/orders/pickup-date.ts`, and the site keeps an identical copy so it can offer only valid days. The shop's courier delivers the order on that day.
- **Names and prices always come from the database**, never from the site, and they're copied onto the order lines (`order_items`), so an order never changes when a drink is edited later. A drink that isn't on the company's menu is rejected with `400`. An order can have up to 50 drinks, with 1 to 999 of each.
- Once the order is saved, **every employee** of the company gets a "Nova porudžbina" email and **the buyer** gets "Porudžbina je primljena". If an email fails, the order is still saved and the failure is only logged.
- **Statuses** are `new`, `in_progress` (the courier has it), `delivered` and `cancelled`. Employees can set any status, including going back after a mistake. Only a **cancellation** is sent to the buyer, as an email with the reason if one was given. The reason is optional, up to 500 characters, and stored in `cancel_reason`. Cancelling an order that's already cancelled doesn't send a second email.
- For the dashboard there's `GET orders` (with `?status=`), `GET orders/:id` (with its drinks) and `PATCH orders/:id/status` (`{ status, reason? }`). Every employee can use them.

### Low stock email

Every day at 8:00 Belgrade time, on a production server only, each employee of every company gets one email with what's running low: red items (need to be bought again) and orange items (warning), emptiest first, in the person's language. Companies with nothing low get no email. An admin can send it right away with `POST /stock-alerts/digest`.

### Emails

Sending is split into two services on purpose:

- `BrevoService` only talks to the Brevo API (over HTTP, no extra library).
- `MailerService` knows what each email is: which template, which subject and which data.

The templates are in `src/mailer/templates`: `first-time-register.html`, `stock-digest.html`, and for orders `order-new.html` (to employees), `order-received.html` and `order-cancelled.html` (to the buyer). Their words are in `src/mailer/texts`. Templates must use **inline styles only**, because the placeholder replacement (`{link}`, `{title}`, ...) would break the braces of a `<style>` block. Anything a person typed, like names, addresses or cancellation reasons, is escaped before it goes into the HTML.

## Endpoints

Everything lives under `/api`, and everything needs a login unless it says public. Swagger has the full details.

| Area                           | Endpoints                                                                                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                           | `POST auth/login`, `auth/refresh`, `auth/first-time-register`, `auth/is-user-token-valid` (all public), `auth/logout`                                                                          |
| Users                          | `GET users/profile`, `PATCH users/profile` (phone, date of birth, language), `GET users` (super admin)                                                                                         |
| Invitations                    | `POST invitations`, `GET invitations`, `POST invitations/:id/resend` (all admin), `GET invitations/:id/valid` (public)                                                                         |
| Companies                      | `GET companies`, `GET companies/:id`, `GET companies/:id/users` (admin), `POST companies` (super admin), `PATCH companies/:id` (admin), `DELETE companies/:id` (super admin)                   |
| Warehouses                     | `GET warehouses`, `GET warehouses/:id`, `POST` / `PATCH` / `DELETE` (admin)                                                                                                                    |
| Drinks                         | `GET drinks` (`?warehouseId=` `?stockLevel=` `?categoryIds=` `?search=`), `GET drinks/:id`, `POST` / `PATCH` / `DELETE` (admin, with `categoryIds`), `PUT` / `DELETE drinks/:id/image` (admin) |
| Categories                     | `GET categories` (with `drinksCount`), `POST` / `PATCH` / `DELETE` (admin)                                                                                                                     |
| Customers                      | `GET customers`, `GET customers/options`, `GET customers/:id`, `POST` / `PATCH` / `DELETE` (admin)                                                                                             |
| Proformas                      | `GET proformas`, `GET proformas/:id`, `POST proformas`, `PATCH proformas/:id` (admin), `GET proformas/:id/pdf`, `POST proformas/:id/return` (admin)                                            |
| Orders                         | `GET orders` (`?status=`), `GET orders/enabled`, `GET orders/:id`, `PATCH orders/:id/status`                                                                                                   |
| Purchase import                | all admin: `POST purchase-import/parse`, `POST purchase-import/apply`, `GET purchase-import`, `GET purchase-import/:id`, `DELETE purchase-import/:id`                                          |
| Stock alerts                   | `POST stock-alerts/digest` (admin)                                                                                                                                                             |
| Website                        | all admin: `GET website`, `PATCH website`, `PUT` / `DELETE website/images/:slot`, `POST website/publish`, `POST website/unpublish`, `GET website/contacts`                                     |
| Public (header `X-Access-Key`) | `GET public/site`, `GET public/drinks`, `GET public/drinks/categories`, `POST public/contact`, `POST public/orders`                                                                            |

## Project structure

```
src/
  auth/              login, tokens, roles, guards, decorators
  users/             the user entity and profile
  invitations/       inviting and validating invitations
  companies/         companies and their users
  warehouses/        warehouses and the default one
  drinks/            drinks, their pictures and categories
  categories/        categories and the filter by category
  customers/         customers
  proformas/         proformas, stock, returns
  orders/            orders from the sites: delivery day rules, statuses, emails
  purchase-import/   importing goods from a document: parse, apply, history
  clients/           shop sites: what the admin edits, the public routes, contact messages, publishing
  storage/           Cloudflare R2, WebP conversion, the images table
  ai/                the AI (Gemini): service, provider, constants
  stock-alerts/      the daily low stock email
  pdf/               the PDF generator, amount in words
  mailer/            BrevoService, MailerService, templates and their texts
  seeder/            the first data on startup
  validation-token/  refresh tokens
  migrations/        database migrations
  db/                the data source for migrations, SSL setting
  common/            shared pieces: audit columns, helpers (money, urls, slugs, queries), filters, enums
  main.ts            bootstrap, Swagger, CORS
```

Every feature folder follows the same layout: `entities/`, `dto/`, `services/`, `controllers/` and a `*.module.ts`. All entities share `created_at`, `updated_at` and `deleted_at` from `common/entities/audit.entity.ts`.

## Migrations

Database changes go through migrations in `src/migrations` (TypeORM, named `<timestamp>-<Name>.ts`).

| Command                                     | What it does                                                       |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm migration:run`                        | Runs every migration that hasn't run yet.                          |
| `pnpm migration:show`                       | Lists the migrations and shows which have run.                     |
| `pnpm migration:revert`                     | Undoes the last one.                                               |
| `pnpm migration:create src/migrations/Name` | Creates an empty migration for you to fill in.                     |
| `pnpm migration:generate`                   | Generates a migration from the difference between entities and DB. |

A few rules:

- Use `IF NOT EXISTS` / `IF EXISTS`, so a migration doesn't fail on a database that `synchronize` already changed (see below).
- Never edit a migration after it has run anywhere. Add a new one instead.
- **`synchronize: true` is still on** in `app.module.ts`, so the schema also follows the entities on its own. The migrations don't build the schema from scratch, they're the changes on top of it. For a new database, start the API once and then run `pnpm migration:run`. Give constraints and indexes the same explicit names in the entity and the migration (see `drink_categories` or `orders`), otherwise `synchronize` will keep renaming them on every start. You can check with `pnpm typeorm schema:log -d src/db/data-source.ts`. Before there's real data that matters, turn `synchronize` off and add a baseline migration.

## Tests

```bash
pnpm test          # every test (about 840), takes a few seconds
pnpm test:watch    # re-runs on every change
pnpm test:cov      # with coverage
```

These are Jest unit tests, each `*.spec.ts` sitting next to the code it tests. **They don't need a database.** Repositories and other services are mocked (`Test.createTestingModule` with `useValue`), and so are the AI and the mail provider. Services are tested the most (rules, errors, stock), controllers check what they pass on and **who is allowed to call what** (`rolesOf` in `src/common/testing`), and there are tests for guards, DTO validation, helpers and the PDF.

When you add a feature, test the happy path, every error it can throw, and the rule that would hurt most if it broke, for example stock that must never be counted twice. `pnpm test` also runs before every deploy, see below.

## Deploying (Railway)

| Setting                | Value                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build                  | the default (`pnpm install`, `pnpm build`)                                                                                                                                                        |
| **Pre-deploy command** | `pnpm test && pnpm migration:run`                                                                                                                                                                 |
| Start                  | the default (`pnpm start`, which is `node dist/main`)                                                                                                                                             |
| Variables              | everything from the table above, with `ENVIROMENT=production`, a real `APP_DASHBOARD`, the sites' domains in `APP_CLIENT`, the `BREVO_*` values, `GEMINI_API_KEY`, `R2_*` and `REVALIDATE_SECRET` |

The pre-deploy command runs between the build and the start. If a test or a migration fails, the new version isn't started and the old one keeps running. **Don't put it in "Custom Start Command"**: the container would run the tests, exit, and the API would never start. Another option is to run the tests on GitHub and turn on **Wait for CI** in Railway.

## Scripts

| Command                        | What it does                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `pnpm start:dev`               | Runs the API and restarts it on every change.                                                                  |
| `pnpm build` then `pnpm start` | Production build and run. `pnpm start` runs `node dist/main`, so it needs the build first (Railway does both). |
| `pnpm test`                    | Unit tests.                                                                                                    |
| `pnpm lint`                    | ESLint.                                                                                                        |
| `pnpm format`                  | Prettier.                                                                                                      |
| `pnpm migration:*`             | Migrations, see above.                                                                                         |

## Data scripts

The workspace folder next to the repos has a few Python scripts in `scr/` that work on a database directly. Each one has its settings at the top and supports `--dry-run`, so you can see what it would do first:

- `export_pica.py` exports all drinks of a company to JSON, together with their current categories.
- `upis_kategorija.py` creates the categories (with slugs) and puts the drinks into them, using `pica_kategorije.json`. A drink is matched by its id and must still have the same name, otherwise it's skipped. Run it after the migrations, and feel free to run it again: it never removes anything.
- `run_migrations.py`, `create_client.py`, `import_artikli.py` and `import_kupci.py` are described at the top of each file.

To point a script at another database, pass `--dsn "postgresql://..."` rather than writing a password into the file.

## Good to know

- **Node 26 needs a patch.** Node 25 removed `SlowBuffer`, and `buffer-equal-constant-time`, an old dependency of `jsonwebtoken`, reads it as soon as it loads, which crashes the API and the tests. A one-line patch in `patches/` falls back to `Buffer`. pnpm applies it on install (it's listed in `pnpm-workspace.yaml`), npm doesn't.
- **`sharp` is pinned to 0.34.** Version 0.35 changed its CommonJS export, and it won't load without `esModuleInterop`. It's imported as `import * as sharp from 'sharp'`.
- **Restart after adding a dependency.** `pnpm start:dev` decides at startup which packages are left out of the bundle. A package installed while it's running gets bundled and breaks (this happened with `pdfkit`). Stop it and start it again.
- **Enum columns need an explicit type**, like `@Column({ type: 'varchar', ... })`. The webpack build loses the enum's type, and TypeORM then fails with `Data type "Object" is not supported`.
- **Test with the real build** when something behaves differently in production: run `pnpm build` and `node dist/main`, not just `ts-node`.
- **Don't import `Response` from `express` as a value** in a controller. With decorators it turns into a `require('express')`, which pnpm doesn't expose. Use `import type`.
- **`tsconfig.json` lists its `types`** (`node`, `jest`, `multer`). TypeScript 6, which VS Code ships with, no longer picks up `@types` packages by itself, so without the list the editor doesn't know `describe` or `Express.Multer`. Add any new global type package there.
- **The AI isn't always available.** Gemini can answer `503` when it's busy (the retries cover short spikes) or `429` when the quota runs out. If you change the model in `ai.constants.ts`, try it with a real document first.
