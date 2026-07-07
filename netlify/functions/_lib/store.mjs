import { getStore } from "@netlify/blobs";

const STORE_NAME = "insurance-quotes";

export function quotesStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export async function getQuoteRecord(slug) {
  const store = quotesStore();
  return store.get(`quotes/${slug}.json`, { type: "json", consistency: "strong" });
}

export async function setQuoteRecord(slug, record) {
  const store = quotesStore();
  await store.setJSON(`quotes/${slug}.json`, record);
}

export async function listQuoteRecords() {
  const store = quotesStore();
  const { blobs } = await store.list({ prefix: "quotes/" });
  const records = await Promise.all(
    blobs.map(async ({ key }) => {
      try {
        return await store.get(key, { type: "json", consistency: "strong" });
      } catch {
        return null;
      }
    }),
  );
  return records.filter(Boolean);
}
