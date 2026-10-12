package config

import (
	"fmt"
	"os"
)

type Config struct {
	HTTPAddr    string
	DatabaseURL string
	AppEnv      string
}

func Load() (Config, error) {
	cfg := Config{
		HTTPAddr:    envOr("HTTP_ADDR", ":8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		AppEnv:      envOr("APP_ENV", "development"),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	return cfg, nil
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
