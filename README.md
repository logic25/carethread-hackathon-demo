# CareThread — family care follow-through

CareThread is a family care follow-through loop: nothing a family agrees to do for a parent or an aging loved one quietly dies in a group chat.

**Live demo:** https://carethread-hackathon-demo.lovable.app
**Demo video:** https://youtu.be/XwvWmsla0F0

Built for the Meta Global AI Developer Hackathon (Cerebral Valley), Indie Developer Track, "Build for Your World." Every person and every piece of data in this demo is fictional.

## The problem

63 million Americans care for an adult family member or aging loved one (AARP and the National Alliance for Caregiving, Caregiving in the US 2025). That care is coordinated in group chats, where commitments quietly die: a pharmacy pickup nobody confirmed, a cardiology follow-up nobody booked, a benefits form nobody filed.

## What it does

- **One thread per loved one.** Every loved one gets their own thread. This demo follows Rosa Delgado, 78, and her children Ana, Miguel, and Carla.
- **The board.** Every commitment in the thread, with its owner, how many days it has been aging, what is blocking it, and the proposed next move.
- **The consent ledger.** Every proposed action is written to a ledger with its evidence and its cost. A sibling approves or rejects it. An approved action runs; a rejected action visibly does not run. Nothing happens on a family member's behalf without a recorded yes.
- **One sentence, whole outcome.** Muse Spark reads the whole board and writes the family's week as a single sentence.
- **Pill organizer check.** A photo of the weekly organizer is segmented by SAM 3.1, then read by Muse Spark against the medication list, compartment by compartment.

## How it uses Meta models

| Job | Model | Endpoint |
| --- | --- | --- |
| Commitment analysis ("Run the loop") and the one-sentence plan | Muse Spark (muse-spark-1.3) | POST /v1/messages |
| Pill organizer segmentation | SAM 3.1 (sam-3.1) | POST /v1/responses |

## Architecture and safety

- The Meta Model API key exists only as a server-side secret (META_API_KEY). Every model call runs through a server function; the key is never shipped to or stored in the browser.
- No database and no real data: the demo family, the medications, and the sample organizer image are invented for this hackathon.
- A rejected action does not run. That rule is the product.

## Where this goes next

In the production CareThread, Cora, the care agent, carries out approved actions herself, including placing the call to the pharmacy or the doctor's office. This demo is the record layer that makes those calls safe: the thread, the ledger, and the recorded yes.

## Run it locally

```
npm i
npm run dev
```

The AI features need the META_API_KEY secret configured in the project backend; without it, the app shows an honest key-needed state instead of a fake result.

## Stack

React with TanStack Start, built with Lovable, server functions backed by the project's Supabase backend, Meta Model API.
