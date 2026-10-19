# Database and running-cost review

## Financial baseline
Recorded October 6, 2026 00:00 UTC through October 19, 2026 01:59 UTC; current date partial. Full returned project scope, requested credits, not cash payments or reconciled deductions.

| Item | Recorded quantity | Requested credits |
| --- | --- | --- |
| XL database compute | 167.1 instance-hours | 206.996796 |
| AI Gateway | Token quantities unavailable | 32.4019641 |
| Network | 5.681765977 GB egress + 0.022623622 GB cached egress | 2.560188241 |
| Functions | 36,747 invocations | 0.36747 |
| File storage | 28.041989734 GB-hours | 0.004033562 |

Running subtotal: 242.330451903 requested credits. Build category separately: 832.776. No database-storage meter returned; this does not establish zero storage activity.

## Backend boundary
Managed diagnostics measure the built-in Lovable Cloud database. The application explicitly uses authoritative UNISON instead. These measurements cannot establish UNISON load, index suitability or savings. No settings, records, schedules or schema changed on either backend.

## Managed database observations
- Memory 15%, disk 26%, connections 15/240, pool clients 1/1000; no recent exhaustion, zero restarts. Snapshot only, not a representative peak-load sizing study.
- Database 1.75 GB. Largest measured relations: site_revisions 1,104,969,728 bytes; cron job history 696,262,656 bytes. Row-count estimates were inconsistent; no data deletion or vacuum performed.
- Cron history: 437,216 rows from December 5, 2025 to October 19, 2026. Active workflow processor runs every minute; ten recent scheduler invocations succeeded. Scheduler success does not prove the downstream HTTP request worked or useful work occurred.
- Rollbacks rose from 17,614,664 to 17,618,151 across inspection (cumulative counters). High current churn merits investigation of failing transactions; no cause established.
- Highest-total successful statement: full site_revisions read, 515 calls, 65.42 ms mean, 33.69 seconds total. Bulk draft source scan: 10 calls, 972.47 ms mean. Home summaries: 28 calls, 128.18 ms mean. Statistics window/reset unavailable; not comparable to billing window.
- Draft owner/date indexes already exist (two duplicate definitions). Revision primary-key and project/date indexes exist. A narrow draft query with a nonexistent owner used idx_builder_drafts_user_updated, 0.066 ms execution; this is not a real-account before/after benchmark. No speculative indexes added or dropped.

## Source improvements
- Home refreshes serialize and coalesce simultaneous focus/realtime events into one trailing read. Freshness signals remain; no new cache or polling interval.
- Accepted draft lookup filters non-null revision pointers server-side and reads one row instead of 50.
- Legacy draft identity lookup reads only metadata identity/name scalars, not embedded source/snapshots. Historical name and project aliases remain supported.
- Deterministic tests cover burst request counts, trailing freshness, disposal, failure retry and legacy identity resolution. Live UNISON read-back remains unavailable.

## Cost decisions still requiring evidence or approval
XL compute is the largest recorded running driver. Faster queries do not reduce the hourly rate. Current XL quote: 1.23876 credits/hour; continuous 30-day scenario 891.9072 credits before allowances, not a measured monthly bill.

Before changing resources: verify whether the built-in Cloud backend still supports any active workflows or clients, investigate rollback churn, and measure representative peak memory/connection load. Then obtain explicit approval to pause unused Cloud or select a smaller size. Do not pause authoritative UNISON or change scheduling/freshness silently.

Cron-log retention needs an approved retention window and recovery plan. No deletion, migration, instance change, scheduling change, or savings claim was made. Compare requested instance-hours, request counts and load over representative periods after approved changes; review usage when delayed recording catches up.