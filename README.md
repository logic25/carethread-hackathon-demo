# Carethread Hackathon Demo

Build a web app called "CareThread" — a family care follow-through demo built on the Meta Model API for a hackathon. Fully fictional demo data only. Single-page app, warm and calm design (soft cream background, deep teal and warm amber accents, rounded cards, big readable type — it should feel like a family tool, not a hospital system).

CONCEPT: Adult siblings coordinating care for their mother drop commitments into a group chat and they quietly die there. CareThread is the loop that catches them: it shows every commitment, detects what is aging, states what is blocking each one, proposes the next move, and writes every proposed action to a CONSENT LEDGER — no action runs on a family member's behalf without a recorded approval. A rejected action visibly does not run.

FICTIONAL FAMILY (seed data, hardcode it): Rosa Delgado, 78. Her adult children: Ana, Miguel, Carla. All fictional, label the app "Demo — fictional family" in the header.

THE BOARD: 9 commitment cards, each with: title, owner (which sibling), category, days aging (computed), status (On track / Aging / Stuck / Done), what is blocking it, and the proposed next action.
1. Pharmacy refill — Rosa's heart medication, Miguel promised Monday, pharmacy hasn't confirmed ready. 4 days aging. Blocked: no pharmacy confirmation. Proposed: Cora calls the pharmacy to confirm the refill is ready.
2. Cardiology follow-up — Ana to book after last visit, no date exists. 11 days. Blocked: nobody called the office. Proposed: Cora calls the cardiology office and books the first morning slot.
3. Home-energy assistance (HEAP) application — Carla started it, missing the income letter, due Friday. Blocked: missing document. Proposed: Cora drafts the request for the income letter.
4. Lab results — doctor's office said results would post, nobody checked. 6 days. Blocked: unchecked portal. Proposed: Cora checks the portal and summarizes.
5. Ride to Thursday appointment — Miguel offered, appointment time changed and he doesn't know. Blocked: stale information. Proposed: Cora messages Miguel the new time and confirms.
6. Shower chair — Ana ordered it, supplier never confirmed delivery. Blocked: no delivery date. Proposed: Cora calls the supplier for a delivery date.
7. Insurance card to clinic — Carla was to send the new card photo, never sent. Blocked: not sent. Proposed: Cora sends the card photo to the clinic portal.
8. Update for their aunt — three drafts of a health update, none sent. 9 days. Blocked: family can't agree on wording. Proposed: Cora drafts one calm version for approval.
9. Nurse home visit — a visit window was offered for next week, nobody replied. Blocked: no reply. Proposed: Cora accepts the Tuesday window and tells the family.

THE CONSENT LEDGER (a main view, tab or prominent panel): a table of every proposed action with columns: Action, Evidence (why: which commitment, how long aging), Cost (e.g. "one phone call", "no cost", "$0 — covered"), Proposed by (Cora), and an Approve / Reject control per sibling. Approving marks the action Approved and moves its commitment toward Done with a "completed" animation/state. Rejecting marks it Rejected and shows clearly "This action will not run." Keep a count header: X approved, Y rejected, Z waiting.

META MODEL API INTEGRATION (the core of the hackathon entry): Add a Settings dialog (gear icon, header) "Connect Meta Model API" with one password field for the API key, stored in localStorage, never displayed after entry. All AI features call https://api.meta.ai/v1/messages with header Authorization: Bearer <key>, using model "muse-spark-1.3" for text/vision reasoning and "sam-3.1" for image segmentation. Build three working features:
A. "Run the loop" button: sends the 9 commitments to Muse Spark and returns, per commitment: what changed since last check, what is blocking it, and the single next question to ask the family. Render the response as structured cards. If the API call fails or no key is set, show a clean empty/error state explaining a key is needed (Settings) — do not fake a response.
B. "One sentence, whole outcome" panel: a button that sends the whole board to Muse Spark and displays the single sentence it returns as the family's plan for the week, large and prominent (e.g. a hero card at the top of the board after running).
C. "Pill organizer check" panel: an upload area for a photo of a weekly pill organizer plus the med list (Rosa's fictional list: Metoprolol AM, Lisinopril AM, Vitamin D AM, Donepezil PM). On run: send the image to sam-3.1 with a text prompt to segment the compartments, then send the result to muse-spark-1.3 to read which compartments still hold pills and match against the med list, and render a simple verdict grid: compartment by compartment, taken / still full / mismatch. Include a built-in sample pill-organizer photo (draw it as an SVG/illustration or a CSS grid mock labeled as a sample image) so the demo works without a camera. If no API key, show the same honest key-needed state.

Keep the whole thing client-side (no database). Speed matters: build it in one pass, polished but not gold-plated. Header: "CareThread" wordmark, the fictional-family label, Settings gear, and a small line: "Built on the Meta Model API — Muse Spark + SAM 3.1."

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://carethread-hackathon-demo.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a4c0c3fd-d13c-4888-bf3e-380034aa402b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
