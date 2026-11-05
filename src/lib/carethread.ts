export type Sibling = "Ana" | "Miguel" | "Carla";
export const SIBLINGS: Sibling[] = ["Ana", "Miguel", "Carla"];
export type Status = "On track" | "Aging" | "Stuck" | "Done";

export interface Commitment {
  id: number;
  title: string;
  owner: Sibling | "Nobody";
  category: string;
  createdDaysAgo: number;
  detail: string;
  blocking: string;
  action: string;
  cost: string;
}

export const COMMITMENTS: Commitment[] = [
  { id: 1, title: "Pharmacy refill", owner: "Miguel", category: "Medication", createdDaysAgo: 4, detail: "Rosa's heart medication. Miguel promised Monday; pharmacy hasn't confirmed it's ready.", blocking: "No pharmacy confirmation", action: "Cora calls the pharmacy to confirm the refill is ready.", cost: "One phone call" },
  { id: 2, title: "Cardiology follow-up", owner: "Ana", category: "Appointments", createdDaysAgo: 11, detail: "Ana to book after the last visit. No date exists yet.", blocking: "Nobody called the office", action: "Cora calls the cardiology office and books the first morning slot.", cost: "One phone call" },
  { id: 3, title: "Home-energy assistance (HEAP)", owner: "Carla", category: "Benefits", createdDaysAgo: 5, detail: "Carla started the application. Missing the income letter. Due Friday.", blocking: "Missing document", action: "Cora drafts the request for the income letter.", cost: "No cost" },
  { id: 4, title: "Lab results", owner: "Nobody", category: "Health", createdDaysAgo: 6, detail: "Doctor's office said results would post. Nobody checked.", blocking: "Unchecked portal", action: "Cora checks the portal and summarizes.", cost: "No cost" },
  { id: 5, title: "Ride to Thursday appointment", owner: "Miguel", category: "Transport", createdDaysAgo: 2, detail: "Miguel offered. The appointment time changed and he doesn't know.", blocking: "Stale information", action: "Cora messages Miguel the new time and confirms.", cost: "One text message" },
  { id: 6, title: "Shower chair", owner: "Ana", category: "Home safety", createdDaysAgo: 7, detail: "Ana ordered it. Supplier never confirmed delivery.", blocking: "No delivery date", action: "Cora calls the supplier for a delivery date.", cost: "One phone call" },
  { id: 7, title: "Insurance card to clinic", owner: "Carla", category: "Insurance", createdDaysAgo: 8, detail: "Carla was to send the new card photo. Never sent.", blocking: "Not sent", action: "Cora sends the card photo to the clinic portal.", cost: "$0 — covered" },
  { id: 8, title: "Update for Aunt Lucía", owner: "Nobody", category: "Family", createdDaysAgo: 9, detail: "Three drafts of a health update, none sent.", blocking: "Family can't agree on wording", action: "Cora drafts one calm version for approval.", cost: "No cost" },
  { id: 9, title: "Nurse home visit", owner: "Nobody", category: "Health", createdDaysAgo: 3, detail: "A visit window was offered for next week. Nobody replied.", blocking: "No reply", action: "Cora accepts the Tuesday window and tells the family.", cost: "One reply" },
];

export function baseStatus(days: number): Status {
  if (days >= 8) return "Stuck";
  if (days >= 4) return "Aging";
  return "On track";
}

export const MED_LIST = ["Metoprolol — AM", "Lisinopril — AM", "Vitamin D — AM", "Donepezil — PM"];

// ---- Meta Model API ----
const KEY = "carethread.metaKey";
export const getKey = () => (typeof window === "undefined" ? "" : localStorage.getItem(KEY) || "");
export const setKey = (k: string) => (k ? localStorage.setItem(KEY, k) : localStorage.removeItem(KEY));

export class NoKeyError extends Error {}

type Part = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export async function callMeta(model: "muse-spark-1.3" | "sam-3.1", content: Part[], system?: string): Promise<string> {
  const key = getKey();
  if (!key) throw new NoKeyError("No API key");
  const res = await fetch("https://api.meta.ai/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 2000, ...(system ? { system } : {}), messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`Meta Model API returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const text =
    (Array.isArray(json.content) ? json.content.map((c: { text?: string }) => c.text ?? "").join("") : "") ||
    json.choices?.[0]?.message?.content ||
    json.output_text ||
    "";
  return text || JSON.stringify(json);
}

export function extractJson<T>(text: string): T {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (m ? m[1] : text) ?? "";
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  return JSON.parse(body.slice(start, end + 1)) as T;
}

export function boardSummary(statuses: Record<number, Status>) {
  return COMMITMENTS.map(
    (c) => `#${c.id} ${c.title} | owner: ${c.owner} | ${c.createdDaysAgo} days aging | status: ${statuses[c.id]} | ${c.detail} | blocked by: ${c.blocking} | proposed: ${c.action}`,
  ).join("\n");
}
