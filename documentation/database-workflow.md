# Database setup and migrations

This guide explains how Varaq's hosted Supabase database is represented in this repository, how to set up a local database, and how to make future SQL changes. Run every command below from the repository root, beside the root `package.json`.

## What the tools do

| Tool or file | Purpose |
| --- | --- |
| Hosted Supabase | Runs the shared PostgreSQL database and authentication service. |
| Docker Desktop | Runs temporary and local database containers on your computer. |
| `supabase` npm package | The developer CLI used to manage migrations and local Supabase. Installed at the repository root. |
| `@supabase/supabase-js` | The application's Supabase client library, installed in `apps/varaq-frontend`. It serves a different purpose from the CLI. |
| `supabase/config.toml` | Configuration for the local Supabase services. |
| `supabase/migrations/*.sql` | Ordered instructions for creating and changing the application's database structure. |
| `supabase/seed.sql` | Optional sample data for local development; currently not provided. |

A schema is the database's blueprint: tables, columns, relationships, indexes, functions, triggers, and access rules. A migration is a SQL file that changes that blueprint. Neither is a backup of the actual records.

## First-time setup after cloning this repository

### 1. Install dependencies

Install Git, Node.js with npm, and [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/). On a Mac, choose the Docker download matching your processor: Apple silicon or Intel.

Clone the repository and install its locked npm dependencies:

```bash
git clone https://github.com/skia18/Varaq.git
cd Varaq
npm ci
npx supabase --version
```

The CLI is already a root development dependency. You do not need to install it again or run `supabase init`: the repository already contains `supabase/config.toml` and the baseline migration.

### 2. Start Docker

Open Docker Desktop and complete any first-launch setup. Wait for its engine to run, then check:

```bash
docker info
```

Successful output includes both Client and Server information. A connection error usually means Docker Desktop has not finished starting.

### 3. Create your local database

```bash
npx supabase start
npx supabase db reset --local
```

The first start downloads container images and can take several minutes. The reset recreates the local database and applies the SQL files in timestamp order. **It deletes existing local database data.** It does not modify hosted Supabase.

Inspect the local services and connection details with:

```bash
npx supabase status
```

Use the Studio URL shown there to browse the local tables. The current configuration normally uses port `54323` for Studio, `54321` for the local API, and `54322` for PostgreSQL.

Starting local Supabase does not switch Varaq to it. To test the application against local services, use the local database connection and Supabase URL/keys in the relevant application environment files. Keep frontend and backend authentication pointed at the same Supabase instance. Use `supabase status` for the actual values and the application's environment templates for variable names. Local Auth starts separately from hosted Auth; production users are not copied here.

### 4. Link hosted Supabase only if you need remote access

You can run the local migrations without logging in or linking a hosted project. Developers who need to pull or deploy remote changes must have access to that project:

```bash
npx supabase login
npx supabase link --project-ref gwaszyrxtchoubjmukyx
npx supabase migration list --linked
```

Complete the browser login and enter the database password in the terminal if prompted. Get credentials through the project's normal private sharing process.

The project reference is the part after `/project/` in its dashboard URL:

```text
https://supabase.com/dashboard/project/gwaszyrxtchoubjmukyx
```

It identifies the project and is not a password. Linking selects the target for remote commands; it does not copy data or redirect the running application. Local link state is ignored by Git, so a fresh clone needs its own link. For a separate development or staging project, substitute that project's reference.

Do not pull a new baseline just because you cloned the repository. Existing migrations already describe the schema. If local and remote migration histories disagree, investigate before pushing or repairing history.

## How the initial baseline was created

Varaq originally created its tables directly in hosted Supabase. The following setup was performed once to capture that existing structure:

```bash
npm install --save-dev supabase
npx supabase init
npx supabase login
npx supabase link --project-ref gwaszyrxtchoubjmukyx
npx supabase db pull
```

With Docker running, `db pull` inspected the hosted schema and wrote:

```text
supabase/migrations/20261018113214_remote_schema.sql
```

This baseline includes the `personas` and `pieces` tables, their relationships and indexes, and the function and triggers used to update timestamps, along with the generated permissions and row-level security settings. Review the SQL itself for the exact definitions.

The pull can ask to mark this migration as already applied remotely. Accepting records it in Supabase's migration history, because those objects already exist in the hosted database. This prevents a later push from trying to create them again. The pull does not download table rows or recover the history of previously deleted tables.

## Making future SQL changes

### 1. Start from the latest repository state

Get your team's latest changes before creating a migration. Start Docker Desktop and run:

```bash
npx supabase start
```

### 2. Create a new migration

For example, to add a biography field:

```bash
npx supabase migration new add_persona_bio
```

Open the new timestamped file in `supabase/migrations/` and write:

```sql
alter table public.personas
add column bio text;
```

This is an example, not a change already made to Varaq. Use a name and SQL matching your actual task.

Create a new file for each subsequent change. Keep migrations that have already been shared or applied unchanged; correct them with a new migration. They form the ordered history needed to rebuild the database.

Table creation, column changes, indexes, functions, policies, and deletions all belong in migrations. For example, deleting an obsolete table uses `drop table public.table_name;`. Deleting rows with `delete` is different from deleting the table itself. Review destructive changes for data loss and application compatibility before deployment.

### 3. Test the migrations locally

```bash
npx supabase db reset --local
```

This rebuilds the local database from all migrations and then loads configured seed data, if provided. Expect local records and local Auth users to be lost. Verify the resulting structure in local Studio and test the affected application behavior against the local services. A successful reset verifies that the SQL can rebuild the schema; it does not by itself prove application behavior or production data compatibility.

Use representative test records to check changes affecting existing data, constraints, ownership, or access policies.

### 4. Review and commit the change

Review the new SQL and related application changes. Commit them together through the repository's normal review process. Do not include credentials, production records, or local CLI state.

### 5. Apply the reviewed change to the intended hosted project

Confirm the project reference before deploying. Linking explicitly makes the target clear:

```bash
npx supabase link --project-ref gwaszyrxtchoubjmukyx
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

The dry run lists pending migrations without applying them. It does not guarantee that every SQL statement will succeed against real data.

When the target and pending migrations are correct, deploy:

```bash
npx supabase db push --linked
```

**This command changes the hosted database.** It applies migrations that have not yet been recorded there. Coordinate changes that remove data or affect deployed application code, and arrange an appropriate backup before destructive changes. Verify the resulting behavior after deployment.

If a deployment fails, inspect the error and database state before retrying. Deleting a migration file or reverting a Git commit does not undo SQL already applied remotely. Write a corrective migration; dropped data requires recovery from a backup.

## If someone changes the schema in the dashboard

Prefer migration files for routine schema work. If a dashboard change has already happened, capture it before creating more local changes:

```bash
npx supabase db pull
```

Review the generated migration, accept recording it as already applied remotely when prompted, test the migration history locally, and commit it. Coordinate with other developers so unrelated local and remote changes are not mixed together.

Pulling does not replace a review of customizations to Supabase-managed schemas. Depending on the CLI's diff engine, some custom objects inside `auth` or `storage` may require hand-written migrations. See the official workflow linked below when using those features.

## Supabase Auth and moving providers

The `personas.user_id` column references `auth.users(id)`. Keep that relationship in the application migration. Local Supabase supplies its own managed Auth schema; we do not copy Supabase's internal Auth table definitions or production accounts into Git.

Any application-specific Auth triggers or policies should be tracked as SQL. Authentication provider configuration, secrets, and production user accounts are separate from these migrations.

The migrations help with a future move, especially to another PostgreSQL provider. They are not a complete provider migration: the destination needs compatible extensions and roles, a replacement for the `auth.users` relationship, separate data transfer, and replacements for any Supabase services the application uses. Plain PostgreSQL does not automatically supply Supabase Auth.

## What to keep in Git

Commit:

- Root `package.json` and `package-lock.json`, which include the CLI dependency.
- `supabase/config.toml`, with secrets referenced through environment variables if needed.
- Reviewed SQL files under `supabase/migrations/`.
- `supabase/.gitignore` and any deliberately created, sanitized sample seed data.
- This documentation.

Keep credentials, access tokens, service-role keys, production data dumps, and real user records out of Git. The existing ignore rules exclude environment files and `supabase/.temp/` and `.branches/`. Arbitrary SQL dumps are not automatically ignored; store private backups outside the repository.

Schema files reveal the application's structure, which is normal for source code. A public repository exposes that structure publicly; a private repository exposes it to people with repository access. Review functions and generated SQL for embedded secrets before committing. Schema secrecy is not a replacement for access controls.

If you need an actual data backup, use a separate, access-controlled backup/export process. `db pull` is only a schema capture. For local development, prefer synthetic seed records and create local Auth test users before inserting rows that reference them.

## Stopping and restarting

When finished with local database work:

```bash
npx supabase stop
```

You can then quit Docker Desktop. Normal `stop` preserves local data for the next start; avoid `--no-backup` if you want to keep it. Docker is not required for the app to continue using hosted Supabase. It must be running for local database work and CLI operations that use database containers.

Next time, open Docker Desktop and run `npx supabase start`. Only reset when you intend to rebuild and discard local data.

## Common issues

| Symptom | What to check |
| --- | --- |
| Cannot connect to Docker | Open Docker Desktop, wait for the engine, and retry `docker info`. |
| CLI cannot find configuration | Run from the repository root containing `supabase/config.toml`. |
| Remote command says no linked project | Log in and link the intended project on this machine. |
| Migration history mismatch | Compare `migration list --linked` with committed files and coordinate with the team before changing history. |
| Local insert fails on `personas.user_id` | The referenced user must exist in local Auth; a hosted user ID alone is insufficient. |
| Local tables are empty | Migrations create structure; production rows were not copied. |
| Application still shows hosted data | Starting containers does not change application environment variables. |

## References

- [Supabase local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [Supabase CLI setup](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Docker Desktop installation on Mac](https://docs.docker.com/desktop/setup/install/mac-install/)
