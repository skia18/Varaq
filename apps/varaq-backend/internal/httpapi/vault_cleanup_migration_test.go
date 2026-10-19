package httpapi

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"strings"
	"testing"
)

// Run against the pre-cleanup schema to test both guards and data preservation.
func TestDraftCleanupMigration(t *testing.T) {
	url := os.Getenv("VARAQ_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("requires disposable PostgreSQL database")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var oldSchema bool
	err = db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='varaq_private' AND table_name='vault_drafts' AND column_name='legacy_updated_at')`).Scan(&oldSchema)
	if err != nil {
		t.Fatal(err)
	}
	if !oldSchema {
		t.Skip("cleanup already applied; guard scenarios require pre-cleanup schema")
	}
	migration, err := os.ReadFile("../../../../supabase/migrations/20261019020000_remove_legacy_drafts.sql")
	if err != nil {
		t.Fatal(err)
	}
	for _, scenario := range []string{"plaintext", "pending", "complete"} {
		t.Run(scenario, func(t *testing.T) {
			tx, err := db.Begin(ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer tx.Rollback(ctx)
			user, persona, draftID, pieceID := testUUID(), testUUID(), testUUID(), testUUID()
			for _, stmt := range []struct {
				sql  string
				args []any
			}{
				{`INSERT INTO auth.users(id) VALUES($1::uuid)`, []any{user}},
				{`INSERT INTO public.personas(id,user_id,handle,display_name) VALUES($1::uuid,$2::uuid,$3,'Fixture')`, []any{persona, user, "m" + strings.ReplaceAll(persona, "-", "")[:20]}},
				{`INSERT INTO varaq_private.vaults(user_id,config) VALUES($1::uuid,'{}')`, []any{user}},
				{`INSERT INTO varaq_private.vault_drafts(id,user_id,persona_id,revision,envelope) VALUES($1::uuid,$2::uuid,$3::uuid,1,'{"ciphertext":"keep-encrypted"}')`, []any{draftID, user, persona}},
				{`INSERT INTO public.pieces(id,persona_id,slug,title,body,type,status,visibility,published_at) VALUES($1::uuid,$2::uuid,$1::text,'Keep published','Keep content','poem','published','public',now())`, []any{pieceID, persona}},
			} {
				if _, err = tx.Exec(ctx, stmt.sql, stmt.args...); err != nil {
					t.Fatal(err)
				}
			}
			if scenario == "plaintext" {
				_, err = tx.Exec(ctx, `INSERT INTO public.pieces(persona_id,slug,title,body,type,status) VALUES($1::uuid,'unmoved','Unmoved','Do not delete','poem','draft')`, persona)
			}
			if scenario == "pending" {
				_, err = tx.Exec(ctx, `UPDATE varaq_private.vault_drafts SET legacy_updated_at=now() WHERE id=$1::uuid`, draftID)
			}
			if err != nil {
				t.Fatal(err)
			}
			_, err = tx.Exec(ctx, string(migration))
			if scenario != "complete" {
				if err == nil {
					t.Fatal("cleanup ignored unfinished data")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			var envelope string
			err = tx.QueryRow(ctx, `SELECT envelope->>'ciphertext' FROM varaq_private.vault_drafts WHERE id=$1::uuid`, draftID).Scan(&envelope)
			if err != nil || envelope != "keep-encrypted" {
				t.Fatalf("encrypted draft changed: %v", err)
			}
			var body string
			err = tx.QueryRow(ctx, `SELECT body FROM public.pieces WHERE id=$1::uuid`, pieceID).Scan(&body)
			if err != nil || body != "Keep content" {
				t.Fatalf("publication changed: %v", err)
			}
			_, err = tx.Exec(ctx, `INSERT INTO public.pieces(persona_id,slug,title,body,type,status) VALUES($1::uuid,'blocked','Blocked','plaintext','poem','draft')`, persona)
			if err == nil {
				t.Fatal("plaintext draft constraint missing")
			}
		})
	}
}
