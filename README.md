# Kandokids 🚌

School-transport management for Angola: parents see exactly which vehicle their child is in,
follow the trip live, get pickup and arrival alerts, and message the vehicle directly.
Transport companies pay a yearly licence plus a monthly fee. Parents can buy paid extras.

The app interface is in Portuguese (pt-AO).

## Structure

```
apps/web          Admin dashboard (Next.js 16): features, paid extras, today's trips
apps/mobile       (next) Parent and vehicle-assistant app (Expo / React Native)
packages/shared   Types and Portuguese labels shared by web and mobile
supabase/         Database: migrations, demo data (seed.sql) and scenario tests
```

## Feature switches

Every feature has a per-company mode, set in the dashboard under **Funcionalidades**:

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

### Database tests

The tests run against a plain PostgreSQL 16 (with a minimal Supabase stand-in):

```bash
PGHOST=/path/to/socket PGPORT=5432 pnpm db:test
```
