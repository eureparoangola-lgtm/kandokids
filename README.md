# Kandokids 🚌

School-transport management for Angola: parents see exactly which vehicle their child is in,
follow the trip live, get pickup and arrival alerts, and message the vehicle directly.
Transport companies pay a yearly licence plus a monthly fee. Parents can buy paid extras.

The app interface is in Portuguese (pt-AO).

## Structure

```
apps/web          Admin dashboard (Next.js 16): features, paid extras, today's trips
apps/mobile       Parent and vehicle-assistant app (Expo / React Native: Android, iOS and web)
packages/shared   Types and Portuguese labels shared by web and mobile
supabase/         Database: migrations, demo data (seed.sql) and scenario tests
```

## Mobile app (`apps/mobile`)

One app, two roles. The screens shown depend on who logs in:

| Parent (encarregado) | Vehicle assistant (assistente) |
|---|---|
| Children list: which vehicle each child is in right now | Today's trips with child counts |
| Live map of the vehicle (only while their child is waiting or on board) | Start the trip; GPS is sent automatically every ~10 s |
| Timeline: trip started, picked up, arrived at school or home | Check children in with one tap or by scanning their **QR card** (a child from another vehicle is refused, and the scan says which vehicle is right) |
| "Going today / tomorrow" switches | Hand-over with **PIN** or **authorized adult** |
| Chat with the vehicle, with quick replies | "No-show", **notify parents** (delay, breakdown…), **SOS** |
| Set the pickup PIN | End the trip with the **empty-vehicle check** |
| Notifications, paid extras, sign-up with an invite code | Parents' messages |

The same code runs in the browser (`pnpm --filter @kandokids/mobile web`), which also serves parents on the web.
On the web, the map uses OpenStreetMap (Leaflet); on phones it uses the native map.

```bash
cp apps/mobile/.env.example apps/mobile/.env.local   # Supabase URL and anon key
pnpm --filter @kandokids/mobile start                # QR code for Expo Go / dev build
```

> The app uses native modules (camera, location, maps). Install it on a phone with an EAS development build:
> `npx eas-cli@latest build --profile development`. A Google Maps API key is needed for the Android map.

## Plans and onboarding

- **Free plan, forever:** 1 vehicle and up to 15 students, all features, no ads.
- **Paid extras are sold by Kandokids directly to parents** (SMS, speeding alerts, …). Companies never see them.
  One payment covers all of a parent's children, even in different companies.
- **Pro plan:** unlimited vehicles and students (yearly licence or monthly fee). Companies request it from the dashboard (**Plano**), and Kandokids staff are notified.
- **Self-service:** a company signs up at `/registar`, adds its vehicle, **imports students from Excel/CSV**
  (columns are recognized by name: Nome, Classe, Escola, Morada, Encarregado, Telefone, Parentesco), invites its
  assistants, creates a route, and **sends each parent a WhatsApp invite** with a code.
- One invite code works for everyone: parents and staff enter it in the app ("Tenho um código de convite").
- **Trips are created every day at 05:00 (Luanda)** from the routes (`generate_trips`, scheduled with `pg_cron`),
  or on demand from the dashboard.
- A child's home location is saved automatically on the first pickup with GPS, which enables proximity alerts.

## Kandokids master dashboard (`/plataforma`)

For the Kandokids team (`platform_admin` role):

- **Overview:** companies (free / Pro / suspended), parents (and how many were active in the last 7 days), staff, students, vehicles, trips today and live, active extras and monthly extras revenue, Pro plan requests.
- **Companies:** usage per company, admin contact (WhatsApp link), change plan (free ↔ Pro with paid-until date), **suspend with a reason / reactivate**. Suspension locks the company dashboard (`/suspensa`), stops trips from starting or being generated, notifies the company admin, and shows parents a notice.
- **Parents:** search by name, phone or email; children, companies, extras, last login.
- **Extras:** confirm parents' payments (1/3/6/12 months), set the price and mode of each extra for all companies.
- **Settings:** payment instructions and support contacts shown in the app.

Making someone a Kandokids admin (Supabase → SQL Editor):

```sql
update public.profiles set role = 'platform_admin', company_id = null
where id = (select id from auth.users where email = 'EMAIL-DA-CONTA');
```

## Feature switches

Companies switch the base features on or off under **Funcionalidades**. Paid extras are controlled by Kandokids (`/plataforma/extras`). Each feature has a mode:

| Mode | Meaning |
|---|---|
| `off` (Desligado) | Feature disabled |
| `included` (Incluído) | Available to every parent at no extra cost |
| `addon` (Extra pago) | Only for parents with an active paid subscription (price set by the company) |

The catalogue (`features` table) says which modes each feature allows. For example, live tracking
can't be sold as an extra, while SMS alerts can. Kandokids can lock a feature for a company
(`locked_by_platform`). The rules are enforced in the database (RLS and RPC functions), not only in the UI.

Default paid extras: SMS on pickup and arrival, speeding alerts, drop-off photo, 12-month trip
history, family sharing (up to 5 guardians) and a monthly report.

## Business rules (in the database)

- `start_trip` / `end_trip`: applies the parents' absence marks. If the empty-vehicle check is
  on, a trip can't end while a child is still on board, and staff are alerted.
- `record_pickup`, `checkin_by_token` (QR/NFC): the scan rejects a child who belongs in another
  vehicle and says which vehicle is the right one.
- `record_dropoff`: going home, hand-over requires the **pickup PIN** or an **authorized adult**.
  The PIN locks after 5 wrong attempts, and parents are notified from the 3rd.
- `transfer_student`: moves a child to another vehicle and notifies the parents (push and SMS).
- GPS trigger: **speeding** alerts (staff, plus parents with the extra) and a **proximity alert**
  ("vehicle about X min away").
- `request_addon` / `activate_addon`: a parent requests an extra, and the company confirms the
  payment (Multicaixa Express, payment reference, etc.).
- Privacy: a parent only sees the vehicle's location while their child is waiting for it or on board.

Notifications go into `notifications` (push) and `sms_outbox` (SMS). Sending them through an
Angolan SMS provider and FCM will be done by Edge Functions (next step).

## Production on Hetzner

The website (dashboard + app at `/app`) runs on a Hetzner server with Docker; the database and logins stay on Supabase.

- `deploy/web.Dockerfile`: builds both into one Node server (no settings needed; Supabase public values are built in).
- `deploy/docker-compose.yml`: the website plus **Caddy**, which gets and renews the HTTPS certificate automatically.
- `deploy/setup-server.sh`: one-time setup of a fresh Ubuntu 24.04 server (swap, Docker, firewall, `deploy` user, first start).
- `deploy/update.sh`: pulls the latest `main` and restarts. GitHub Actions runs it after **all tests pass** when the
  `HETZNER_HOST` and `HETZNER_SSH_KEY` secrets are set; the CI also builds and starts the image on every push.

## Running locally

```bash
pnpm install
pnpm exec supabase start          # requires Docker
pnpm exec supabase db reset       # migrations + demo data
cp apps/web/.env.example apps/web/.env.local   # fill in the anon key shown by `supabase start`
pnpm dev:web                      # http://localhost:3000
```

Demo users (password `kandokids123`): `admin@kianda.ao` (admin), `teresa@kianda.ao`
(assistant), `joana@exemplo.ao` and `paulo@exemplo.ao` (parents).

## Tests

GitHub Actions (`.github/workflows/ci.yml`) runs four jobs on every push to `main` and on every pull request:

| Job | What it checks |
|---|---|
| **Database** | Applies all migrations and the demo data on Postgres, then runs the 13 scenarios in `supabase/tests/scenarios.sql` (permissions, PIN, empty vehicle, transfers, speeding, SMS only for paying parents…) |
| **Web** | TypeScript type checking and production build of the dashboard |
| **Mobile** | Type checking and web export of the app |
| **End-to-end** | Starts Postgres + GoTrue (login) + PostgREST (API). A real browser (Playwright) tests the dashboard (features, prices, payments), then the app: a full morning trip with the assistant and a parent at the same time (GPS, live map, QR scan, absence, chat, empty-vehicle check, notifications) and a paid-extra request |

Running them locally (needs a Postgres you can reach with `psql`, plus Docker for the end-to-end tests):

```bash
# Database scenarios
PGHOST=localhost PGPORT=5432 PGUSER=postgres pnpm db:test

# End-to-end
ANON=$(PGHOST=localhost PGPORT=5432 ./scripts/test-stack/up.sh apps/web/e2e/seed-e2e.sql | tail -1)
printf "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON\n" > apps/web/.env.local
pnpm --filter @kandokids/web build && pnpm test:e2e
pnpm stack:down
```

`up.sh` recreates the test database every time, so run it again before re-running the end-to-end tests.
