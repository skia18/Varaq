package httpapi

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/skia18/varaq/apps/varaq-backend/internal/store"
)

func TestReadinessReturnsServiceUnavailableWhenDatabaseCheckIsCancelled(t *testing.T) {
	pool, err := store.NewPostgres(context.Background(), "postgres://test:test@127.0.0.1:1/test?sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	r := httptest.NewRequest("GET", "/readyz", nil).WithContext(ctx)
	w := httptest.NewRecorder()
	HealthHandler{DB: pool}.Readiness(w, r)
	if w.Code != 503 {
		t.Fatalf("got %d %s", w.Code, w.Body)
	}
	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response["status"] != "not_ready" || response["database"] != "unavailable" || len(response) != 2 {
		t.Fatalf("unexpected readiness response: %v", response)
	}
}
