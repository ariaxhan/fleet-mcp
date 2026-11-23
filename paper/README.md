# Research paper, deliverable 7

**State: pre-collection draft. Efficacy UNPROVEN. Acceptance incomplete.**

Aria Han is sole author; Muse provides drafting support. This is a repository working draft, not a final publication. Source inspection revision: `1f11d37bc32a7871edff53219768c6dfdba52305` on 2026-11-22. No `benchmark/`, preregistration tag, scoring output, or independent verification receipt was available in that inspected checkout. No runs were executed by this writing task.

- [Manuscript](manuscript.md): scaffold, provisional methods, writing record, withheld result sections.
- [References](references.bib): only local sources actually consulted; no invented external citations.
- [Evidence map](evidence-map.csv): design decisions separated from withheld empirical claims.
- [Figures](figures/README.md): generation and provenance requirements; no fabricated result assets.
- [Original skeleton](skeleton.md): retained unchanged, including its historical wording. It is not the current manuscript or a certified result.

## Writing and release gates

1. Align provisional methods with PRD v2 and the G0 owner sign-off before build. This manuscript does not certify G0.
2. Freeze protocol identity and independent chronology before any treatment run, pilot included.
3. After verified pilot scoring, add pilot findings, power-derived N, and dated amendments. Preserve the original protocol and separate pilot data.
4. Append contemporaneous batch notes in manuscript Section 5 during every batch. Do not backdate or reconstruct them.
5. After independent verification, populate results and generate assets from archived measurements. Every measured claim needs protocol version/hash, raw IDs, analysis revision, scored-output ID, and receipt.
6. Compare paper, report, and HTML against the same scored outputs. Keep every unsupported effect UNPROVEN on every surface. Finalize only after G3.

## Evidence-map conventions

`DESIGN` rows cite planned values and need no fabricated raw IDs or verification receipts. `UNPROVEN` rows are withheld result families, not certified measurements. Empty provenance cells explicitly mean unavailable. Add a distinct claim ID for each measured quantity, including figure/table cells and denominators, when verified evidence exists. Use immutable archive IDs rather than mutable paths alone. A code review of this draft cannot supply a benchmark verification receipt.

## Validation and remaining acceptance

At the source revision, the repository defines no package manifest, Makefile, justfile, test runner, paper renderer, figure generator, or documented capture command. Documentation checks can verify links, CSV structure, bibliography keys, whitespace, and the no-em-dash rule; they cannot substitute for experiment verification.

Scaffold and provisional methods are present before collection as observed locally. Full-experiment coverage, measured figures and tables, verified results, quantitative provenance, and paper/report/HTML agreement remain incomplete pending the gated upstream experiment and independent verification. No deployment is needed for this Markdown draft; the landed GitHub commit is its review surface. No final publication is authorized before verification.

Validation for this draft: local link resolution, evidence-map CSV shape and unique claim IDs, bibliography keys, sole-author labeling, no fabricated receipts, and the no-em-dash rule passed. `git diff --check` passed. A requested separate draft review could not start because the agent service returned `invalid thread-store request: no rollout found`; no independent review or benchmark certification is claimed.
