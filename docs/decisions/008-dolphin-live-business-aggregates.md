# ADR 008: Dolphin business aggregates cross the boundary without raw guest data

Status: accepted (transport scaffold), metric production remains disabled

## Context

The owner dashboard needs daily visitor and fiscal revenue facts from Dolphin. CAMP rows contain account, card, and other operational identifiers that the central dashboard does not need. The existing connector already has a device-bound credential; its location and dashboard scope are assigned by the server when the one-time installer is enrolled.

The currently confirmed CAMP methods (`guesttypes`, `services`, `accounts`, `accountsales`) are not enough to calculate unique visitors and fiscal revenue safely. Enabling approximate facts would turn missing data into misleading business numbers.

## Decision

- Raw CAMP rows stay on the registered Workstation.
- The Workstation will upload at most 62 consecutive daily aggregates to `POST /api/integrations/dolphin/business-summary`.
- The feedback service reads `scopeId` from the authenticated connector record created by server-bound enrollment. A client-controlled device id cannot choose or override its complex.
- Each metric has an explicit `complete`, `blocked`, or `incomplete` status. A blocked/incomplete value must be `null`, never a synthetic zero.
- `generationId + sequence + payload SHA-256` provide idempotency. Reusing an identity with different content or sending a stale sequence is rejected.
- The server stores one latest aggregate per scope atomically in `dolphin-business-summaries.json`.
- Team reads sanitized aggregates through a token-protected loopback endpoint. If live data is unavailable or invalid, the existing static snapshot remains the fallback.
- Business metric collection is feature-disabled until the vendor exposes and documents the required methods for payments, entry logs, cards, areas, and controllers.

## Privacy and security boundary

The accepted transport contract contains only dates, counts, sums, safe completion states, safe blocker codes, and schema hashes. Unknown keys are rejected. Names, phone numbers, account ids, card ids, card serials, and raw rows are outside the contract and are never persisted centrally.

The public vendor origin still uses the narrow HTTP exception documented in ADR 007. Raw access therefore remains confined to the Moscow Workstation; the central upload uses HTTPS and the existing device token.

## Rollout gate

Before dashboard activation, seven completed overlap days must match the Dolphin control report exactly for both visitors and fiscal revenue, with no unresolved visitor blockers and stable schemas. A mismatch keeps the live feature disabled.
