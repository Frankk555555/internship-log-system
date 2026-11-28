# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

Layout: **single-context**.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## Existing project docs

These are not a glossary or ADRs, but they record decisions already made. Read the ones that touch your area.

- `PRODUCT.md`: users, purpose and constraints
- `docs/business-rules.md`: agreed rules; they win over the original scope document
- `docs/api-contract.md`: draft API contract between frontend and backend
- `docs/erd-review.md`: database design; `backend/db/schema.sql` wins if they differ
- `docs/design-pattern.md`: UI rules for screens
- `docs/admin-plan.md`: plan for the admin screens

## File structure

```
/
├── GLOSSARY.md
├── docs/adr/
├── app/          ← Nuxt frontend
└── backend/      ← Elysia API
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
