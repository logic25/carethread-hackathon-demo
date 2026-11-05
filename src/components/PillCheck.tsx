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

type Verdict = { compartment: string; verdict: "taken" | "still full" | "mismatch"; note?: string };

export function PillCheck() {
  const [src, setSrc] = useState(SAMPLE_URL);
  const [isSample, setIsSample] = useState(true);
  const [state, setState] = useState<"idle" | "loading" | "nokey" | "error" | "done">("idle");
  const [err, setErr] = useState("");
  const [step, setStep] = useState("");
  const [rows, setRows] = useState<Verdict[]>([]);
  const [sam, setSam] = useState<{ pills: number; comps: number } | { error: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async () => {
    setState("loading");
    setSam(null);
    try {
      const data = await toPngBase64(src);
      const image = { type: "image" as const, source: { type: "base64" as const, media_type: "image/png", data } };
      setStep("SAM 3.1 is segmenting the compartments…");
      const imageDataUrl = "data:image/png;base64," + data;
      let samLine = "";
      try {
        const pills = await samSegment({ data: { imageDataUrl, concept: "pill" } });
        if (!pills.ok) throw new Error(pills.error);
        const comps = await samSegment({ data: { imageDataUrl, concept: "pill organizer compartment" } });
        if (!comps.ok) throw new Error(comps.error);
        if (pills.count === -1 || comps.count === -1) {
          const raw = [pills, comps].map((r) => ("rawText" in r ? r.rawText : `${r.count} regions`)).join("\n");
          samLine = `SAM 3.1 segmentation (Responses API) raw output:\n${raw.slice(0, 4000)}`;
          setSam({ pills: pills.count, comps: comps.count });
        } else {
          samLine = `SAM 3.1 segmentation (Responses API): found ${pills.count} pill regions and ${comps.count} organizer compartments.`;
          setSam({ pills: pills.count, comps: comps.count });
        }
      } catch (e) {
        setSam({ error: e instanceof Error ? e.message : String(e) });
        samLine = "SAM 3.1 segmentation was unavailable for this image.";
      }
      setStep("Muse Spark is reading each compartment…");
      const out = await callMeta("muse-spark-1.3", [
        image,
        { type: "text", text: `${samLine}\n\nMedication list (AM pills go in AM compartments, PM in PM): ${MED_LIST.join(", ")}. Today is Thursday evening. For every compartment decide: "taken" (empty and its time has passed), "still full" (holds the right pills), or "mismatch" (wrong count/missing pill, or full when it should have been taken). Reply ONLY JSON: [{"compartment":"Sun AM","verdict":"taken","note":"..."}]` },
      ]);
      const parsed = extractJson<unknown>(out);
      const list: unknown[] = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object"
          ? ((Object.values(parsed as Record<string, unknown>).find(Array.isArray) as unknown[] | undefined) ?? [])
          : [];
      const safe: Verdict[] = list
        .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
        .map((r) => {
          const v = String(r["verdict"] ?? "").toLowerCase();
          return {
            compartment: String(r["compartment"] ?? "?"),
            verdict: (v === "taken" || v === "mismatch" ? v : "still full") as Verdict["verdict"],
            ...(r["note"] != null ? { note: typeof r["note"] === "string" ? r["note"] : JSON.stringify(r["note"]) } : {}),
          };
        });
      if (safe.length === 0) throw new Error("Muse Spark didn't return a readable verdict. Please try again.");
      setRows(safe);
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
            <h3 className="text-lg font-bold">Verdict</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {rows.map((r) => (
                <div key={r["compartment"]} title={r["note"]} className={`rounded-xl p-3 text-sm ${r["verdict"] === "taken" ? "bg-success text-success-foreground" : r["verdict"] === "mismatch" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}`}>
                  <div className="font-bold">{r["compartment"]}</div>
                  <div className="capitalize">{r["verdict"]}</div>
                  {r["note"] && <div className="mt-1 text-xs opacity-80">{r["note"]}</div>}
                </div>
              ))}
            </div>
            {sam && ("error" in sam
              ? <p className="mt-3 text-xs text-destructive">SAM 3.1 error: {sam.error}</p>
              : <p className="mt-3 text-xs text-muted-foreground">SAM 3.1 (Responses API) found {sam.pills < 0 ? "an unparsed number of" : sam.pills} pill regions and {sam.comps < 0 ? "an unparsed number of" : sam.comps} compartments in this image.</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
