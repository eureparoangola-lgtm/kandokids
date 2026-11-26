# Database (Supabase)

- `migrations/` — schema, security (RLS), business rules and app API, applied in order.
  Pushes to `main` are deployed to the production Supabase project by the Supabase GitHub integration.
- `seed.sql` — demo data (Luanda). Used only locally and in tests, never in production.
- `tests/` — scenario tests run by CI (`pnpm db:test`).
