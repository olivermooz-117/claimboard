# ClaimBoard

A real-time collaborative argument map built on DeepSpace. Build shared claim trees, co-edit claim bodies live with Yjs, and use AI to find the strongest counter-arguments.

## What it is

ClaimBoard lets two or more users open a board and:

- See each other's presence ("N others here") scoped to the board
- Build a tree of claims (support / oppose / neutral) with parent-child replies
- Co-edit claim bodies live via Yjs — both users see keystrokes as they happen
- Ask the AI assistant for counter-arguments grounded in real claim IDs
- Attach evidence files to claims
- View as a read-only viewer (sees everything, edits nothing)

## Stack

- **DeepSpace** (0.44.2) — app framework, auth, records, realtime rooms, presence, Yjs, AI chat
- **React** + React Router — frontend
- **Yjs** — live collaborative text editing for claim bodies
- **Cloudflare Workers** — deployment target via `npx deepspace deploy`
- **TypeScript** — type safety throughout

## Tradeoffs (v1)

- **Structural changes use a 4s poll** — creating/replying to claims is immediately reflected for the acting user and picked up by other users within ~4 seconds via polling the gated `GET /api/boards/:id/claims` endpoint. Poll pauses on tab hide, resumes on focus.
- **Yjs bodies are truly live** — claim body edits sync immediately between all connected users via `/ws/yjs/:docId`.
- **Live membership lookup for RBAC** — Yjs body read/write gates resolve board membership live on connect (no denormalized arrays that can drift). A viewer promoted to editor gets write access on their next Yjs connect; a removed member loses access immediately.
- **Read access is membership-gated server-side** — non-members get 404 (not 403) so board existence isn't leaked.
- **No public/private toggle** — all boards are private by default. Toggle deferred to post-v1.
- **Single-writer per board for structural changes** — last-write-wins, optimistic UI. No concurrent structural reparenting in v1.

## Non-goals v1

Public channels, messaging, reactions, PDF ingestion, concurrent structural reparenting, mobile layout, public/private toggle.

## Data Model

- `boards` — id, topic, rules, ownerId
- `claims` — id, boardId, parentId?, stance, title, bodyDocId, authorId
- `evidence` — id, claimId, fileRef, uploadedBy
- `memberships` — boardId, userId, role: owner|editor|viewer
- `documents` — ownerId, claimId (links Yjs body doc to its claim for read-through gating)

## What was verified

- Two-account co-edit: User A creates a claim, User B sees it within ~4s; both edit the same claim body live via Yjs
- Viewer read-only: User B as viewer can read everything but cannot write (Yjs socket rejects at connect, textarea disabled)
- Non-member 404: A user not in the board's memberships gets 404 on board read (no existence leak)
- Change role: Promoting a viewer to editor takes effect on next Yjs connect (live membership lookup)

## Deployment

```sh
npx deepspace deploy
```

Deploys to https://claimboard.app.space

## Development

```sh
npx deepspace dev start
```
