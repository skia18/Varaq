package auth

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type trackedBody struct {
	io.Reader
	closed bool
}

func (b *trackedBody) Close() error { b.closed = true; return nil }

func TestSupabaseVerifierRequest(t *testing.T) {
	verifier := NewSupabaseVerifier("https://auth.example.test///", "test-publishable-key")
	if verifier.BaseURL != "https://auth.example.test" || verifier.Client.Timeout != 5*time.Second {
		t.Fatalf("unexpected configuration: %+v", verifier)
	}
	body := &trackedBody{Reader: strings.NewReader(`{"id":"user-123"}`)}
	ctx := context.WithValue(context.Background(), contextKey{}, User{ID: "context-marker"})
	verifier.Client.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method != "GET" || r.URL.String() != "https://auth.example.test/auth/v1/user" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL)
		}
		if r.Header.Get("apikey") != "test-publishable-key" || r.Header.Get("Authorization") != "Bearer token" {
			t.Fatal("missing auth headers")
		}
		if user, ok := UserFromContext(r.Context()); !ok || user.ID != "context-marker" {
			t.Fatal("request context values were lost")
		}
		return &http.Response{StatusCode: 200, Body: body, Header: make(http.Header)}, nil
	})
	user, err := verifier.VerifyToken(ctx, "  token  ")
	if err != nil || user.ID != "user-123" {
		t.Fatalf("user=%+v err=%v", user, err)
	}
	if !body.closed {
		t.Fatal("response body was not closed")
	}
}

func TestSupabaseVerifierRejectsInvalidResponses(t *testing.T) {
	for _, tc := range []struct {
		name          string
		status        int
		body, message string
	}{
		{"unauthorized", 401, `{"message":"secret diagnostic"}`, "Supabase rejected token"},
		{"upstream failure", 503, `unavailable`, "Supabase rejected token"},
		{"malformed JSON", 200, `{`, "decode Supabase user"},
		{"missing user ID", 200, `{}`, "did not contain a user ID"},
		{"empty user ID", 200, `{"id":""}`, "did not contain a user ID"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := &trackedBody{Reader: strings.NewReader(tc.body)}
			v := NewSupabaseVerifier("https://auth.example.test", "key")
			v.Client.Transport = transportFunc(func(*http.Request) (*http.Response, error) {
				return &http.Response{StatusCode: tc.status, Body: body}, nil
			})
			user, err := v.VerifyToken(context.Background(), "token")
			if err == nil || !strings.Contains(err.Error(), tc.message) || user.ID != "" {
				t.Fatalf("user=%+v err=%v", user, err)
			}
			if strings.Contains(err.Error(), "secret diagnostic") {
				t.Fatal("upstream diagnostics leaked")
			}
			if !body.closed {
				t.Fatal("response body was not closed")
			}
		})
	}
}

func TestSupabaseVerifierTransportAndInputErrors(t *testing.T) {
	v := NewSupabaseVerifier("https://auth.example.test", "key")
	calls := 0
	v.Client.Transport = transportFunc(func(r *http.Request) (*http.Response, error) { calls++; return nil, context.Canceled })
	if _, err := v.VerifyToken(context.Background(), " \t "); err == nil || calls != 0 {
		t.Fatal("empty token must fail before HTTP")
	}
	if _, err := v.VerifyToken(context.Background(), "token"); !errors.Is(err, context.Canceled) {
		t.Fatalf("transport error was not preserved: %v", err)
	}
	v.BaseURL = ":invalid"
	if _, err := v.VerifyToken(context.Background(), "token"); err == nil || !strings.Contains(err.Error(), "create auth request") {
		t.Fatalf("invalid URL: %v", err)
	}
}

func TestUserContext(t *testing.T) {
	parent := context.Background()
	if _, ok := UserFromContext(parent); ok {
		t.Fatal("unexpected user in empty context")
	}
	ctx := WithUser(parent, User{ID: "writer"})
	if user, ok := UserFromContext(ctx); !ok || user.ID != "writer" {
		t.Fatalf("user=%+v ok=%v", user, ok)
	}
	if _, ok := UserFromContext(parent); ok {
		t.Fatal("parent context was mutated")
	}
}
