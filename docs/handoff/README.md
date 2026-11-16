# Implementation handoff — Thailand Home Adaptation Planner

## Next work: R1 — Benchmarks and bathroom

**R1 is mostly built (2026-11-16). Start from [R1 remaining work](r1-remaining-work.md)**, which lists the verified state, the four failing browser tests and every task still open. The reading list below is its background.

Read in this order:
1. Repository `AGENTS.md` and the installed Next.js guides relevant to your first task.
2. [v2 specification](../superpowers/specs/2026-10-21-baan-yoo-dee-v2-design.md) (authoritative for new work).
3. [R1 implementation plan](../superpowers/plans/2026-10-21-r1-benchmarks-bathroom.md). Start at Task 1; Task 0 is data work for the product owner.
4. [Progress](progress.md), then the actual working-tree status.

The v1 documents below remain the record of the shipped baseline.

## v1 baseline (complete)

Read in this order:
1. Repository `AGENTS.md` and the installed Next.js guides relevant to your first task.
2. [Product and technical specification](../superpowers/specs/2026-09-28-thailand-home-adaptation-design.md).
3. [Implementation plan](../superpowers/plans/2026-09-28-thailand-home-adaptation.md).
4. [Progress](progress.md), then the actual working-tree status.

## Current state

The Thailand Home Adaptation Planner implementation is complete through M4. Read [progress](progress.md) for completed tasks, verification outcomes and limitations, and [verification](verification.md) for the A01–A12 evidence matrix. The original implementation brief below is retained as the product scope reference.

## Assignment to paste into the implementation chat

```text
Implement the Thailand Home Adaptation Planner in this repository.

Read AGENTS.md, docs/handoff/README.md, the linked product specification,
the full implementation plan, and docs/handoff/progress.md before editing.
Use the local installed Next.js documentation as instructed by AGENTS.md.

The product serves family members and professional home-modification advisors
in Thailand. Preserve the specification's scope: one living room, Thai-first
UI, accurate shared 2D/3D geometry, current/proposed layouts, explainable
checks, advisor review, THB estimates, local persistence and exports.

Start with Task 1 and work sequentially through the plan. Prioritize a working
M1 before adding 3D and advisor features. Complete each task's behavioral
checks before moving on. Keep the public data contracts consistent.

Preserve all existing unrelated changes. Use actual Base UI component APIs
and the installed Next.js conventions. Implement real actions rather than
placeholder controls. Use only the specified project targets and geometry
checks; unverified Thai legal thresholds must not become pass/fail rules.

You are authorized to implement and locally verify this plan. Do not deploy,
purchase services, or initiate separate agent chats. If a concrete task is
blocked, continue independent work and explain the blocker precisely.

Update docs/handoff/progress.md at each milestone and before ending a session.
Report changed files, completed task IDs, commands with actual outcomes,
known limitations and the exact next task. Mark completion only against the
specification's acceptance criteria. This progress file is the handoff for
the primary agent's review; automatic cross-chat messaging is not required.
```

## Milestone review checkpoints

| Checkpoint | Evidence to show the primary agent |
|---|---|
| M1: tasks 1–5 | Thai 2D editor, independent proposal, undo/redo, reload and file round-trip |
| M2: task 6 | Same furniture positions and dimensions in 2D/3D; graceful WebGL fallback |
| M3: tasks 7–8 | Known blocked/clear fixtures, unknown-target behavior, review invalidation and honest cost subtotal |
| M4: tasks 9–10 | Thai printable report, valid SVG/PNG/JSON, recovery/accessibility checks and A01–A12 evidence |

The primary agent should inspect the diff and reproduction evidence at these checkpoints. A milestone report is not a request to re-approve work already assigned by the pasted implementation prompt.

## Design decisions to preserve

- Current/proposed layouts are independent documents within one project; do not maintain a second model for 3D.
- 2D/numeric forms edit furniture; 3D is inspection/selection.
- Advisor mode is a local interface mode, not authentication or identity verification.
- Geometric conflict checks are implementable immediately. Numeric accessibility targets are advisor-entered and labelled as project-specific; legal rules need separate verified source work.
- Unknown dimensions/costs and missing checks remain visibly unknown; they do not become zero or “safe.”
- One-room scope is deliberate. Bathroom engineering, photo reconstruction and accounts are later work.

## Reference material

- [Reference screenshot](../reference/architecture-studio-reference.png) is a durable copy of the user's supplied image. Use the layout/style as inspiration; build original assets.
- [Original build-process sample](../../build_process_sample.md) is reference content, not permission to add account integrations or unrelated features.
- Source links and verification status live in the specification's source register.

## Resuming after interruption

Read progress.md, inspect current files and git diff, rerun only the checks needed to establish the actual state, then resume the first incomplete task. If progress notes conflict with code, record the discrepancy and use verified behavior as the evidence. Do not restart a completed milestone solely because the context changed.
