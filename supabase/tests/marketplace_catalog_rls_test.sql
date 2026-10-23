BEGIN;
SELECT plan(16);

SELECT ok(to_regclass('public.marketplace_listings') IS NOT NULL, 'marketplace listings table exists');
SELECT ok(to_regclass('public.marketplace_releases') IS NOT NULL, 'marketplace releases table exists');
SELECT ok(
	(SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = 'public.marketplace_listings'::regclass),
	'marketplace listings has RLS enabled'
);
SELECT ok(
	(SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = 'public.marketplace_releases'::regclass),
	'marketplace releases has RLS enabled'
);
SELECT ok(to_regclass('public.marketplace_public_listings') IS NOT NULL, 'sanitized public listing view exists');
SELECT ok(
	COALESCE(
		(SELECT reloptions FROM pg_catalog.pg_class WHERE oid = 'public.marketplace_public_listings'::regclass),
		ARRAY[]::text[]
	) @> ARRAY['security_invoker=true'],
	'public listing view respects invoker RLS'
);
SELECT ok(
	NOT has_table_privilege('anon', 'public.marketplace_listings', 'INSERT')
	AND NOT has_table_privilege('anon', 'public.marketplace_listings', 'UPDATE')
	AND NOT has_table_privilege('anon', 'public.marketplace_listings', 'DELETE'),
	'anon cannot write listings'
);
SELECT ok(
	NOT has_table_privilege('authenticated', 'public.marketplace_listings', 'INSERT')
	AND NOT has_table_privilege('authenticated', 'public.marketplace_listings', 'UPDATE')
	AND NOT has_table_privilege('authenticated', 'public.marketplace_listings', 'DELETE'),
	'authenticated cannot write listings'
);
SELECT ok(
	NOT has_column_privilege('anon', 'public.marketplace_listings', 'creator_user_id', 'SELECT'),
	'anon cannot read listing creator identity'
);
SELECT ok(
	NOT has_column_privilege('authenticated', 'public.marketplace_listings', 'creator_user_id', 'SELECT'),
	'authenticated cannot read listing creator identity'
);
SELECT ok(
	NOT has_table_privilege('anon', 'public.marketplace_releases', 'SELECT')
	AND NOT has_table_privilege('anon', 'public.marketplace_releases', 'INSERT')
	AND NOT has_table_privilege('anon', 'public.marketplace_releases', 'UPDATE')
	AND NOT has_table_privilege('anon', 'public.marketplace_releases', 'DELETE'),
	'anon has no access to private releases'
);
SELECT ok(
	NOT has_table_privilege('authenticated', 'public.marketplace_releases', 'SELECT')
	AND NOT has_table_privilege('authenticated', 'public.marketplace_releases', 'INSERT')
	AND NOT has_table_privilege('authenticated', 'public.marketplace_releases', 'UPDATE')
	AND NOT has_table_privilege('authenticated', 'public.marketplace_releases', 'DELETE'),
	'authenticated has no access to private releases'
);
SELECT ok(
	NOT has_column_privilege('anon', 'public.marketplace_listings', 'status', 'UPDATE')
	AND NOT has_column_privilege('authenticated', 'public.marketplace_listings', 'current_release_id', 'UPDATE'),
	'client roles cannot promote listings or select a release'
);
SELECT ok(
	has_table_privilege('service_role', 'public.marketplace_listings', 'INSERT')
	AND has_table_privilege('service_role', 'public.marketplace_releases', 'INSERT'),
	'server role can seed catalog rows'
);
SELECT ok(
	(SELECT count(*) = 1 FROM pg_catalog.pg_policy WHERE polrelid = 'public.marketplace_listings'::regclass),
	'listing table exposes only its published-row select policy'
);
SELECT is(
	(SELECT count(*) FROM pg_catalog.pg_policy WHERE polrelid = 'public.marketplace_releases'::regclass),
	4::bigint,
	'private release table has a deny policy for each client operation'
);

SELECT * FROM finish();
ROLLBACK;
