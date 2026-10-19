package httpapi

import (
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
)

type CollectionHandler struct{ DB *pgxpool.Pool }
type Collection struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	SystemType  *string   `json:"systemType"`
	Visibility  string    `json:"visibility"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	PieceIDs    []string  `json:"pieceIds"`
	Curator     *Persona  `json:"curator,omitempty"`
}
type collectionInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Visibility  string `json:"visibility"`
	PieceID     string `json:"pieceId"`
}

func validCollection(in collectionInput) bool {
	return utf8.RuneCountInString(strings.TrimSpace(in.Name)) >= 1 && utf8.RuneCountInString(in.Name) <= 100 && utf8.RuneCountInString(in.Description) <= 1000 && (in.Visibility == "private" || in.Visibility == "public") && (in.PieceID == "" || uuidPattern.MatchString(in.PieceID))
}

const collectionSelect = `SELECT c.id,c.name,c.description,c.system_type,c.visibility,c.created_at,c.updated_at,
 ARRAY(SELECT i.piece_id::text FROM public.collection_items i JOIN public.pieces p ON p.id=i.piece_id WHERE i.collection_id=c.id AND p.status='published' AND p.visibility='public' ORDER BY i.created_at DESC,i.piece_id)
 FROM public.collections c `

func scanCollection(row pgx.Row) (Collection, error) {
	var c Collection
	err := row.Scan(&c.ID, &c.Name, &c.Description, &c.SystemType, &c.Visibility, &c.CreatedAt, &c.UpdatedAt, &c.PieceIDs)
	return c, err
}
func (h CollectionHandler) List(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	if _, err := h.DB.Exec(r.Context(), `INSERT INTO public.collections(user_id,name,system_type) VALUES($1,'Saved','saved') ON CONFLICT DO NOTHING`, u.ID); err != nil {
		writeInternalError(w)
		return
	}
	rows, err := h.DB.Query(r.Context(), collectionSelect+`WHERE c.user_id=$1 ORDER BY c.system_type NULLS LAST,c.created_at`, u.ID)
	if err != nil {
		writeInternalError(w)
		return
	}
	defer rows.Close()
	items := []Collection{}
	for rows.Next() {
		c, err := scanCollection(rows)
		if err != nil {
			writeInternalError(w)
			return
		}
		items = append(items, c)
	}
	if rows.Err() != nil {
		writeInternalError(w)
		return
	}
	writeJSON(w, 200, items)
}
func (h CollectionHandler) Public(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "collectionID")
	if !uuidPattern.MatchString(id) {
		http.NotFound(w, r)
		return
	}
	c, err := scanCollection(h.DB.QueryRow(r.Context(), collectionSelect+`WHERE c.id=$1 AND c.visibility='public' AND c.system_type IS NULL`, id))
	if err == pgx.ErrNoRows {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		writeInternalError(w)
		return
	}
	var curator Persona
	err = h.DB.QueryRow(r.Context(), `SELECT p.id,p.handle,p.display_name,p.bio,p.created_at FROM public.personas p JOIN public.collections c ON c.user_id=p.user_id WHERE c.id=$1`, id).Scan(&curator.ID, &curator.Handle, &curator.DisplayName, &curator.Bio, &curator.CreatedAt)
	if err != nil && err != pgx.ErrNoRows {
		writeInternalError(w)
		return
	}
	if err == nil {
		c.Curator = &curator
	}
	writeJSON(w, 200, c)
}
func (h CollectionHandler) Create(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	var in collectionInput
	if !decodeVault(w, r, &in) {
		return
	}
	if in.Visibility == "" {
		in.Visibility = "private"
	}
	in.Name = strings.TrimSpace(in.Name)
	if !validCollection(in) {
		writeBadRequest(w, "Provide a name (1–100 characters), description (up to 1000), and private or public visibility.")
		return
	}
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		writeInternalError(w)
		return
	}
	defer tx.Rollback(r.Context())
	var id string
	err = tx.QueryRow(r.Context(), `INSERT INTO public.collections(user_id,name,description,visibility) VALUES($1,$2,$3,$4) RETURNING id`, u.ID, in.Name, in.Description, in.Visibility).Scan(&id)
	if err != nil {
		writeInternalError(w)
		return
	}
	if in.PieceID != "" {
		tag, err := tx.Exec(r.Context(), `INSERT INTO public.collection_items(collection_id,piece_id) SELECT $1,id FROM public.pieces WHERE id=$2 AND status='published' AND visibility='public'`, id, in.PieceID)
		if err != nil {
			writeInternalError(w)
			return
		}
		if tag.RowsAffected() == 0 {
			writeBadRequest(w, "This piece is no longer available.")
			return
		}
	}
	c, err := scanCollection(tx.QueryRow(r.Context(), collectionSelect+`WHERE c.id=$1`, id))
	if err != nil {
		writeInternalError(w)
		return
	}
	if tx.Commit(r.Context()) != nil {
		writeInternalError(w)
		return
	}
	writeJSON(w, 201, c)
}
func (h CollectionHandler) Update(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id := chi.URLParam(r, "collectionID")
	if !uuidPattern.MatchString(id) {
		http.NotFound(w, r)
		return
	}
	var in collectionInput
	if !decodeVault(w, r, &in) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if !validCollection(in) || in.PieceID != "" {
		writeBadRequest(w, "Invalid collection details.")
		return
	}
	tag, err := h.DB.Exec(r.Context(), `UPDATE public.collections SET name=$3,description=$4,visibility=$5,updated_at=now() WHERE id=$1 AND user_id=$2 AND system_type IS NULL`, id, u.ID, in.Name, in.Description, in.Visibility)
	if err != nil {
		writeInternalError(w)
		return
	}
	if tag.RowsAffected() == 0 {
		http.NotFound(w, r)
		return
	}
	w.WriteHeader(204)
}
func (h CollectionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id := chi.URLParam(r, "collectionID")
	if !uuidPattern.MatchString(id) {
		http.NotFound(w, r)
		return
	}
	tag, err := h.DB.Exec(r.Context(), `DELETE FROM public.collections WHERE id=$1 AND user_id=$2 AND system_type IS NULL`, id, u.ID)
	if err != nil {
		writeInternalError(w)
		return
	}
	if tag.RowsAffected() == 0 {
		http.NotFound(w, r)
		return
	}
	w.WriteHeader(204)
}
func (h CollectionHandler) Membership(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, piece := chi.URLParam(r, "collectionID"), chi.URLParam(r, "pieceID")
	if !uuidPattern.MatchString(id) || !uuidPattern.MatchString(piece) {
		writeBadRequest(w, "Invalid ID.")
		return
	}
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		writeInternalError(w)
		return
	}
	defer tx.Rollback(r.Context())
	var owned string
	err = tx.QueryRow(r.Context(), `SELECT id FROM public.collections WHERE id=$1 AND user_id=$2 FOR UPDATE`, id, u.ID).Scan(&owned)
	if err == pgx.ErrNoRows {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		writeInternalError(w)
		return
	}
	if r.Method == http.MethodPut {
		var available bool
		err = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM public.pieces WHERE id=$1 AND status='published' AND visibility='public')`, piece).Scan(&available)
		if err != nil {
			writeInternalError(w)
			return
		}
		if !available {
			writeBadRequest(w, "This piece is no longer available.")
			return
		}
		_, err = tx.Exec(r.Context(), `INSERT INTO public.collection_items(collection_id,piece_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, id, piece)
	} else {
		_, err = tx.Exec(r.Context(), `DELETE FROM public.collection_items WHERE collection_id=$1 AND piece_id=$2`, id, piece)
	}
	if err != nil {
		writeInternalError(w)
		return
	}
	if _, err = tx.Exec(r.Context(), `UPDATE public.collections SET updated_at=now() WHERE id=$1`, id); err != nil {
		writeInternalError(w)
		return
	}
	if tx.Commit(r.Context()) != nil {
		writeInternalError(w)
		return
	}
	w.WriteHeader(204)
}
