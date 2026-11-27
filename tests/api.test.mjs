import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { api, request, configureApi } from "../src/api.js";
import { setAccount } from "../src/authStore.js";

function storage() {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, String(v)),
    removeItem: (k) => values.delete(k),
  };
}

beforeEach(() => {
  configureApi(null);
  setAccount(null);
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
});

test("card catalog preserves virtual and physical tiers and stage routing", async () => {
  const virtual = await request("card.catalog", { type: "virtual" }, { delay: 0 });
  const physical = await request("card.catalog", { type: "physical" }, { delay: 0 });
  assert.equal(virtual.length, 4);
  assert.equal(physical.length, 2);
  assert.ok(physical.some((p) => p.name === "VeraCard Physical Standard"));
  assert.equal((await request("card.form", { product: "PHCard" }, { delay: 0 })).kind, "identity");
  assert.equal((await request("card.form", { product: "VeraCard Physical Standard" }, { delay: 0 })).kind, "personalize");
  const fees = await request("card.fees", { product: "VeraCard Physical Standard" }, { delay: 0 });
  assert.equal(fees.step, 4);
  assert.equal(fees.limits.daily, "$250,000");
  await assert.rejects(request("card.form", { product: "unknown-sku" }, { delay: 0 }));
});

test("identity adapter does not persist submitted personal data or create a card", async () => {
  const result = await request("card.identity.submit", { fields: { first: "Discard" } }, { delay: 0 });
  assert.equal(result.status, "pending");
  assert.deepEqual((await request("page.get", {}, { delay: 0 })).cards, []);
  assert.deepEqual(await request("preferences.get", {}, { delay: 0 }), {});
  await assert.rejects(request("card.coupon", { code: "INVALID" }, { delay: 0 }), /invalid or expired/i);
});

test("aborting a pending mutation prevents local data writes", async () => {
  const controller = new AbortController();
  const pending = request("preferences.save", { data: { firstName: "Never" } }, { signal: controller.signal, delay: 30 });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.deepEqual(await request("preferences.get", {}, { delay: 0 }), {});
});

test("local page data and preferences remain scoped to the signed-in account", async () => {
  setAccount({ id: "one", email: "one@example.test" });
  await request("preferences.save", { data: { firstName: "One" } }, { delay: 0 });
  setAccount({ id: "two", email: "two@example.test" });
  assert.deepEqual(await request("preferences.get", {}, { delay: 0 }), {});
  assert.equal((await request("page.get", { page: "wallet" }, { delay: 0 })).email, "two@example.test");
});

test("backend adapter receives filters and cancellation signal and propagates errors", async () => {
  const controller = new AbortController();
  configureApi(async (resource, params, options) => {
    assert.equal(resource, "page.get");
    assert.equal(params.period, "7 days");
    assert.equal(options.signal, controller.signal);
    throw new Error("Service unavailable");
  });
  await assert.rejects(api.page("activities", { period: "7 days" }, { signal: controller.signal }), /Service unavailable/);
});
