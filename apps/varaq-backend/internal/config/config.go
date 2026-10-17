package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                   string
	DatabaseURL            string
	SupabaseURL            string
	SupabasePublishableKey string
}

func Load() (Config, error) {
	_ = godotenv.Load()

	cfg := Config{
		Port:                   strings.TrimSpace(os.Getenv("PORT")),
		DatabaseURL:            strings.TrimSpace(os.Getenv("DATABASE_URL")),
		SupabaseURL:            strings.TrimRight(strings.TrimSpace(os.Getenv("SUPABASE_URL")), "/"),
		SupabasePublishableKey: strings.TrimSpace(os.Getenv("SUPABASE_PUBLISHABLE_KEY")),
	}

	if cfg.Port == "" {
		cfg.Port = "8080"
	}
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.SupabaseURL == "" {
		return Config{}, fmt.Errorf("SUPABASE_URL is required")
	}
	if cfg.SupabasePublishableKey == "" {
		return Config{}, fmt.Errorf("SUPABASE_PUBLISHABLE_KEY is required")
	}

	return cfg, nil
}
