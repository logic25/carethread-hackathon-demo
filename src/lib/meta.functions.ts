import { createServerFn } from "@tanstack/react-start";

type MetaInput = { model: string; system?: string; messages: unknown[] };

// Server-side proxy to the Meta Model API. The key lives only in the server secret META_API_KEY.
export const metaProxy = createServerFn({ method: "POST" })
  .inputValidator((d: MetaInput) => {
    if (!d || typeof d.model !== "string" || !Array.isArray(d.messages)) throw new Error("Invalid request");
    return d;
  })
  .handler(async ({ data }) => {
    const key = process.env.META_API_KEY;
    if (!key) return { ok: false as const, error: "META_API_KEY is not set on the server." };
    const res = await fetch("https://api.meta.ai/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: data.model, max_tokens: 2000, ...(data.system ? { system: data.system } : {}), messages: data.messages }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false as const, error: `Meta Model API returned ${res.status}: ${text.slice(0, 200)}` };
    return { ok: true as const, json: text };
  });
