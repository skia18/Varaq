# Collections

Each account can have at most one persona, enforced by the
`20261019040000_one_persona_per_user.sql` migration. Collections remain account-owned;
their public curator is that account's sole persona. Accounts without a persona
do not yet have a public wall. No persona attribution column is needed on collections.
The migration rejects existing duplicate personas without deleting or reassigning
them; resolve duplicates explicitly before retrying it.

Collections replaces the Saved Pages destination. `/saved` redirects to `/collections`.

- Every account has one system-managed Saved collection, always private, with a fixed name. It cannot be edited or deleted.
- A bookmark click saves an uncollected public piece to Saved and opens the membership picker. Checkboxes add/remove independent memberships. Reopening an already-collected piece does not change memberships.
- Custom collections start private, support private/public visibility, and have editable names/descriptions. Public collections can be read at `/collections/:id` without authentication; only their owner can edit them.
- Creating a collection from the picker adds the current piece in the same transaction. Removing membership or deleting collections never deletes published writing.
- Unavailable/nonpublic pieces are excluded from counts and results. No writing content is copied into collection tables. Vault storage/encryption is unchanged.

## Migration and deployment

Apply `supabase/migrations/20261019030000_collections.sql` before deploying the updated API/frontend. It creates collection tables, constraints, owner/public read policies, a system-collection protection trigger, an account-creation trigger, and Saved collections for existing accounts. It does not remove existing database structures or change original pieces.

Old bookmarks are local to a browser and are not associated with an account. The Collections page offers an explicit import into the signed-in account. Imports use idempotent membership PUTs; successfully imported IDs are removed from the legacy browser key, and failed IDs remain for retry. A failed/unavailable piece does not stop other IDs importing. The database migration cannot import browser-only data.

The Go API derives ownership from the verified JWT. All mutations are owner scoped. Database clients have read-only grants and RLS; writes use the existing Go database connection. Public reads expose only custom public collections and IDs for currently public published pieces.

## Main implementation files

- Backend: `internal/httpapi/collections.go`, router registration, and `apispec/openapi.yaml` in `apps/varaq-backend`.
- Frontend: `src/features/collections/`, `src/pages/collections/`, bookmark integrations in WritingCard and PublishedPiecePage, routes/navigation, PublicLayout, and collection styles in `apps/varaq-frontend`.
- Retired: SavedPagesPage and SavedPagesContext. Existing feed/reading tests now use CollectionsProvider.
- Generated client: CollectionsApi and Collection/CollectionInput models plus exports and generator manifest.

## Verification

Commands used:

- `npm run build:web`
- `npm run test:web` — 37 tests passed across 10 files.
- `npm run lint:web`
- `npm run api:validate-spec` — valid; existing unused UpdatePersona model recommendation.
- `npm run api:generate:web` — generated collection client/types; unrelated generated formatting changes discarded.
- `go test ./...` from `apps/varaq-backend` — passed; database lifecycle tests skipped without VARAQ_TEST_DATABASE_URL.
- `go test ./internal/httpapi -run 'TestCollection' -v` — authentication and validation passed; database lifecycle skipped.
- `git diff --check`

The collections database lifecycle test covers system Saved protections, duplicate saves, owner isolation, public/private reads, independent membership removal, unavailable pieces, atomic creation rollback, and deletion preserving original pieces. Run it against an isolated database with all migrations applied:

```
VARAQ_TEST_DATABASE_URL=<isolated-database-url> go test ./internal/httpapi -run TestCollectionsDatabaseLifecycle -v
```

The migration has not been applied to a live database. No test database was configured, and the local Docker daemon was unavailable. Database lifecycle and browser visual verification remain outstanding. The production frontend build reports its existing large-bundle warning.

## Public discovery

Search and Discover offer Pages and Writers categories. Writer results link to
`/wall/:handle`; the wall's Collections tab is addressable with `?tab=collections`.
It lists only custom public collections, including empty collections. Public
collection details identify the curator when a persona exists and link back to
their wall. Accounts without a persona can still share public collection URLs.

`GET /api/v1/personas?q=...` searches literal, case-insensitive display names and
handles (optional leading `@`), including personas with no published pieces.
Exact handles rank first, followed by prefixes, then partial matches. Empty
queries browse personas by handle. `GET /api/v1/personas/:handle/collections`
returns collection summaries newest first, counting only currently public
published pieces. Both endpoints support `limit` (1–50, default 20) and opaque
`cursor` pagination. Cursors are scoped to the search query or wall handle.
Neither endpoint returns account IDs, private collections, or Saved memberships.

`TestPublicDiscoveryDatabaseLifecycle` verifies search ordering/pagination,
collection visibility/pagination, curator attribution, and public-to-private
changes against an isolated migrated database. Frontend discovery tests cover
links, counts, pagination, stale search responses, and retry/empty states.

Docker database verification (2026-10-19): started the existing
`varaq-vault-test-20261019` container on localhost port 55432, applied the collections
and one-persona migrations, and ran `go test ./... -race -count=1` with
`VARAQ_TEST_DATABASE_URL` set to that database. The suite passed, including the
collections, discovery, and one-persona database lifecycle tests. No database reset
was performed. Connection credentials were read from the container without
printing them or saving them to the repository.
