package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
)

func TestOnePersonaPerAccount(t *testing.T) {
	url := os.Getenv("VARAQ_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set VARAQ_TEST_DATABASE_URL to an isolated migrated database")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	user, other := testUUID(), testUUID()
	for _, id := range []string{user, other} {
		if _, err := db.Exec(ctx, `INSERT INTO auth.users(id) VALUES($1)`, id); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, `DELETE FROM auth.users WHERE id=$1`, id)
	}
	handle := "p" + strings.ReplaceAll(user, "-", "")[:20]
	create := func(uid, handle string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "/api/v1/personas", strings.NewReader(fmt.Sprintf(`{"handle":%q,"displayName":"Writer"}`, handle)))
		r = r.WithContext(auth.WithUser(ctx, auth.User{ID: uid}))
		w := httptest.NewRecorder()
		PersonaHandler{DB: db}.Create(w, r)
		return w
	}
	if w := create(user, handle); w.Code != 201 {
		t.Fatalf("first persona: %d %s", w.Code, w.Body)
	}
	assertAPIError(t, create(user, handle+"x"), 409, "persona_already_exists", "already has a persona")
	assertAPIError(t, create(other, handle), 409, "handle_unavailable", "already in use")
	// The invariant also holds for writes that bypass the API.
	_, err = db.Exec(ctx, `INSERT INTO public.personas(user_id,handle,display_name) VALUES($1,$2,'Duplicate')`, user, handle+"y")
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" || pgErr.ConstraintName != "personas_user_id_key" {
		t.Fatalf("expected account uniqueness violation, got %v", err)
	}
	if w := create(other, handle+"z"); w.Code != 201 {
		t.Fatalf("other account persona: %d %s", w.Code, w.Body)
	}
}
