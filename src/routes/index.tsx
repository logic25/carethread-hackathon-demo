import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Settings, Check, X, Sparkles, RefreshCw } from "lucide-react";
import {
  COMMITMENTS, SIBLINGS, baseStatus, boardSummary, callMeta, extractJson, getKey, setKey, NoKeyError,
  type Sibling, type Status,
} from "@/lib/carethread";
import { PillCheck } from "@/components/PillCheck";
import { KeyNeeded, ErrorBox } from "@/components/States";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareThread — family care follow-through" },
      { name: "description", content: "CareThread catches family care commitments before they die in the group chat, with a consent ledger for every action." },
      { property: "og:title", content: "CareThread — family care follow-through" },
      { property: "og:description", content: "Every commitment, what's blocking it, and a consent ledger. Built on the Meta Model API." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Vote = "approve" | "reject";
type Votes = Record<number, Partial<Record<Sibling, Vote>>>;
type Decision = "Approved" | "Rejected" | "Waiting";
const decide = (v: Partial<Record<Sibling, Vote>> = {}): Decision =>
  Object.values(v).includes("reject") ? "Rejected" : Object.values(v).includes("approve") ? "Approved" : "Waiting";

const STATUS_STYLE: Record<Status, string> = {
  "On track": "bg-secondary text-secondary-foreground",
  Aging: "bg-warning text-warning-foreground",
  Stuck: "bg-destructive/15 text-destructive",
  Done: "bg-success text-success-foreground",
};

type LoopItem = { id: number; changed: string; blocking: string; question: string };

function Index() {
  const [tab, setTab] = useState<"board" | "ledger" | "pills">("board");
  const [votes, setVotes] = useState<Votes>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  useEffect(() => setHasKey(!!getKey()), [settingsOpen]);

  const statuses = useMemo(() => {
    const s: Record<number, Status> = {};
    COMMITMENTS.forEach((c) => (s[c.id] = decide(votes[c.id]) === "Approved" ? "Done" : baseStatus(c.createdDaysAgo)));
    return s;
  }, [votes]);

  const counts = useMemo(() => {
    const d = COMMITMENTS.map((c) => decide(votes[c.id]));
    return { a: d.filter((x) => x === "Approved").length, r: d.filter((x) => x === "Rejected").length, w: d.filter((x) => x === "Waiting").length };
  }, [votes]);

  // AI state
  const [sentence, setSentence] = useState<{ s: "idle" | "loading" | "nokey" | "error" | "done"; text: string }>({ s: "idle", text: "" });
  const [loop, setLoop] = useState<{ s: "idle" | "loading" | "nokey" | "error" | "done"; items: LoopItem[]; err: string }>({ s: "idle", items: [], err: "" });

  const runSentence = async () => {
    setSentence({ s: "loading", text: "" });
    try {
      const t = await callMeta("muse-spark-1.3", [{ type: "text", text: `You are Cora, a calm family care coordinator. Here is the family's care board for Rosa (78):\n${boardSummary(statuses)}\n\nReturn ONE warm, plain sentence (max 35 words) that is the family's whole plan for this week. Return only the sentence.` }]);
      setSentence({ s: "done", text: t.trim().replace(/^"|"$/g, "") });
    } catch (e) {
      setSentence(e instanceof NoKeyError ? { s: "nokey", text: "" } : { s: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const runLoop = async () => {
    setLoop({ s: "loading", items: [], err: "" });
    try {
      const t = await callMeta("muse-spark-1.3", [{ type: "text", text: `You are Cora, running a follow-through check on a family care board for Rosa (78), coordinated by siblings Ana, Miguel and Carla.\n${boardSummary(statuses)}\n\nFor EACH commitment return what changed since the last check, what is blocking it, and the single next question to ask the family. Reply ONLY JSON: [{"id":1,"changed":"...","blocking":"...","question":"..."}]` }]);
      setLoop({ s: "done", items: extractJson<LoopItem[]>(t), err: "" });
    } catch (e) {
      setLoop(e instanceof NoKeyError ? { s: "nokey", items: [], err: "" } : { s: "error", items: [], err: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-primary">Care<span className="text-accent">Thread</span></h1>
              <span className="rounded-full bg-warning px-3 py-1 text-xs font-bold text-warning-foreground">Demo — fictional family</span>
            </div>
            <p className="text-sm text-muted-foreground">Built on the Meta Model API — Muse Spark + SAM 3.1.</p>
          </div>
          <button aria-label="Settings" onClick={() => setSettingsOpen(true)} className="relative rounded-full p-3 hover:bg-muted">
            <Settings className="h-6 w-6" />
            <span className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full ${hasKey ? "bg-success-foreground" : "bg-accent"}`} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Caring for Rosa Delgado, 78</h2>
          <p className="text-muted-foreground">Ana, Miguel and Carla · nothing runs on anyone's behalf without a recorded approval.</p>
        </div>

        <nav className="mb-8 inline-flex rounded-full bg-muted p-1.5">
          {([["board", "The board"], ["ledger", `Consent ledger · ${counts.w} waiting`], ["pills", "Pill check"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-full px-5 py-2.5 font-bold transition ${tab === k ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </nav>

        {tab === "board" && (
          <div className="space-y-8">
            <section className="rounded-3xl bg-primary p-8 text-primary-foreground shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm font-bold uppercase tracking-wider opacity-80">One sentence, whole outcome</p>
                <button onClick={runSentence} disabled={sentence.s === "loading"} className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-bold text-accent-foreground hover:opacity-90 disabled:opacity-60">
                  <Sparkles className="h-4 w-4" /> {sentence.s === "loading" ? "Thinking…" : "Write this week's plan"}
                </button>
              </div>
              {sentence.s === "done" ? (
                <p className="mt-4 font-display text-3xl leading-snug md:text-4xl">{sentence.text}</p>
              ) : (
                <p className="mt-4 font-display text-2xl opacity-70">Muse Spark reads the whole board and returns the family's plan for the week in a single sentence.</p>
              )}
              {sentence.s === "nokey" && <div className="mt-4 text-foreground"><KeyNeeded /></div>}
              {sentence.s === "error" && <div className="mt-4 text-foreground"><ErrorBox message={sentence.text} /></div>}
            </section>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl font-bold">9 commitments</h2>
              <button onClick={runLoop} disabled={loop.s === "loading"} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${loop.s === "loading" ? "animate-spin" : ""}`} /> {loop.s === "loading" ? "Running the loop…" : "Run the loop"}
              </button>
            </div>
            {loop.s === "nokey" && <KeyNeeded />}
            {loop.s === "error" && <ErrorBox message={loop.err} />}

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {COMMITMENTS.map((c) => {
                const st: Status = statuses[c.id] ?? "On track";
                const dec = decide(votes[c.id]);
                const ai = loop.items.find((i) => Number(i.id) === c.id);
                return (
                  <article key={`${c.id}-${st}`} className={`flex flex-col rounded-3xl bg-card p-6 shadow-soft ${st === "Done" ? "animate-done ring-2 ring-success-foreground/40" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{c.category}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[st]}`}>{st === "Done" ? "✓ Done" : st}</span>
                    </div>
                    <h3 className={`mt-2 text-xl font-bold ${st === "Done" ? "line-through opacity-60" : ""}`}>{c.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{c.owner} · {c.createdDaysAgo} days aging</p>
                    <p className="mt-3 text-[15px]">{c.detail}</p>
                    <div className="mt-4 rounded-2xl bg-muted p-3 text-sm"><span className="font-bold">Blocking:</span> {c.blocking}</div>
                    <div className="mt-2 rounded-2xl bg-secondary p-3 text-sm text-secondary-foreground"><span className="font-bold">Next move:</span> {c.action}</div>
                    {dec === "Rejected" && <p className="mt-2 text-sm font-bold text-destructive">Rejected — this action will not run.</p>}
                    {ai && (
                      <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                        <p className="font-bold text-primary">Muse Spark · loop check</p>
                        <p><span className="font-semibold">Changed:</span> {ai.changed}</p>
                        <p><span className="font-semibold">Blocking:</span> {ai.blocking}</p>
                        <p className="rounded-xl bg-warning p-2 text-warning-foreground"><span className="font-semibold">Ask the family:</span> {ai.question}</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {tab === "ledger" && (
          <section>
            <div className="mb-5 flex flex-wrap gap-3 text-lg font-bold">
              <span className="rounded-full bg-success px-4 py-2 text-success-foreground">{counts.a} approved</span>
              <span className="rounded-full bg-destructive/15 px-4 py-2 text-destructive">{counts.r} rejected</span>
              <span className="rounded-full bg-warning px-4 py-2 text-warning-foreground">{counts.w} waiting</span>
            </div>
            <div className="overflow-x-auto rounded-3xl bg-card shadow-soft">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-muted text-sm uppercase tracking-wider text-muted-foreground">
                  <tr><th className="p-4">Action</th><th className="p-4">Evidence</th><th className="p-4">Cost</th><th className="p-4">Proposed by</th><th className="p-4">Consent</th></tr>
                </thead>
                <tbody>
                  {COMMITMENTS.map((c) => {
                    const dec = decide(votes[c.id]);
                    return (
                      <tr key={c.id} className={`border-t border-border align-top ${dec === "Rejected" ? "bg-destructive/5" : dec === "Approved" ? "bg-success/40" : ""}`}>
                        <td className="p-4">
                          <p className={`font-semibold ${dec === "Rejected" ? "line-through opacity-60" : ""}`}>{c.action}</p>
                          {dec === "Approved" && <p className="mt-1 text-sm font-bold text-success-foreground">✓ Approved — running</p>}
                          {dec === "Rejected" && <p className="mt-1 text-sm font-bold text-destructive">✕ This action will not run.</p>}
                        </td>
                        <td className="p-4 text-sm">{c.title} — {c.blocking.toLowerCase()}, {c.createdDaysAgo} days aging</td>
                        <td className="p-4 text-sm">{c.cost}</td>
                        <td className="p-4 text-sm font-semibold">Cora</td>
                        <td className="p-4">
                          <div className="space-y-1.5">
                            {SIBLINGS.map((s) => {
                              const v = votes[c.id]?.[s];
                              const set = (nv: Vote) => setVotes((p) => ({ ...p, [c.id]: { ...p[c.id], [s]: v === nv ? undefined : nv } }));
                              return (
                                <div key={s} className="flex items-center gap-2">
                                  <span className="w-14 text-sm font-semibold">{s}</span>
                                  <button aria-label={`${s} approves`} onClick={() => set("approve")} className={`rounded-full p-1.5 ${v === "approve" ? "bg-success-foreground text-success" : "bg-muted hover:bg-success"}`}><Check className="h-4 w-4" /></button>
                                  <button aria-label={`${s} rejects`} onClick={() => set("reject")} className={`rounded-full p-1.5 ${v === "reject" ? "bg-destructive text-destructive-foreground" : "bg-muted hover:bg-destructive/20"}`}><X className="h-4 w-4" /></button>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Any one rejection stops an action. One approval with no rejection lets it run.</p>
          </section>
        )}

        {tab === "pills" && <PillCheck />}
      </main>

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [val, setVal] = useState("");
  const saved = !!getKey();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-7 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold">Connect Meta Model API</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your key stays in this browser and is never shown again after saving.</p>
        <p className="mt-4 text-sm font-semibold">{saved ? "✓ A key is saved." : "No key saved yet."}</p>
        <input type="password" autoComplete="off" value={val} onChange={(e) => setVal(e.target.value)} placeholder={saved ? "Paste a new key to replace" : "Paste your API key"} className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring" />
        <div className="mt-5 flex justify-between gap-2">
          {saved ? <button onClick={() => { setKey(""); onClose(); }} className="rounded-full px-4 py-2 font-semibold text-destructive hover:bg-muted">Remove key</button> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-full px-4 py-2 font-semibold hover:bg-muted">Cancel</button>
            <button disabled={!val.trim()} onClick={() => { setKey(val.trim()); onClose(); }} className="rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground disabled:opacity-50">Save key</button>
          </div>
        </div>
      </div>
    </div>
  );
}
