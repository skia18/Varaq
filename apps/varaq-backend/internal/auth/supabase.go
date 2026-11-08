package auth

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

type User struct {
	ID string `json:"id"`
}

type Verifier interface {
	VerifyToken(ctx context.Context, token string) (User, error)
}

type SupabaseVerifier struct {
	BaseURL         string
	PublishableKey  string
	Client          *http.Client
	CacheTTL        time.Duration
	MaxCacheEntries int
	Now             func() time.Time

	cacheMu sync.Mutex
	cache   map[[sha256.Size]byte]cachedVerification
}

type cachedVerification struct {
	User      User
	ExpiresAt time.Time
}

func NewSupabaseVerifier(baseURL, publishableKey string) *SupabaseVerifier {
	return &SupabaseVerifier{
		BaseURL:        strings.TrimRight(baseURL, "/"),
		PublishableKey: publishableKey,
		Client: &http.Client{
			Timeout: 5 * time.Second,
		},
		CacheTTL:        30 * time.Second,
		MaxCacheEntries: 1_024,
		Now:             time.Now,
		cache:           make(map[[sha256.Size]byte]cachedVerification),
	}
}

func (v *SupabaseVerifier) cachedUser(token string) (User, bool) {
	if v.CacheTTL <= 0 {
		return User{}, false
	}
	now := time.Now()
	if v.Now != nil {
		now = v.Now()
	}
	key := sha256.Sum256([]byte(token))
	v.cacheMu.Lock()
	defer v.cacheMu.Unlock()
	entry, ok := v.cache[key]
	if !ok || !now.Before(entry.ExpiresAt) {
		delete(v.cache, key)
		return User{}, false
	}
	return entry.User, true
}

func (v *SupabaseVerifier) cacheUser(token string, user User) {
	if v.CacheTTL <= 0 || v.MaxCacheEntries <= 0 {
		return
	}
	now := time.Now()
	if v.Now != nil {
		now = v.Now()
	}
	key := sha256.Sum256([]byte(token))
	v.cacheMu.Lock()
	defer v.cacheMu.Unlock()
	if v.cache == nil {
		v.cache = make(map[[sha256.Size]byte]cachedVerification)
	}
	if len(v.cache) >= v.MaxCacheEntries {
		for cachedKey, entry := range v.cache {
			if !now.Before(entry.ExpiresAt) {
				delete(v.cache, cachedKey)
			}
		}
	}
	if len(v.cache) >= v.MaxCacheEntries {
		for cachedKey := range v.cache {
			delete(v.cache, cachedKey)
			break
		}
	}
	v.cache[key] = cachedVerification{User: user, ExpiresAt: now.Add(v.CacheTTL)}
}

func (v *SupabaseVerifier) VerifyToken(ctx context.Context, token string) (User, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return User{}, fmt.Errorf("missing token")
	}
	if user, ok := v.cachedUser(token); ok {
		return user, nil
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		v.BaseURL+"/auth/v1/user",
		nil,
	)
	if err != nil {
		return User{}, fmt.Errorf("create auth request: %w", err)
	}

	req.Header.Set("apikey", v.PublishableKey)
	req.Header.Set("Authorization", "Bearer "+token)

	client := v.Client
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}

	resp, err := client.Do(req)
	if err != nil {
		return User{}, fmt.Errorf("verify Supabase token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return User{}, fmt.Errorf("Supabase rejected token")
	}

	var user User
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return User{}, fmt.Errorf("decode Supabase user: %w", err)
	}
	if user.ID == "" {
		return User{}, fmt.Errorf("Supabase response did not contain a user ID")
	}
	v.cacheUser(token, user)

	return user, nil
}
