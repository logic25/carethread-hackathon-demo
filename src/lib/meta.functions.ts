import { createServerFn } from "@tanstack/react-start";

type MetaInput = { model: string; system?: string | undefined; messages: unknown[]; maxTokens?: number | undefined };

// Server-side proxy to the Meta Model API. The key lives only in the server secret META_API_KEY.
export const metaProxy = createServerFn({ method: "POST" })
  .inputValidator((d: MetaInput) => {
    if (!d || typeof d.model !== "string" || !Array.isArray(d.messages)) throw new Error("Invalid request");
    return d;
  })
  .handler(async ({ data }) => {
    const key = process.env["META_API_KEY"];
    if (!key) return { ok: false as const, error: "META_API_KEY is not set on the server." };
    const res = await fetch("https://api.meta.ai/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: data.model, max_tokens: typeof data.maxTokens === "number" && data.maxTokens > 0 ? data.maxTokens : 2000, ...(data.system ? { system: data.system } : {}), messages: data.messages }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false as const, error: `Meta Model API returned ${res.status}: ${text.slice(0, 200)}` };
    return { ok: true as const, json: text };
  });

type SamInput = { imageDataUrl: string; concept: string };
type SamBox = { objectId: string; x1: number; y1: number; x2: number; y2: number; confidence?: number };
type SamResult =
  | { ok: false; error: string }
  | { ok: true; count: number; boxes: SamBox[] }
  | { ok: true; count: -1; rawText: string };

// SAM 3.1 is served only on the Responses endpoint.
export const samSegment = createServerFn({ method: "POST" })
  .inputValidator((d: SamInput) => {
    if (!d || typeof d.imageDataUrl !== "string" || typeof d.concept !== "string") throw new Error("Invalid request");
    return d;
  })
  .handler(async ({ data }): Promise<SamResult> => {
    try {
      const r = await samSegmentInner(data);
      return JSON.parse(JSON.stringify(r)) as SamResult;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

async function samSegmentInner(data: SamInput): Promise<SamResult> {
  {
    const key = process.env["META_API_KEY"];
    if (!key) return { ok: false, error: "META_API_KEY is not set on the server." };
    const res = await fetch("https://api.meta.ai/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "sam-3.1",
        input: [{ role: "user", content: [{ type: "input_text", text: data.concept }, { type: "input_image", image_url: data.imageDataUrl }] }],
      }),
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, error: `Meta Model API returned ${res.status}: ${body.slice(0, 200)}` };
    let rawText = "";
    try {
      const json = JSON.parse(body) as { output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
      rawText = (json.output ?? [])
        .filter((o) => o.type === "message")
        .flatMap((o) => (o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? ""))
        .join("");
    } catch {
      return { ok: true, count: -1, rawText: body.slice(0, 4000) };
    }
    try {
      const { parseImageStream, recordsOfKind } = await import("@meta-sam/parser");
      const text = rawText;
      async function* events() {
        yield { type: "response.output_text.delta", item_id: "m", output_index: 0, content_index: 0, delta: text };
        yield { type: "response.output_text.done", item_id: "m", output_index: 0, content_index: 0, text };
        yield { type: "response.completed" };
      }
      const parsed = parseImageStream(events() as never);
      for await (const _ of parsed) { /* drain */ }
      const result = await parsed.finalResult;
      const boxRecords = recordsOfKind(result.records, "box");
      if (boxRecords.length === 0 && rawText.includes("<|box")) return { ok: true, count: -1, rawText: rawText.slice(0, 4000) };
      const size = rawText.match(/;w=(\d+);h=(\d+)/);
      const w = size ? Number(size[1]) : 1000, h = size ? Number(size[2]) : 1000;
      const n = (v: number, d: number) => Math.round((v / (d || 1)) * 1000);
      const boxes: SamBox[] = boxRecords.map((b) => ({
        objectId: String(b.objectId), x1: n(b.left, w), y1: n(b.top, h), x2: n(b.right, w), y2: n(b.bottom, h),
        ...(b.confidence !== undefined ? { confidence: Number(b.confidence) } : {}),
      }));
      return { ok: true, count: boxes.length, boxes };
    } catch {
      return { ok: true, count: -1, rawText: rawText.slice(0, 4000) };
    }
  }
}
