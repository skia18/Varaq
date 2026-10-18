package httpapi

import (
	"encoding/base64"
	"github.com/jackc/pgx/v5/pgtype"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestFeedQueryVisibilityAndOrdering(t *testing.T) {
	query, args, limit, err := buildFeedQuery(httptest.NewRequest("GET", "/api/v1/feed", nil))
	if err != nil {
		t.Fatal(err)
	}
	if limit != 10 || args[len(args)-1] != 11 {
		t.Fatalf("expected 10 results with lookahead: %v %v", limit, args)
	}
	for _, required := range []string{"p.status = 'published'", "p.visibility = 'public'", "ORDER BY p.published_at DESC, p.id DESC"} {
		if !strings.Contains(query, required) {
			t.Fatalf("missing public feed constraint %q", required)
		}
	}
}
func TestFeedInvalidParameters(t *testing.T) {
	cursor := base64.RawURLEncoding.EncodeToString([]byte(`{"publishedAt":"2026-10-18T12:00:00Z","id":"not-a-uuid"}`))
	for _, params := range []string{"limit=0", "limit=51", "limit=oops", "type=unknown", "cursor=bad", "cursor=" + cursor, "ids=1", "q=" + strings.Repeat("a", 301)} {
		t.Run(params[:min(len(params), 40)], func(t *testing.T) {
			w := httptest.NewRecorder()
			PieceHandler{}.ListFeed(w, httptest.NewRequest("GET", "/api/v1/feed?"+params, nil))
			if w.Code != 400 {
				t.Fatalf("got %d", w.Code)
			}
		})
	}
}
func TestFeedCursorAndFiltersAreParameterized(t *testing.T) {
	id := "00000000-0000-4000-8000-000000000001"
	cursor := base64.RawURLEncoding.EncodeToString([]byte(`{"publishedAt":"2026-10-18T12:00:00Z","id":"` + id + `"}`))
	search := "' OR TRUE --"
	params := url.Values{"limit": {"10"}, "type": {"poem"}, "q": {search}, "ids": {id}, "cursor": {cursor}}
	query, args, _, err := buildFeedQuery(httptest.NewRequest("GET", "/api/v1/feed?"+params.Encode(), nil))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(query, search) || strings.Contains(query, id) {
		t.Fatal("user data interpolated into SQL")
	}
	for _, required := range []string{"p.type = $1", "lower($2)", "ANY($3::uuid[])", "(p.published_at, p.id) < ($4, $5::uuid)", "LIMIT $6"} {
		if !strings.Contains(query, required) {
			t.Fatalf("missing %q in %s", required, query)
		}
	}
	if len(args) != 6 {
		t.Fatalf("args: %v", args)
	}
}

func TestFeedUUIDArgumentsEncodeForPostgres(t *testing.T) {
	id := "00000000-0000-4000-8000-000000000001"
	cursor := base64.RawURLEncoding.EncodeToString([]byte(`{"publishedAt":"2026-10-18T12:00:00Z","id":"` + id + `"}`))
	_, args, _, err := buildFeedQuery(httptest.NewRequest("GET", "/api/v1/feed?ids="+id+"&cursor="+cursor, nil))
	if err != nil {
		t.Fatal(err)
	}
	types := pgtype.NewMap()
	if _, err := types.Encode(pgtype.UUIDArrayOID, pgtype.BinaryFormatCode, args[0], nil); err != nil {
		t.Fatalf("UUID array encoding: %v", err)
	}
	if _, err := types.Encode(pgtype.UUIDOID, pgtype.BinaryFormatCode, args[2], nil); err != nil {
		t.Fatalf("cursor UUID encoding: %v", err)
	}
}
