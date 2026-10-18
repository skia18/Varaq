import { test } from "vitest";
import assert from "node:assert/strict";
import { createScrollPager } from "../src/features/feed/scroll-pagination";

function setup(fetchPage) {
  const pages = [],
    errors = [];
  const pager = createScrollPager({
    fetchPage,
    onPage: (page) => pages.push(page),
    onLoading() {},
    onError: () => errors.push(true),
    initialY: 0,
  });
  return { pager, pages, errors };
}
test("loads one initial page, then only on a new downward scroll near the end", async () => {
  const calls = [];
  const { pager } = setup(async (cursor) => {
    calls.push(cursor);
    return { items: Array(10).fill({}), nextCursor: "page2" };
  });
  await pager.start();
  await pager.start();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(calls, [null]);
  await pager.onScroll(0, 100, 800); // no movement, even when sentinel visible
  await pager.onScroll(20, 2000, 800); // far from end
  await pager.onScroll(10, 100, 800); // upward
  assert.deepEqual(calls, [null]);
  await pager.onScroll(30, 900, 800);
  assert.deepEqual(calls, [null, "page2"]);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(calls.length, 2); // completion must not cascade
});
test("rapid scrolls do not overlap requests, and exhausted feeds stop", async () => {
  let resolvePage;
  let count = 0;
  const { pager } = setup(async () => {
    count++;
    if (count === 1) return { items: [], nextCursor: "next" };
    return new Promise((resolve) => {
      resolvePage = resolve;
    });
  });
  await pager.start();
  const pending = pager.onScroll(10, 100, 800);
  await pager.onScroll(20, 100, 800);
  assert.equal(count, 2);
  resolvePage({ items: [], nextCursor: null });
  await pending;
  await pager.onScroll(30, 100, 800);
  assert.equal(count, 2);
});
test("failed later pages keep their cursor and retry only on another scroll", async () => {
  const calls = [];
  const { pager, errors } = setup(async (cursor) => {
    calls.push(cursor);
    if (calls.length === 2) throw Error("offline");
    return { items: [], nextCursor: "next" };
  });
  await pager.start();
  await pager.onScroll(10, 100, 800);
  assert.equal(errors.length, 1);
  assert.deepEqual(calls, [null, "next"]);
  await pager.onScroll(20, 100, 800);
  assert.deepEqual(calls, [null, "next", "next"]);
});
test("disposed pages ignore late responses and further scrolls", async () => {
  let resolvePage;
  const { pager, pages } = setup(
    () =>
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
  );
  const initial = pager.start();
  pager.dispose();
  resolvePage({ items: [{ id: "stale" }], nextCursor: "next" });
  await initial;
  await pager.onScroll(20, 100, 800);
  assert.deepEqual(pages, []);
});

test("a non-overflowing page loads more only after a downward scroll gesture", async () => {
  const calls = [];
  const { pager } = setup(async (cursor) => {
    calls.push(cursor);
    return { items: [], nextCursor: "next" };
  });
  await pager.start();
  await pager.onScroll(0, 500, 1200);
  await pager.onScrollIntent(false, 500, 1200, 800);
  assert.deepEqual(calls, [null]);
  await pager.onScrollIntent(true, 500, 1200, 800);
  assert.deepEqual(calls, [null, "next"]);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(calls.length, 2); // no completion or viewport-fill cascade
});

test("gesture fallback ignores overflowing pages and serializes requests", async () => {
  const calls = [];
  let resolvePage;
  const { pager } = setup(async (cursor) => {
    calls.push(cursor);
    if (calls.length === 1) return { items: [], nextCursor: "next" };
    return new Promise((resolve) => {
      resolvePage = resolve;
    });
  });
  await pager.start();
  await pager.onScrollIntent(true, 900, 800, 1600);
  assert.equal(calls.length, 1); // normal scrolling owns overflow pagination
  const pending = pager.onScrollIntent(true, 500, 1200, 800);
  await pager.onScrollIntent(true, 500, 1200, 800);
  await pager.onScroll(20, 500, 1200);
  assert.equal(calls.length, 2);
  resolvePage({ items: [], nextCursor: null });
  await pending;
  await pager.onScrollIntent(true, 500, 1200, 800);
  assert.equal(calls.length, 2); // exhausted
});

test("gesture fallback retries the same cursor and ignores disposed feeds", async () => {
  const calls = [];
  const { pager } = setup(async (cursor) => {
    calls.push(cursor);
    if (calls.length === 2) throw Error("offline");
    return { items: [], nextCursor: "next" };
  });
  await pager.start();
  await pager.onScrollIntent(true, 500, 1200, 800);
  await pager.onScrollIntent(true, 500, 1200, 800);
  assert.deepEqual(calls, [null, "next", "next"]);
  pager.dispose();
  await pager.onScrollIntent(true, 500, 1200, 800);
  assert.equal(calls.length, 3);
});
