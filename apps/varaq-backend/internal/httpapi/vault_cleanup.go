package httpapi

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"log"
	"time"
)

// ReconcileVaultTransfers removes only sources with a committed publication receipt.
// The receipt survives cleanup, owner deletion, and retries.
func ReconcileVaultTransfers(ctx context.Context, db *pgxpool.Pool) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `DELETE FROM varaq_private.vault_drafts d USING varaq_private.publication_operations o WHERE d.id=o.draft_id AND d.user_id=o.user_id AND o.cleanup_pending AND o.published_at < now()-interval '5 minutes'`)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE varaq_private.publication_operations o SET cleanup_pending=false WHERE cleanup_pending AND NOT EXISTS(SELECT 1 FROM varaq_private.vault_drafts d WHERE d.id=o.draft_id)`)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func RunVaultCleanup(ctx context.Context, db *pgxpool.Pool) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			work, cancel := context.WithTimeout(ctx, 15*time.Second)
			err := ReconcileVaultTransfers(work, db)
			cancel()
			if err != nil && ctx.Err() == nil {
				log.Print("Vault cleanup failed; will retry")
			}
		}
	}
}
