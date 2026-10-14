package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	DatabaseURL string
}

func Load() (Config, error) {
	// Load local development variables if .env exists.
	// In production, variables can come from the environment.
	_ = godotenv.Load()

	cfg := Config{
		Port:        strings.TrimSpace(os.Getenv("PORT")),
		DatabaseURL: strings.TrimSpace(os.Getenv("DATABASE_URL")),
	}

	if cfg.Port == "" {
		cfg.Port = "8080"
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}

	return cfg, nil
}
