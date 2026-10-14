package store

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPostgres(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database configuration: %w", err)
	}

	cfg.MaxConns = 10
	cfg.MinConns = 0
	cfg.MaxConnLifetime = time.Hour
	cfg.MaxConnIdleTime = 30 * time.Minute
	cfg.HealthCheckPeriod = time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create database pool: %w", err)
	}

	return pool, nil
}

func CheckDatabase(ctx context.Context, pool *pgxpool.Pool) error {
	var result int

	if err := pool.QueryRow(ctx, "SELECT 1").Scan(&result); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	if result != 1 {
		return fmt.Errorf("unexpected database ping result: %d", result)
	}

	return nil
}
