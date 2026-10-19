package config

import (
	"os"
	"strings"
	"testing"
)

func setupConfig(t *testing.T) {
	t.Helper()
	t.Chdir(t.TempDir()) // Never read a developer's real .env file.
	for key, value := range map[string]string{"PORT": "", "DATABASE_URL": "postgres://test", "SUPABASE_URL": "https://auth.example.test", "SUPABASE_PUBLISHABLE_KEY": "test-key"} {
		t.Setenv(key, value)
	}
}
func TestLoadDefaultsAndNormalization(t *testing.T) {
	setupConfig(t)
	t.Setenv("DATABASE_URL", "  postgres://test  ")
	t.Setenv("SUPABASE_URL", " https://auth.example.test/// ")
	t.Setenv("SUPABASE_PUBLISHABLE_KEY", " test-key ")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != "8080" || cfg.DatabaseURL != "postgres://test" || cfg.SupabaseURL != "https://auth.example.test" || cfg.SupabasePublishableKey != "test-key" {
		t.Fatalf("unexpected config: %+v", cfg)
	}
	t.Setenv("PORT", " 9090 ")
	cfg, err = Load()
	if err != nil || cfg.Port != "9090" {
		t.Fatalf("port=%q err=%v", cfg.Port, err)
	}
}
func TestLoadRequiredVariables(t *testing.T) {
	for _, key := range []string{"DATABASE_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"} {
		t.Run(key, func(t *testing.T) {
			setupConfig(t)
			t.Setenv(key, " \t ")
			cfg, err := Load()
			if err == nil || !strings.Contains(err.Error(), key+" is required") || cfg != (Config{}) {
				t.Fatalf("config=%+v err=%v", cfg, err)
			}
		})
	}
}
func TestDotenvDoesNotOverrideEnvironment(t *testing.T) {
	setupConfig(t)
	if err := os.WriteFile(".env", []byte("PORT=1234\nDATABASE_URL=postgres://wrong\n"), 0600); err != nil {
		t.Fatal(err)
	}
	cfg, err := Load()
	if err != nil || cfg.DatabaseURL != "postgres://test" || cfg.Port != "8080" {
		t.Fatalf("config=%+v err=%v", cfg, err)
	}
}

func TestLoadDotenvFallback(t *testing.T) {
	setupConfig(t)
	if err := os.Unsetenv("PORT"); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(".env", []byte("PORT=1234\n"), 0600); err != nil {
		t.Fatal(err)
	}
	cfg, err := Load()
	if err != nil || cfg.Port != "1234" {
		t.Fatalf("port=%q err=%v", cfg.Port, err)
	}
}
