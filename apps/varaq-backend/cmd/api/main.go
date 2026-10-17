package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
	"github.com/skia18/varaq/apps/varaq-backend/internal/config"
	"github.com/skia18/varaq/apps/varaq-backend/internal/httpapi"
	"github.com/skia18/varaq/apps/varaq-backend/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load configuration: %v", err)
	}

	startupCtx, cancelStartup := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer cancelStartup()

	db, err := store.NewPostgres(startupCtx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("initialize database pool: %v", err)
	}
	defer db.Close()

	verifier := auth.NewSupabaseVerifier(
		cfg.SupabaseURL,
		cfg.SupabasePublishableKey,
	)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           httpapi.NewRouter(db, verifier),
		ReadHeaderTimeout: 5 * time.Second,
	}

	serverErrors := make(chan error, 1)

	go func() {
		log.Printf("Varaq API listening on :%s", cfg.Port)
		serverErrors <- server.ListenAndServe()
	}()

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	select {
	case err := <-serverErrors:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("HTTP server: %v", err)
		}

	case <-ctx.Done():
		log.Println("Shutting down Varaq API...")

		shutdownCtx, cancel := context.WithTimeout(
			context.Background(),
			10*time.Second,
		)
		defer cancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("graceful shutdown failed: %v", err)
			if closeErr := server.Close(); closeErr != nil {
				log.Printf("force close failed: %v", closeErr)
			}
		}

		log.Println("Varaq API stopped")
	}
}
