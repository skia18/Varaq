package store

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestNewPostgresRejectsInvalidConfiguration(t *testing.T) {
	pool, err := NewPostgres(context.Background(), "postgres://%zz")
	if err == nil || pool != nil || !strings.Contains(err.Error(), "parse database configuration") {
		t.Fatalf("pool=%v err=%v", pool, err)
	}
}
func TestPostgresPoolConfigurationAndCancellation(t *testing.T) {
	// Pool creation is lazy (MinConns=0). A cancelled ping must not connect anywhere.
	pool, err := NewPostgres(context.Background(), "postgres://test:test@127.0.0.1:1/test?sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	cfg := pool.Config()
	if cfg.MaxConns != 10 || cfg.MinConns != 0 || cfg.MaxConnLifetime != time.Hour || cfg.MaxConnIdleTime != 30*time.Minute || cfg.HealthCheckPeriod != time.Minute {
		t.Fatal("unexpected pool limits")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := CheckDatabase(ctx, pool); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation was not propagated: %v", err)
	}
}
