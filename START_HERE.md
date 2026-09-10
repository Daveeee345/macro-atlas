# Start Here

## Production-equivalent local run

1. Create a Supabase project and apply `supabase/migrations/*.sql` in filename order.
2. Configure the Supabase Transaction Pooler URI and sync settings:

   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run db:seed-reference
   ```

3. Start Next.js together with the Netlify Functions proxy:

   ```bash
   npm run dev:netlify
   ```

Open `http://localhost:8888`. The frontend calls same-origin `/api` routes, which Netlify Dev routes to Supabase-backed functions.

No observations are fabricated when official series have not been configured. Geographic records remain selectable and macro fields display N/A.

## Reference FastAPI run

The original Python service is retained for regression work. To run it with the bundled SQLite demo database, follow the **Local reference backend** section in `docs/DEPLOYMENT.md` and explicitly set `NEXT_PUBLIC_API_BASE=http://localhost:8000`.

## Product navigation

- Atlas / Regimes / Policy / Compare / Data are available from the top navigation.
- `⌘K` or `Ctrl+K` opens navigation and country search.
- The historical slider requests period-aware serverless responses.
- Metric information actions open data lineage and revision details.

Read `docs/DEPLOYMENT.md` for the complete Netlify and Supabase setup, and `docs/PRODUCTION_DATA.md` before approving source mappings.
