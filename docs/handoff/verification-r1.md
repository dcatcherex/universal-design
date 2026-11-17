# R1 release verification

Date: 2026-11-17

This matrix records automated evidence run in this session. “Pass” means the cited automated coverage passed; it does not close the human or source-verification gates listed below. R1 is not cleared for release.

| ID | Result | Evidence | Limits |
|---|---|---|---|
| R1-A01 | Pass | `tests/e2e/r1-flow.spec.ts`: “upgrades a v1 project file and a v1 saved project without touching the old data”; `tests/e2e/recovery.spec.ts`: “corrupt v2 recovery leaves a valid v1 storage entry byte-identical” | Browser fixtures verify the project migration path and preservation of the old bytes; this is not a production-user data audit. |
| R1-A02 | Pass | `tests/planner/migrate.test.ts`, `tests/planner/schema.test.ts`, `tests/e2e/editor.spec.ts`: autosave/file round-trip; `tests/e2e/r1-flow.spec.ts`: bathroom reload and file import/export round-trip | Unit validation covers invalid room/floor/fixture/verification shapes; browser round trips use fixtures. |
| R1-A03 | Pass | `tests/e2e/r1-flow.spec.ts`: “shows both benchmarks for the bathroom example and never a definite verdict”; English report coverage | Draft and missing benchmark values remain pending/not evaluated; no source value is certified by this result. |
| R1-A04 | Pass | `tests/e2e/r1-flow.spec.ts`: “on-site verified input remains a likely verdict while benchmark data is pending”; benchmark unit tests cover reviewed-value behavior | Seed data remains pending. The reviewed-value path is test data, not a reviewed release dataset. |
| R1-A05 | Pass | `tests/e2e/r1-flow.spec.ts`: “an advisor chooses the primary benchmark, which changes results and outdates the review” | Automated behavior only. |
| R1-A06 | Pass | `tests/e2e/r1-flow.spec.ts`: bathroom checks, bathroom pieces, and bathroom-to-living-room separation; planner check tests | Outcomes compare project data with draft/pending references and are not compliance findings. |
| R1-A07 | Pass | `tests/e2e/r1-flow.spec.ts`: “adds a grab bar in the wall view and moves it by keyboard and by number”; `tests/e2e/editor.spec.ts`: synchronized 3D movement; wall/plan/3D tests | Does not verify installation conditions or actual reach on site. |
| R1-A08 | Pass | `tests/e2e/r1-flow.spec.ts`: “records the resident, marks a fall, and keeps health data out of the report by default”; resident-needs unit tests | Health information remains local and optional; no clinical inference is made. |
| R1-A09 | Pass | `tests/e2e/r1-flow.spec.ts`: “previews and applies a fix as one undoable step”; “effort action list groups walk-through findings…”; action-list and fix unit tests | Unknown prices remain unknown. Recommendations and effort groups are advisory drafts. |
| R1-A10 | Pass | Report assertions in `tests/e2e/r1-flow.spec.ts` and `tests/e2e/editor.spec.ts`; health-data export warnings; report axe scan; six pages of `evidence/r1-report.pdf` visually reviewed | The plan legend embedded at the bottom of report page 2 is small/compressed; the separate report legend is readable. Legal wording and real-world costs still need human validation. |
| R1-A11 | Not passed | `tests/e2e/accessibility.spec.ts`: Thai/English axe scans for checks, resident, wall, fix preview and report; bathroom overflow at 390×844, 768×1024 and 1440×900; keyboard fix flow in `tests/e2e/r1-flow.spec.ts` | A native Thai speaker has not reviewed the new Thai copy and disclaimer. This human acceptance criterion remains open. |
| R1-A12 | Pass | `tests/e2e/editor.spec.ts` and `tests/e2e/r1-flow.spec.ts`: fictional examples, pending benchmark labels, and unknown-price behavior | Example content is fictional and does not verify local facts or costs. |

## Unverified source and market facts

The six facts below come from §13 of the v2 specification. None is treated as resolved by automated tests.

| Fact | Status |
|---|---|
| Benchmark values and clause numbers against Royal Gazette PDFs and the Department of Older Persons manual | Open. Seed benchmark values remain `pending`; definite verdicts are unavailable. |
| Whether the DOP regulation text matches the news-reported grant criteria | Open; no authoritative cross-check recorded. |
| Whether the older-persons home grant is funded/open in FY2026 and whether the two grants can be combined | Open; no current program confirmation recorded. |
| Whether the 2024 cabinet-approved draft disability-facilities regulation has been enacted | Open; no authoritative enactment check recorded. |
| The reported exemption for homes of 150 m² or less and its effect on professional-referral wording | Open; retain cautious referral language and make no legal claim from this report. |
| Regional prices from completed jobs | Open; no collected job dataset exists. Missing prices remain unknown rather than estimated. |

## Other release gates and limitations

- Adaptation rights for the CDC STEADI and DOP checklist sources are not confirmed. No public adaptation licence was located during the source review; the checklist remains draft and its questions remain pending review.
- Native Thai review of the R1 copy and disclaimer remains open (R1-A11).
- `pnpm lint` reports two errors in untouched starter files: `components/ui/carousel.tsx` (`react-hooks/set-state-in-effect`) and `hooks/use-mobile.ts` (`react-hooks/set-state-in-effect`). Scoped lint for planner code, tests and Playwright configuration passes.
- `pnpm build` and the production-only smoke test were not run. The user-owned Next.js development server (PID 41184) is active on port 3000 and owns the workspace `.next` output; building in place could disrupt it. The production test is skipped by design unless `PLAYWRIGHT_PRODUCTION=1`.
- WebKit was not run because its Playwright executable is not installed. Chromium is the browser verified here.
- The full Chromium suite passed 54 tests with 1 production-only test skipped, using one worker and reusing the active server. Unit tests passed 212 tests in 23 files; TypeScript and scoped ESLint passed.

No human source review, price collection, Thai review, permission decision, deployment, staging, or commit is implied by this matrix.
