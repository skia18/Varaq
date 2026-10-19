package httpapi

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

type sealedValue struct {
	IV   string `json:"iv"`
	Data string `json:"data"`
}
type vaultConfig struct {
	Version    int         `json:"version"`
	Salt       string      `json:"salt"`
	Passphrase sealedValue `json:"passphrase"`
	Recovery   sealedValue `json:"recovery"`
}
type vaultEnvelope struct {
	Version int         `json:"version"`
	Content sealedValue `json:"content"`
	Key     sealedValue `json:"key"`
}
type vaultDraft struct {
	ID        string        `json:"id"`
	PersonaID string        `json:"personaId"`
	Revision  int           `json:"revision"`
	Envelope  vaultEnvelope `json:"envelope"`
	CreatedAt time.Time     `json:"createdAt"`
	UpdatedAt time.Time     `json:"updatedAt"`
}

func vaultError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}
func decodeVault(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 400000)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		writeBadRequest(w, "Invalid request body.")
		return false
	}
	if err := d.Decode(new(any)); !errors.Is(err, io.EOF) {
		writeBadRequest(w, "Expected one JSON object.")
		return false
	}
	return true
}
func validSealed(s sealedValue, max int) bool {
	iv, e := base64.StdEncoding.DecodeString(s.IV)
	if e != nil || len(iv) != 12 {
		return false
	}
	b, e := base64.StdEncoding.DecodeString(s.Data)
	return e == nil && len(b) >= 16 && len(b) <= max
}
func validConfig(c vaultConfig) bool {
	salt, e := base64.StdEncoding.DecodeString(c.Salt)
	return c.Version == 1 && e == nil && len(salt) == 16 && validSealed(c.Passphrase, 48) && validSealed(c.Recovery, 48)
}
func (h PieceHandler) VaultConfig(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	if r.Method == "GET" {
		var raw []byte
		var rev int
		err := h.DB.QueryRow(r.Context(), `SELECT config,revision FROM varaq_private.vaults WHERE user_id=$1::uuid`, u.ID).Scan(&raw, &rev)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, 200, map[string]any{"config": nil, "revision": 0})
			return
		}
		if err != nil {
			writeInternalError(w)
			return
		}
		writeJSON(w, 200, map[string]any{"config": json.RawMessage(raw), "revision": rev})
		return
	}
	var req struct {
		Config   vaultConfig `json:"config"`
		Revision int         `json:"revision"`
	}
	if !decodeVault(w, r, &req) {
		return
	}
	if !validConfig(req.Config) || req.Revision < 0 {
		writeBadRequest(w, "Invalid Vault configuration.")
		return
	}
	raw, _ := json.Marshal(req.Config)
	var rev int
	var err error
	if req.Revision == 0 {
		err = h.DB.QueryRow(r.Context(), `INSERT INTO varaq_private.vaults(user_id,config) VALUES($1::uuid,$2) ON CONFLICT DO NOTHING RETURNING revision`, u.ID, raw).Scan(&rev)
	} else {
		err = h.DB.QueryRow(r.Context(), `UPDATE varaq_private.vaults SET config=$2,revision=revision+1 WHERE user_id=$1::uuid AND revision=$3 RETURNING revision`, u.ID, raw, req.Revision).Scan(&rev)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		vaultError(w, 409, "revision_conflict", "Vault configuration changed. Reload before retrying.")
		return
	}
	if err != nil {
		writeInternalError(w)
		return
	}
	writeJSON(w, 200, map[string]int{"revision": rev})
}
func (h PieceHandler) VaultDrafts(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	rows, err := h.DB.Query(r.Context(), `SELECT d.id,d.persona_id,d.revision,d.envelope,d.created_at,d.updated_at FROM varaq_private.vault_drafts d WHERE d.user_id=$1::uuid AND d.legacy_updated_at IS NULL AND NOT EXISTS(SELECT 1 FROM varaq_private.publication_operations o WHERE o.draft_id=d.id) ORDER BY d.updated_at DESC,d.id`, u.ID)
	if err != nil {
		writeInternalError(w)
		return
	}
	defer rows.Close()
	items := []vaultDraft{}
	for rows.Next() {
		var d vaultDraft
		var raw []byte
		if err = rows.Scan(&d.ID, &d.PersonaID, &d.Revision, &raw, &d.CreatedAt, &d.UpdatedAt); err != nil {
			writeInternalError(w)
			return
		}
		if json.Unmarshal(raw, &d.Envelope) != nil {
			writeInternalError(w)
			return
		}
		items = append(items, d)
	}
	if rows.Err() != nil {
		writeInternalError(w)
		return
	}
	writeJSON(w, 200, map[string]any{"items": items})
}
func (h PieceHandler) VaultDraft(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id := chi.URLParam(r, "pieceID")
	if !uuidPattern.MatchString(id) {
		writeBadRequest(w, "Invalid draft UUID.")
		return
	}
	if r.Method == "GET" {
		var d vaultDraft
		var raw []byte
		err := h.DB.QueryRow(r.Context(), `SELECT id,persona_id,revision,envelope,created_at,updated_at FROM varaq_private.vault_drafts WHERE id=$1::uuid AND user_id=$2::uuid AND NOT EXISTS(SELECT 1 FROM varaq_private.publication_operations WHERE draft_id=$1::uuid)`, id, u.ID).Scan(&d.ID, &d.PersonaID, &d.Revision, &raw, &d.CreatedAt, &d.UpdatedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			vaultError(w, 404, "not_found", "Draft not found.")
			return
		}
		if err != nil || json.Unmarshal(raw, &d.Envelope) != nil {
			writeInternalError(w)
			return
		}
		writeJSON(w, 200, d)
		return
	}
	var req struct {
		PersonaID string        `json:"personaId"`
		Revision  int           `json:"revision"`
		Envelope  vaultEnvelope `json:"envelope"`
	}
	if !decodeVault(w, r, &req) {
		return
	}
	if req.Revision < 0 {
		writeBadRequest(w, "Invalid revision.")
		return
	}
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		writeInternalError(w)
		return
	}
	defer tx.Rollback(r.Context())
	// Serialize creation, save, delete and publication, including absent rows.
	_, err = tx.Exec(r.Context(), `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, id)
	if err != nil {
		writeInternalError(w)
		return
	}
	var transferred bool
	err = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM varaq_private.publication_operations WHERE draft_id=$1::uuid)`, id).Scan(&transferred)
	if err != nil {
		writeInternalError(w)
		return
	}
	if transferred {
		vaultError(w, 409, "transferred", "This draft has already left the Vault.")
		return
	}
	if r.Method == "DELETE" {
		tag, e := tx.Exec(r.Context(), `DELETE FROM varaq_private.vault_drafts WHERE id=$1::uuid AND user_id=$2::uuid AND revision=$3`, id, u.ID, req.Revision)
		if e != nil {
			writeInternalError(w)
			return
		}
		if tag.RowsAffected() != 1 {
			vaultError(w, 409, "revision_conflict", "Draft changed or is unavailable.")
			return
		}
		if tx.Commit(r.Context()) != nil {
			writeInternalError(w)
			return
		}
		w.WriteHeader(204)
		return
	}
	if !uuidPattern.MatchString(req.PersonaID) || req.Envelope.Version != 1 || !validSealed(req.Envelope.Key, 48) || !validSealed(req.Envelope.Content, 250000) {
		writeBadRequest(w, "Invalid encrypted envelope.")
		return
	}
	raw, _ := json.Marshal(req.Envelope)
	var already int
	err = tx.QueryRow(r.Context(), `SELECT revision FROM varaq_private.vault_drafts WHERE id=$1::uuid AND user_id=$2::uuid AND persona_id=$3::uuid AND revision=$5+1 AND envelope=$4::jsonb AND legacy_updated_at IS NULL`, id, u.ID, req.PersonaID, raw, req.Revision).Scan(&already)
	if err == nil {
		writeJSON(w, 200, map[string]int{"revision": already})
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		writeInternalError(w)
		return
	}
	var revision int
	err = tx.QueryRow(r.Context(), `INSERT INTO varaq_private.vault_drafts(id,user_id,persona_id,revision,envelope)
 SELECT $1::uuid,$2::uuid,$3::uuid,1,$4 WHERE $5=0 AND EXISTS(SELECT 1 FROM public.personas WHERE id=$3::uuid AND user_id=$2::uuid) AND NOT EXISTS(SELECT 1 FROM public.pieces WHERE id=$1::uuid)
 ON CONFLICT(id) DO UPDATE SET envelope=EXCLUDED.envelope,revision=vault_drafts.revision+1,updated_at=now()
 WHERE vault_drafts.user_id=$2::uuid AND vault_drafts.persona_id=$3::uuid AND vault_drafts.revision=$5 AND vault_drafts.legacy_updated_at IS NULL
 RETURNING revision`, id, u.ID, req.PersonaID, raw, req.Revision).Scan(&revision)
	// INSERT SELECT needs a row for updates too; update existing separately.
	if errors.Is(err, pgx.ErrNoRows) && req.Revision > 0 {
		err = tx.QueryRow(r.Context(), `UPDATE varaq_private.vault_drafts SET envelope=$4,revision=revision+1,updated_at=now() WHERE id=$1::uuid AND user_id=$2::uuid AND persona_id=$3::uuid AND revision=$5 AND legacy_updated_at IS NULL RETURNING revision`, id, u.ID, req.PersonaID, raw, req.Revision).Scan(&revision)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		vaultError(w, 409, "revision_conflict", "Draft changed or is unavailable. Reload before saving.")
		return
	}
	if err != nil {
		writeInternalError(w)
		return
	}
	if tx.Commit(r.Context()) != nil {
		writeInternalError(w)
		return
	}
	writeJSON(w, 200, map[string]int{"revision": revision})
}

type publishVaultRequest struct {
	OperationID    string `json:"operationId"`
	SourceRevision int    `json:"sourceRevision"`
	Title          string `json:"title"`
	Body           string `json:"body"`
	Type           string `json:"type"`
	Visibility     string `json:"visibility"`
}

func (h PieceHandler) PublishVault(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id := chi.URLParam(r, "pieceID")
	var req publishVaultRequest
	if !decodeVault(w, r, &req) {
		return
	}
	if !uuidPattern.MatchString(id) || !uuidPattern.MatchString(req.OperationID) || req.SourceRevision < 1 || !allowedPieceTypes[req.Type] || (req.Visibility != "public" && req.Visibility != "unlisted") || utf8.RuneCountInString(strings.TrimSpace(req.Title)) < 1 || utf8.RuneCountInString(req.Title) > 200 || strings.TrimSpace(req.Body) == "" || utf8.RuneCountInString(req.Body) > 50000 {
		writeBadRequest(w, "Invalid publication snapshot or visibility.")
		return
	}
	raw, _ := json.Marshal(req)
	sum := sha256.Sum256(raw)
	fingerprint := hex.EncodeToString(sum[:])
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		writeInternalError(w)
		return
	}
	defer tx.Rollback(r.Context())
	if _, err = tx.Exec(r.Context(), `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, id); err != nil {
		writeInternalError(w)
		return
	}
	var oldHash, owner string
	err = tx.QueryRow(r.Context(), `SELECT fingerprint,user_id FROM varaq_private.publication_operations WHERE draft_id=$1::uuid`, id).Scan(&oldHash, &owner)
	if err == nil {
		if owner != u.ID || oldHash != fingerprint {
			vaultError(w, 409, "publication_conflict", "This source was already published with a different operation.")
			return
		}
		writeJSON(w, 200, map[string]any{"pieceId": id, "published": true})
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		writeInternalError(w)
		return
	}
	var persona string
	err = tx.QueryRow(r.Context(), `SELECT d.persona_id FROM varaq_private.vault_drafts d JOIN public.personas p ON p.id=d.persona_id WHERE d.id=$1::uuid AND d.user_id=$2::uuid AND p.user_id=$2::uuid AND d.revision=$3 AND d.legacy_updated_at IS NULL FOR UPDATE OF d`, id, u.ID, req.SourceRevision).Scan(&persona)
	if errors.Is(err, pgx.ErrNoRows) {
		vaultError(w, 409, "revision_conflict", "Draft changed or is unavailable.")
		return
	}
	if err != nil {
		writeInternalError(w)
		return
	}
	// UUID suffix avoids title-slug collisions without retrying an aborted transaction.
	slug := makePieceSlug(req.Title)
	if len(slug) > 170 {
		slug = slug[:170]
	}
	if slug == "" {
		slug = "piece"
	}
	slug += "-" + id
	_, err = tx.Exec(r.Context(), `INSERT INTO public.pieces(id,persona_id,slug,title,body,type,status,visibility,published_at) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,'published',$7,now())`, id, persona, slug, req.Title, req.Body, req.Type, req.Visibility)
	if err != nil {
		writeInternalError(w)
		return
	}
	_, err = tx.Exec(r.Context(), `INSERT INTO varaq_private.publication_operations(draft_id,user_id,operation_id,piece_id,source_revision,fingerprint) VALUES($1::uuid,$2::uuid,$3::uuid,$1::uuid,$4,$5)`, id, u.ID, req.OperationID, req.SourceRevision, fingerprint)
	if err != nil {
		writeInternalError(w)
		return
	}
	if tx.Commit(r.Context()) != nil {
		writeInternalError(w)
		return
	}
	writeJSON(w, 200, map[string]any{"pieceId": id, "published": true, "cleanupPending": true})
}
func (h PieceHandler) VaultTransfer(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id := chi.URLParam(r, "pieceID")
	if !uuidPattern.MatchString(id) {
		writeBadRequest(w, "Invalid UUID.")
		return
	}
	if r.Method == "POST" {
		tx, err := h.DB.Begin(r.Context())
		if err != nil {
			writeInternalError(w)
			return
		}
		defer tx.Rollback(r.Context())
		_, err = tx.Exec(r.Context(), `DELETE FROM varaq_private.vault_drafts d USING varaq_private.publication_operations o WHERE d.id=o.draft_id AND o.draft_id=$1::uuid AND o.user_id=$2::uuid`, id, u.ID)
		if err != nil {
			writeInternalError(w)
			return
		}
		tag, err := tx.Exec(r.Context(), `UPDATE varaq_private.publication_operations SET cleanup_pending=false WHERE draft_id=$1::uuid AND user_id=$2::uuid`, id, u.ID)
		if err != nil {
			writeInternalError(w)
			return
		}
		if tag.RowsAffected() == 0 {
			vaultError(w, 404, "not_found", "Publication not confirmed; draft preserved.")
			return
		}
		if tx.Commit(r.Context()) != nil {
			writeInternalError(w)
			return
		}
		w.WriteHeader(204)
		return
	}
	if id == "" {
		return
	}
	var pending bool
	err := h.DB.QueryRow(r.Context(), `SELECT cleanup_pending FROM varaq_private.publication_operations WHERE draft_id=$1::uuid AND user_id=$2::uuid`, id, u.ID).Scan(&pending)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, 200, map[string]any{"published": false})
		return
	}
	if err != nil {
		writeInternalError(w)
		return
	}
	writeJSON(w, 200, map[string]any{"published": true, "pieceId": id, "cleanupPending": pending})
}
func (h PieceHandler) VaultPending(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	rows, err := h.DB.Query(r.Context(), `SELECT draft_id FROM varaq_private.publication_operations WHERE user_id=$1::uuid AND cleanup_pending`, u.ID)
	if err != nil {
		writeInternalError(w)
		return
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var id string
		if rows.Scan(&id) != nil {
			writeInternalError(w)
			return
		}
		ids = append(ids, id)
	}
	if rows.Err() != nil {
		writeInternalError(w)
		return
	}
	writeJSON(w, 200, map[string]any{"ids": ids})
}

func (h PieceHandler) GetPublishedPiece(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "pieceID")
	if !uuidPattern.MatchString(id) {
		writeBadRequest(w, "Invalid UUID.")
		return
	}
	var p Piece
	err := h.DB.QueryRow(r.Context(), `SELECT id,persona_id,slug,title,body,type,status,visibility,published_at,created_at,updated_at FROM public.pieces WHERE id=$1::uuid AND status='published' AND visibility IN ('public','unlisted')`, id).Scan(&p.ID, &p.PersonaID, &p.Slug, &p.Title, &p.Body, &p.Type, &p.Status, &p.Visibility, &p.PublishedAt, &p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		vaultError(w, 404, "not_found", "Piece not found.")
		return
	}
	if err != nil {
		writeInternalError(w)
		return
	}
	writeJSON(w, 200, p)
}

func (h PieceHandler) ImportVault(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	var req struct {
		ID        string        `json:"id"`
		UpdatedAt time.Time     `json:"updatedAt"`
		Envelope  vaultEnvelope `json:"envelope"`
	}
	if !decodeVault(w, r, &req) {
		return
	}
	id := chi.URLParam(r, "pieceID")
	if id == "" {
		id = req.ID
	}
	if !uuidPattern.MatchString(id) || req.UpdatedAt.IsZero() {
		writeBadRequest(w, "Invalid legacy source.")
		return
	}
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		writeInternalError(w)
		return
	}
	defer tx.Rollback(r.Context())
	if _, err = tx.Exec(r.Context(), `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, id); err != nil {
		writeInternalError(w)
		return
	}
	if chi.URLParam(r, "pieceID") != "" {
		var saved time.Time
		err = tx.QueryRow(r.Context(), `SELECT legacy_updated_at FROM varaq_private.vault_drafts WHERE id=$1::uuid AND user_id=$2::uuid AND legacy_updated_at=$3 FOR UPDATE`, id, u.ID, req.UpdatedAt).Scan(&saved)
		if err != nil {
			vaultError(w, 409, "import_conflict", "Import not found or already finalized. Reload the Vault.")
			return
		}
		tag, e := tx.Exec(r.Context(), `DELETE FROM public.pieces p USING public.personas a WHERE p.id=$1::uuid AND a.id=p.persona_id AND a.user_id=$2::uuid AND p.status='draft' AND p.updated_at=$3`, id, u.ID, req.UpdatedAt)
		if e != nil {
			writeInternalError(w)
			return
		}
		if tag.RowsAffected() != 1 {
			vaultError(w, 409, "import_conflict", "Legacy source changed. It has been preserved.")
			return
		}
		_, err = tx.Exec(r.Context(), `UPDATE varaq_private.vault_drafts SET legacy_updated_at=NULL WHERE id=$1::uuid`, id)
	} else {
		if req.Envelope.Version != 1 || !validSealed(req.Envelope.Key, 48) || !validSealed(req.Envelope.Content, 250000) {
			writeBadRequest(w, "Invalid envelope.")
			return
		}
		var persona string
		err = tx.QueryRow(r.Context(), `SELECT p.persona_id FROM public.pieces p JOIN public.personas a ON a.id=p.persona_id WHERE p.id=$1::uuid AND a.user_id=$2::uuid AND p.status='draft' AND p.updated_at=$3 FOR UPDATE OF p`, id, u.ID, req.UpdatedAt).Scan(&persona)
		if err != nil {
			vaultError(w, 409, "import_conflict", "Legacy source changed. Reload before importing.")
			return
		}
		raw, _ := json.Marshal(req.Envelope)
		_, err = tx.Exec(r.Context(), `INSERT INTO varaq_private.vault_drafts(id,user_id,persona_id,revision,envelope,legacy_updated_at) VALUES($1::uuid,$2::uuid,$3::uuid,1,$4,$5) ON CONFLICT(id) DO UPDATE SET envelope=EXCLUDED.envelope,legacy_updated_at=EXCLUDED.legacy_updated_at
 WHERE vault_drafts.user_id=EXCLUDED.user_id AND vault_drafts.persona_id=EXCLUDED.persona_id AND vault_drafts.legacy_updated_at IS NOT NULL AND vault_drafts.legacy_updated_at<>EXCLUDED.legacy_updated_at`, id, u.ID, persona, raw, req.UpdatedAt)
	}
	if err != nil {
		writeInternalError(w)
		return
	}
	if tx.Commit(r.Context()) != nil {
		writeInternalError(w)
		return
	}
	w.WriteHeader(204)
}
