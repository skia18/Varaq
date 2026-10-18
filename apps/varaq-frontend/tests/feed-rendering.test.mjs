import { test, vi } from "vitest";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { FeedGrid } from "@/features/feed/FeedGrid";
import { SavedPagesProvider } from "@/features/saved/SavedPagesContext";
import { SearchResults } from "@/components/navigation/SearchResults";
import { DiscoverPage } from "@/pages/discover/DiscoverPage";

// Rendering tests must not initialize a real Supabase client or call the API.
vi.mock("@/lib/api", () => ({ getFeed: vi.fn() }));

const writings = Array.from({ length: 10 }, (_, i) => ({
  id: String(i + 1),
  title: `Publication ${String(i + 1).padStart(2, "0")}`,
  author: "A writer",
  handle: "a_writer",
  form: "Poems",
  body: "A published page.",
  excerpt: "A published page.",
  minutes: 1,
  tone: "paper",
  date: "2026-10-18",
}));

test("all ten commons cards remain in publication order without hidden column containers", () => {
  const html = renderToString(
    React.createElement(
      SavedPagesProvider,
      null,
      React.createElement(FeedGrid, { writings, onRead() {} }),
    ),
  );
  assert.equal((html.match(/<article /g) ?? []).length, 10);
  assert.ok(html.includes('class="saved-writing-grid"'));
  assert.ok(!html.includes("writing-column")); // old mobile CSS hides the third column
  let last = -1;
  for (const writing of writings) {
    const position = html.indexOf(`<h2>${writing.title}</h2>`);
    assert.ok(position > last, `${writing.title} is missing or out of order`);
    last = position;
  }
});

function renderSearch(overrides = {}) {
  return renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(SearchResults, {
        matches: writings,
        hasMore: true,
        query: "rain & light/ورق",
        loading: false,
        error: null,
        onRead() {},
        onClose() {},
        ...overrides,
      }),
    ),
  );
}

test("truncated search exposes a query-preserving link and an incomplete count", () => {
  const html = renderSearch();
  assert.ok(html.includes("View all results"));
  assert.ok(html.includes("10<!-- -->+"));
  const href = html.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&");
  const target = new URL(href, "http://localhost");
  assert.equal(target.pathname, "/discover");
  assert.equal(target.searchParams.get("q"), "rain & light/ورق");
});

test("complete, loading and failed searches do not offer a stale more-results link", () => {
  for (const props of [{ hasMore: false }, { loading: true }, { error: "Offline" }]) {
    assert.ok(!renderSearch(props).includes("View all results"));
  }
});

test("discovery initializes its search field from the linked URL", () => {
  const html = renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/discover?q=rain+%26+light"] },
      React.createElement(DiscoverPage),
    ),
  );
  assert.ok(html.includes('value="rain &amp; light"'));
});
