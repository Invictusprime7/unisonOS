# Migrations (UNISON backend)

- Ship every schema change as a new `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql` file whose timestamp is later than every existing file; pushing it to `main` runs Supabase Deploy (UNISON), which applies it with `supabase db push`. Why: the CLI refuses unapplied files older than the newest remote version, and the Lovable migration tool / `drizzle/migrations` target the built-in database, not UNISON.
- Never delete, rename or edit an applied migration file; fix forward with a new file. Why: the CLI refuses every push while remote history lists a missing file; the workflow only marks such versions reverted as a fallback.
- Write each migration so it can run again safely (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`) and grant every new `public` table in the same file. Why: retries and fresh databases replay the whole chain.
- A change is live only after the run's Push migrations step succeeds; confirm by calling the new function or table, not by the file existing. Why: Edge Functions deploy even when migrations fail.
