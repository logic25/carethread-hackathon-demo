import { useRef, useState } from "react";
import { callMeta, extractJson, MED_LIST } from "@/lib/carethread";
import { samSegment } from "@/lib/meta.functions";
import { ErrorBox } from "@/components/States";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// fictional sample: Sun–Wed taken, Thu AM still full, Thu PM missing Donepezil, Fri/Sat full
const SAMPLE: Record<string, string[]> = {
  "Thu-AM": ["#e8a33d", "#f2f2ee", "#f4d35e"],
  "Thu-PM": [],
  "Fri-AM": ["#e8a33d", "#f2f2ee", "#f4d35e"],
  "Fri-PM": ["#7aa6c2"],
  "Sat-AM": ["#e8a33d", "#f2f2ee", "#f4d35e"],
  "Sat-PM": ["#7aa6c2"],
  "Wed-PM": ["#7aa6c2"],
};

function sampleSvg() {
  const cells: string[] = [];
  DAYS.forEach((d, i) => {
    ["AM", "PM"].forEach((p, r) => {
      const x = 20 + i * 108, y = 50 + r * 130;
      cells.push(`<rect x="${x}" y="${y}" width="98" height="118" rx="16" fill="${r ? "#5b7fa6" : "#e9b44c"}" fill-opacity="0.35" stroke="#3a5a6a" stroke-width="3"/>`);
      cells.push(`<text x="${x + 49}" y="${y + 22}" font-family="sans-serif" font-size="16" font-weight="700" text-anchor="middle" fill="#2b3d45">${d} ${p}</text>`);
      (SAMPLE[`${d}-${p}`] || []).forEach((c, k) => {
        cells.push(`<ellipse cx="${x + 28 + (k % 2) * 40}" cy="${y + 58 + Math.floor(k / 2) * 34}" rx="16" ry="11" fill="${c}" stroke="#555" stroke-width="1.5"/>`);
      });
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="340" viewBox="0 0 800 340"><rect width="800" height="340" rx="24" fill="#fbf6ea"/><text x="20" y="32" font-family="sans-serif" font-size="18" fill="#6b7b80">SAMPLE IMAGE — fictional weekly organizer</text>${cells.join("")}</svg>`;
}
const SAMPLE_URL = `data:image/svg+xml;utf8,${encodeURIComponent(sampleSvg())}`;

async function toPngBase64(src: string): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || 800;
  c.height = img.naturalHeight || 340;
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/png").split(",")[1] ?? "";
}

const COMPARTMENTS = DAYS.flatMap((d) => [`${d} AM`, `${d} PM`]);
const norm = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "");

type Verdict = { compartment: string; verdict: "taken" | "still full" | "mismatch"; note?: string };

// Returns 14 rows in compartment order, or null if the answer doesn't cover all compartments.
function toRows(text: string): Verdict[] | null {
  let parsed: unknown;
  try { parsed = extractJson<unknown>(text); } catch { return null; }
  if (!Array.isArray(parsed)) return null;
  const byName = new Map<string, Verdict>();
  for (const r of parsed) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o["compartment"] !== "string") continue;
    const name = COMPARTMENTS.find((c) => norm(c) === norm(o["compartment"] as string));
    if (!name) continue;
    const v = String(o["verdict"] ?? "").toLowerCase().trim();
    const verdict = v === "taken" || v === "mismatch" || v === "still full" ? v : v.includes("full") ? "still full" : null;
    if (!verdict) continue;
    const note = o["note"];
    byName.set(name, { compartment: name, verdict, ...(note != null && note !== "" ? { note: typeof note === "string" ? note : JSON.stringify(note) } : {}) });
  }
  if (byName.size !== COMPARTMENTS.length) return null;
  return COMPARTMENTS.map((c) => byName.get(c)!);
}

// callMeta falls back to the whole JSON body when Spark returns no text blocks
// (e.g. only encoded thinking blocks). Keep only real text parts.
function sparkText(out: string): string {
  try {
    const j = JSON.parse(out) as { content?: { type?: string; text?: unknown }[] };
    if (j && typeof j === "object" && Array.isArray(j.content)) {
      return j.content.filter((c) => c && c.type === "text" && typeof c.text === "string").map((c) => c.text as string).join("");
    }
  } catch { /* plain text */ }
  return out;
}

const UNREADABLE = "Muse Spark did not return a readable verdict for this image.";
function readable(text: string): string {
  const t = text.trim();
  if (!t || /[A-Za-z0-9+/_=-]{80,}/.test(t)) return UNREADABLE;
  return t;
}

export function PillCheck() {
  const [src, setSrc] = useState(SAMPLE_URL);
  const [isSample, setIsSample] = useState(true);
  const [state, setState] = useState<"idle" | "loading" | "nokey" | "error" | "done">("idle");
  const [err, setErr] = useState("");
  const [step, setStep] = useState("");
  const [rows, setRows] = useState<Verdict[]>([]);
  const [sam, setSam] = useState<{ pills: number } | { error: string } | null>(null);
  const [raw, setRaw] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async () => {
    setState("loading");
    setSam(null);
    try {
      const data = await toPngBase64(src);
      const image = { type: "image" as const, source: { type: "base64" as const, media_type: "image/png", data } };
      setStep("SAM 3.1 is finding the pills…");
      const imageDataUrl = "data:image/png;base64," + data;
      let samLine = "";
      try {
        const pills = await samSegment({ data: { imageDataUrl, concept: "pill" } });
        if (!pills.ok) throw new Error(pills.error);
        if (pills.count === -1) {
          samLine = "SAM 3.1 segmentation (Responses API) ran, but its pill count could not be parsed.";
        } else {
          samLine = `SAM 3.1 segmentation (Responses API): found ${pills.count} pill regions.`;
        }
        setSam({ pills: pills.count });
      } catch (e) {
        setSam({ error: e instanceof Error ? e.message : String(e) });
        samLine = "SAM 3.1 segmentation was unavailable for this image.";
      }
      setStep("Muse Spark is reading each compartment…");
      const prompt = `${samLine}\n\nMedication list (AM pills go in AM compartments, PM in PM): ${MED_LIST.join(", ")}. Today is Thursday evening. The organizer has exactly these 14 compartments, in this order: ${COMPARTMENTS.join(", ")}. For every compartment decide: "taken" (empty and its time has passed), "still full" (holds the right pills), or "mismatch" (wrong count/missing pill, or full when it should have been taken). Reply with ONLY a JSON array containing exactly 14 objects, one per compartment, in that order, each shaped {"compartment": "Thu AM", "verdict": "taken" | "still full" | "mismatch", "note": "short note"}. No prose, no wrapping object.`;
      let out = sparkText(await callMeta("muse-spark-1.3", [image, { type: "text", text: prompt }], undefined, 4000));
      let parsedRows = toRows(out);
      if (!parsedRows) {
        setStep("Muse Spark is tidying its answer…");
        out = sparkText(await callMeta("muse-spark-1.3", [
          image,
          { type: "text", text: `${prompt}\n\nYour previous answer was not in the required format:\n${out.slice(0, 6000)}\n\nReturn ONLY the JSON array of 14 objects, one per compartment (${COMPARTMENTS.join(", ")}), in that order.` },
        ], undefined, 4000));
        parsedRows = toRows(out);
      }
      if (parsedRows) { setRows(parsedRows); setRaw(""); }
      else { setRows([]); setRaw(readable(out)); }
      setState("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-3xl bg-card p-6 shadow-soft">
        <h2 className="text-2xl font-bold">Pill organizer check</h2>
        <p className="mt-1 text-muted-foreground">Upload a photo of Rosa's weekly organizer, or use the built-in sample.</p>
        <img src={src} alt="Pill organizer" className="mt-4 w-full rounded-2xl border border-border bg-muted object-contain" />
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => fileRef.current?.click()} className="rounded-full border border-input px-5 py-2.5 font-semibold hover:bg-muted">Upload photo</button>
          {!isSample && <button onClick={() => { setSrc(SAMPLE_URL); setIsSample(true); }} className="rounded-full border border-input px-5 py-2.5 font-semibold hover:bg-muted">Use sample</button>}
          <button onClick={run} disabled={state === "loading"} className="rounded-full bg-primary px-6 py-2.5 font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60">
            {state === "loading" ? "Checking…" : "Check the organizer"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const r = new FileReader(); r.onload = () => { setSrc(r.result as string); setIsSample(false); }; r.readAsDataURL(f);
          }} />
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-3xl bg-secondary p-6">
          <h3 className="text-lg font-bold text-secondary-foreground">Rosa's med list</h3>
          <ul className="mt-2 space-y-1">{MED_LIST.map((m) => <li key={m}>• {m}</li>)}</ul>
        </div>
        {state === "loading" && <div className="rounded-3xl bg-card p-6 shadow-soft text-muted-foreground animate-pulse">{step}</div>}
        {state === "error" && <ErrorBox message={err} />}
        {state === "done" && (
          <div className="rounded-3xl bg-card p-6 shadow-soft">
            <h3 className="text-lg font-bold">{raw ? "Muse Spark's read" : "Verdict"}</h3>
            {raw && <p className="mt-3 whitespace-pre-wrap text-sm">{raw}</p>}
            {!raw && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {rows.map((r) => (
                <div key={r["compartment"]} title={r["note"]} className={`rounded-xl p-3 text-sm ${r["verdict"] === "taken" ? "bg-success text-success-foreground" : r["verdict"] === "mismatch" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}`}>
                  <div className="font-bold">{r["compartment"]}</div>
                  <div className="capitalize">{r["verdict"]}</div>
                  {r["note"] && <div className="mt-1 text-xs opacity-80">{r["note"]}</div>}
                </div>
              ))}
            </div>}
            {sam && ("error" in sam
              ? <p className="mt-3 text-xs text-destructive">SAM 3.1 error: {sam.error}</p>
              : <p className="mt-3 text-xs text-muted-foreground">SAM 3.1 (Responses API) found {sam.pills < 0 ? "an unparsed number of" : sam.pills} pill regions in this image.</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
