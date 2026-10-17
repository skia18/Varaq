package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type User struct {
	ID string `json:"id"`
}

type Verifier interface {
	VerifyToken(ctx context.Context, token string) (User, error)
}

type SupabaseVerifier struct {
	BaseURL        string
	PublishableKey string
	Client         *http.Client
}

func NewSupabaseVerifier(baseURL, publishableKey string) *SupabaseVerifier {
	return &SupabaseVerifier{
		BaseURL:        strings.TrimRight(baseURL, "/"),
		PublishableKey: publishableKey,
		Client: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

func (v *SupabaseVerifier) VerifyToken(ctx context.Context, token string) (User, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return User{}, fmt.Errorf("missing token")
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

	return user, nil
}
