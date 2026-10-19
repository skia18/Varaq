package httpapi

import (
	"encoding/json"
	"errors"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
	"net/http"
	"time"
)

type vaultReturn struct {
	DraftID   string         `json:"draftId"`
	PersonaID string         `json:"personaId"`
	UpdatedAt time.Time      `json:"updatedAt"`
	Envelope  *vaultEnvelope `json:"envelope"`
	Completed bool           `json:"completed"`
}

func (h PieceHandler) ReturnToVault(w http.ResponseWriter, r *http.Request) {
	h.returnToVault(w, r, false)
}
func (h PieceHandler) FinalizeReturnToVault(w http.ResponseWriter, r *http.Request) {
	h.returnToVault(w, r, true)
}
func (h PieceHandler) returnToVault(w http.ResponseWriter, r *http.Request, finalize bool) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		vaultError(w, 401, "unauthorized", "A valid access token is required.")
		return
	}
	source := chi.URLParam(r, "pieceID")
	if !uuidPattern.MatchString(source) {
		writeBadRequest(w, "Invalid piece UUID.")
		return
	}
	if r.Method == "GET" {
		var result vaultReturn
		var raw []byte
		err := h.DB.QueryRow(r.Context(), `SELECT draft_id,persona_id,source_updated_at,envelope,completed FROM varaq_private.vault_returns WHERE source_piece_id=$1::uuid AND user_id=$2::uuid`, source, u.ID).Scan(&result.DraftID, &result.PersonaID, &result.UpdatedAt, &raw, &result.Completed)
		if errors.Is(err, pgx.ErrNoRows) {
			vaultError(w, 404, "not_found", "No move has been staged.")
			return
		}
		if err != nil {
			writeInternalError(w)
			return
		}
		if raw != nil {
			if json.Unmarshal(raw, &result.Envelope) != nil {
				writeInternalError(w)
				return
			}
		}
		writeJSON(w, 200, result)
		return
	}
	var req struct {
		DraftID   string        `json:"draftId"`
		UpdatedAt time.Time     `json:"updatedAt"`
		Envelope  vaultEnvelope `json:"envelope"`
	}
	if !decodeVault(w, r, &req) {
		return
	}
	if !uuidPattern.MatchString(req.DraftID) || source == req.DraftID || req.UpdatedAt.IsZero() {
		writeBadRequest(w, "A fresh draft UUID and source timestamp are required.")
		return
	}
	if !finalize && (req.Envelope.Version != 1 || !validSealed(req.Envelope.Key, 48) || !validSealed(req.Envelope.Content, 250000)) {
		writeBadRequest(w, "Invalid encrypted envelope.")
		return
	}
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		writeInternalError(w)
		return
	}
	defer tx.Rollback(r.Context())
	// Lock source first, then destination: all return operations use this order.
	_, err = tx.Exec(r.Context(), `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, source)
	if err != nil {
		writeInternalError(w)
		return
	}
	var old vaultReturn
	var raw []byte
	err = tx.QueryRow(r.Context(), `SELECT draft_id,persona_id,source_updated_at,envelope,completed FROM varaq_private.vault_returns WHERE source_piece_id=$1::uuid AND user_id=$2::uuid FOR UPDATE`, source, u.ID).Scan(&old.DraftID, &old.PersonaID, &old.UpdatedAt, &raw, &old.Completed)
	found := err == nil
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		writeInternalError(w)
		return
	}
	if found && old.Completed {
		if old.DraftID != req.DraftID {
			vaultError(w, 409, "move_conflict", "This publication has already moved. Check its move status.")
			return
		}
		writeJSON(w, 200, map[string]any{"draftId": old.DraftID, "completed": true})
		return
	}
	if finalize && (!found || old.DraftID != req.DraftID || !old.UpdatedAt.Equal(req.UpdatedAt)) {
		vaultError(w, 409, "move_conflict", "The staged move changed. Reload and verify it again.")
		return
	}
	var persona string
	err = tx.QueryRow(r.Context(), `SELECT p.persona_id FROM public.pieces p JOIN public.personas a ON a.id=p.persona_id WHERE p.id=$1::uuid AND a.user_id=$2::uuid AND p.status='published' AND p.visibility IN ('public','unlisted') AND p.updated_at=$3 FOR UPDATE OF p`, source, u.ID, req.UpdatedAt).Scan(&persona)
	if errors.Is(err, pgx.ErrNoRows) {
		vaultError(w, 409, "source_changed", "Publication changed or is unavailable. It has not been removed.")
		return
	}
	if err != nil {
		writeInternalError(w)
		return
	}
	if finalize {
		// Never reuse a previously published draft identity: its receipt must remain intact.
		_, err = tx.Exec(r.Context(), `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, req.DraftID)
		if err != nil {
			writeInternalError(w)
			return
		}
		var occupied bool
		err = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM public.pieces WHERE id=$1::uuid UNION ALL SELECT 1 FROM varaq_private.vault_drafts WHERE id=$1::uuid UNION ALL SELECT 1 FROM varaq_private.publication_operations WHERE draft_id=$1::uuid)`, req.DraftID).Scan(&occupied)
		if err != nil {
			writeInternalError(w)
			return
		}
		if occupied {
			vaultError(w, 409, "move_conflict", "Destination is already in use. Publication preserved.")
			return
		}
		_, err = tx.Exec(r.Context(), `INSERT INTO varaq_private.vault_drafts(id,user_id,persona_id,revision,envelope) VALUES($1::uuid,$2::uuid,$3::uuid,1,$4)`, req.DraftID, u.ID, persona, raw)
		if err != nil {
			writeInternalError(w)
			return
		}
		_, err = tx.Exec(r.Context(), `DELETE FROM public.pieces WHERE id=$1::uuid`, source)
		if err != nil {
			writeInternalError(w)
			return
		}
		_, err = tx.Exec(r.Context(), `UPDATE varaq_private.vault_returns SET completed=true,envelope=NULL WHERE source_piece_id=$1::uuid`, source)
	} else {
		// Same-source retries preserve the staged envelope for readback verification.
		if found && old.UpdatedAt.Equal(req.UpdatedAt) {
			if old.DraftID != req.DraftID {
				vaultError(w, 409, "move_conflict", "Another move is staged. Reload to resume it.")
				return
			}
			writeJSON(w, 200, map[string]any{"draftId": old.DraftID, "completed": false})
			return
		}
		raw, _ = json.Marshal(req.Envelope)
		var tag pgconn.CommandTag
		tag, err = tx.Exec(r.Context(), `INSERT INTO varaq_private.vault_returns(source_piece_id,user_id,draft_id,persona_id,source_updated_at,envelope) SELECT $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6 WHERE EXISTS(SELECT 1 FROM varaq_private.vaults WHERE user_id=$2::uuid) ON CONFLICT(source_piece_id) DO UPDATE SET draft_id=EXCLUDED.draft_id,persona_id=EXCLUDED.persona_id,source_updated_at=EXCLUDED.source_updated_at,envelope=EXCLUDED.envelope WHERE vault_returns.user_id=EXCLUDED.user_id AND NOT vault_returns.completed`, source, u.ID, req.DraftID, persona, req.UpdatedAt, raw)
		if err == nil && tag.RowsAffected() != 1 {
			vaultError(w, 409, "vault_required", "Create and unlock the Vault before moving writing.")
			return
		}
	}
	if err != nil {
		writeInternalError(w)
		return
	}
	if tx.Commit(r.Context()) != nil {
		writeInternalError(w)
		return
	}
	writeJSON(w, 200, map[string]any{"draftId": req.DraftID, "completed": finalize})
}
