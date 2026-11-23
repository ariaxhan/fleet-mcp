# Fleet MCP: A Protocol for Evaluating Shared Context and State in an Agent Fleet

**Author:** Aria Han (sole author). Muse provides drafting support.

**Status:** Pre-collection working manuscript, 2026-11-22. Efficacy: **UNPROVEN**. Not a final research publication. No experiment result or implementation completion is asserted.

**Scope:** Personal-project corpus and tasks only. No TBS data, repos, issues, or MCP content may be read, ingested, quoted, or served. Boundary tests must use synthetic excluded identifiers.

## Abstract

Repeated context retrieval, state polling, verification, and recovery may consume resources in agent workflows. Fleet MCP proposes a unified hosted interface for versioned context and live state, with shared caching, provenance, and session continuity. Whether this interface improves task performance is an empirical question. This manuscript specifies a paired controlled evaluation against the existing workflow, retaining command-line memory access in the control arm. Deterministic replays assess mechanisms separately from the agent experiment. The planned experiment separates pilot, confirmatory, and repeatability cohorts, records net resource use and independently checked outcomes, and requires archived evidence and independent verification before reporting results. Token savings, elapsed-time savings, correctness, reliability, and cost effects remain **UNPROVEN**.

## 1. Introduction

A shared service could reduce repeated work across agents by serving immutable versions, deltas, cached checks, and state changes. It could also add schema tokens, network latency, stale state, and operational dependencies. Savings cannot be inferred from the existence of a cache or from repeated commands alone. Repetition may be necessary when source state changes.

The research question is whether Fleet MCP improves on the current personal-project workflow under controlled task and model conditions. The intended contribution is an auditable system evaluation, including null or adverse effects. This draft derives its section structure from [the original skeleton](skeleton.md), while replacing its affirmative title, retrospective implementation language, historical aggregate counts, and unverified data-availability statements. Historical aggregates are not a live control arm and are not carried into this manuscript as measurements.

## 2. Related work and evidence boundaries

The project documents describe command-line memory, programmatic outcome verification, and provenance-based certification as methodological precedents [@fleet-prd; @fleet-plan]. They do not establish Fleet MCP's efficacy. Comparative claims about external systems await direct source review and pinned reuse records. No external performance comparison is asserted here.

The original skeleton mixes historical observations with proposed experimental targets. This manuscript reports no historical quantitative result: scope approval, raw provenance, and independent verification would be needed before importing one. Published literature and benchmark reuse should be documented separately from experimental evidence; a bibliography entry alone does not certify a measurement.

## 3. Proposed system

The proposed Context side serves exemplars, lessons, issue context, and briefs as versioned resources. The proposed State side serves jobs, flights, verification, renders, and handoff state. Both use a shared content-addressed store, version registry, change feed, cache, and delta layer [@fleet-prd]. Cloudflare hosting and a Studio connector are the planned deployment boundary [@fleet-plan, Section 3.1]. These are design descriptions, not observed capabilities.

The revised PRD v2 contract binds cached results to complete computation identities, distinguish observation time from serving time, enforce freshness requests, preserve historical snapshots, and make state updates and feed events transactional. The connector must enforce a personal-only source allowlist before upload. Credential material stays local; only bounded liveness attestations leave the machine. Durable acknowledgements, reconciliation, idempotency, and explicit offline behavior are required design properties. The sidecar is outbound-only, with bounded typed local jobs rather than a general remote shell. Pure byte checks run server-side; workspace checks run locally and push results bound to tree, suite, and environment identity. Render always observes the live page and deduplicates screenshots afterward; a cache hit never substitutes for observation [@fleet-prd, Sections 2.6 and 7.5]. Platform proof and deployed acceptance receipts belong in the final system description after the relevant gates pass.

## 4. Methods, proposed before collection

### 4.1 Authority and chronology

The revised PRD v2 incorporates the execution plan resolutions. This manuscript follows those contracts, particularly the primary log-ratio endpoint, bootstrap interval, single-model judge rule, and cold-cache default [@fleet-plan, Sections 3.1 and 8]. It does not itself freeze a protocol or pass G0. Revised PRD alignment and owner sign-off remain required before building.

Before the first treatment run, including the pilot, freeze the protocol as `bench-prereg-v1`: commit, tag, SHA-256, and a remote timestamped registration record. Freeze the task pool, ranked draw order and seed, prompts and arm delta, model and CLI identities, reasoning configuration, limits, server revision, starting snapshots, metric definitions, exclusions, power rule, analysis plan, verifier assignment, and numeric tolerances. A local tag alone establishes identity, not independently trustworthy chronology. No freeze is claimed in this draft.

### 4.2 Tasks and intervention

Use real personal-project tasks with recorded briefs and independently verifiable outcomes. The planned ranked pool has at least 60 tasks, with 10 pilot tasks disjoint from up to 50 confirmatory tasks. These are design sizes, not observed sample counts (D01 in `evidence-map.csv`). Stratify by waste class, use the recorded mechanical selection rule, and obtain an independent representativeness audit before freezing.

For each task, compare a fresh agent using the existing workflow against a fresh agent using that workflow plus Fleet MCP. Keep brief, initial state, model, limits, and baseline command-line memory access identical. Randomize arm order and block or randomize scheduling to address shared-worker contention. Isolate fixtures, deployments, checkpoints, and memory writes across arms. Do not let pilot learning modify the confirmatory corpus. Snapshot both baseline memory and treatment corpus.

Use Codex solo, with the exact model identity and client configuration frozen. If the provider changes, stop the affected cohort, preserve all data, and retain the pinned snapshot or amend and restart the affected paired cohort. Do not pool model versions. Where immutable identity cannot be established, disclose that limitation and withhold model-controlled claims.

### 4.3 Cache conditions and measurement

The planned primary condition resets KV, verification, and render caches before each run. Record reset receipts, cache hits and misses, and origin run IDs. Warm-cache reuse is a separate descriptive factor and must not be pooled into the primary estimate.

Record input, output, cache-read, and applicable cache-write tokens separately. Normalize raw usage into disjoint uncached input U, cache-read R, cache-write W, and output O; primary total T = U + R + W + O across all attempts. If inclusive input I already contains R and W, T = I + O. Never double count cached input or inclusive reasoning output. Validate and archive the provider-field mapping before the pilot; unresolved accounting blocks analysis [@fleet-prd, Section 8.1]. Include tool schemas and tool-response overhead. Capture elapsed task time and tool time, calls by type and class, errors, adoption, independently verified correctness, reliability, model cost, and allocated server cost. Freeze units, denominators, capture sources, missing-data rules, aggregation, and interval methods in `benchmark/metrics.md` before collection. That file is a required future artifact, not an existing citation.

Accuracy includes binary correct completion and any separately defined graded score, with task-specific acceptance rubrics and programmatic checks where possible. Report percentage-point differences as well as relative changes where defined. Reliability is completion within fixed time and attempt budgets. Keep first-attempt success, eventual success, tasks needing another attempt per tasks started, extra attempts per all attempts, and attempts per completed task distinct. Separate deaths, authentication failures, timeouts, stale results, and infrastructure failures. Error rates require explicit call or task denominators. Zero denominators produce undefined values with reasons, never fabricated savings.

### 4.4 Cohorts and stopping rule

The design specifies a pilot of 10 paired tasks (20 runs), a confirmatory floor of 30 paired tasks (60 runs), a cap of 50 paired tasks (100 runs), and a repeatability substudy of 10 confirmatory tasks with two extra runs per arm (40 additional runs). The minimum planned total is 120 runs. These are design decisions, not collected observations (D01).

Keep pilot data separate. Validate instrumentation, estimate pilot variability, and compute confirmatory N using the frozen power rule with an upper confidence limit of pilot SD or preregistered inflation. Target power is 80% at two-sided alpha 0.05 (D02). Freeze N before viewing confirmatory outcomes. The floor is a design decision, not a guarantee of interval quality. If the cap is insufficient, report the affected effect as UNPROVEN with required N; do not continue until significance appears. Preserve aborted runs, timeouts, failures, and exclusions in the expected-run ledger. Apply only exclusions defined before outcomes were observed.

### 4.5 Endpoints and inference

For positive total-token values, define each task's log ratio as `log(T_with / T_control)`. The primary estimand is the mean task log ratio, back-transformed as `100 * (exp(mean_log_ratio) - 1)` for signed percent change. Negative values indicate reduction. Report reduction as the negative of signed change and reverse interval endpoints accordingly. Zero or missing token values require the frozen handling rule; no post hoc offset or silent deletion is allowed.

Use a 95% BCa bootstrap interval as primary and the paired t-interval on log ratios as robustness analysis (D02). Resample whole task pairs with the frozen seed and 10,000 resamples (design decision, D02). A degenerate BCa interval is an analysis failure; the robustness interval cannot replace it for primary success. Only first paired runs enter primary inference. Repeatability uses the PRD mixed model with arm, order and scheduling-block effects, task intercept and task-specific arm effects, and residual run variance. Use task-cluster bootstrap intervals. If singular or nonconvergent, report descriptive within-task-arm variances and paired task means with task bootstrap intervals; label model decomposition UNPROVEN [@fleet-prd, Section 8.4]. Report per-task outcomes and variance as well as aggregates.

The token target is a reduction point estimate of at least 20% with an interval excluding no improvement (D03). This supports improvement with a target-sized estimate, not a true reduction of at least 20% unless the interval supports that stronger claim. Wall-clock and correctness are key secondaries with Holm correction; other thresholds are exploratory. Apply Holm familywise alpha 0.05, comparing ordered p-values with 0.025 then 0.05 (design decisions, D02). Report raw and adjusted p-values and decision-compatible bounds [@fleet-prd, Section 8.4].

The elapsed-time reduction target is 15%; the state-check and re-fetch call reduction target is 50%; the correctness non-inferiority margin is 5 percentage points; recall adoption targets 80% of treatment sessions; dead-credential launches and sleep loops target zero (D03). These are proposed thresholds, not results or proof of preregistration. Correctness uses the exact unconditional paired-binomial procedure specified in PRD Section 8.4, with frozen optimizer and validation cases. Report paired discordant cells and the with-minus-control interval; require the conservative Holm-compatible one-sided 97.5% lower bound strictly above -0.05 and report the adjusted test decision (design decisions, D03). Freeze separate power simulations before runs. A small point difference does not demonstrate non-inferiority. Zero observed events require denominators and finite-sample intervals and do not prove a zero population rate.

### 4.6 Replays and outcome verification

Deterministic replays R1 through R7 cover exemplars, issue context, verification, fleet state, handoff, briefs, and recall (D04). Approve each input's personal-project provenance before use; rebuild out-of-scope inputs from authorized material. Include output and schema overhead, check source changes where hashes exist, and label simulated time explicitly. Exact replay counts are mechanism upper bounds, not causal agent-effect estimates. Verify and archive replay inputs and outputs independently.

Use programmatic correctness checks wherever possible. Where judgment is required, use the same pinned Codex model under a separate operator with a frozen rubric and arm-blinded artifacts where feasible. Record agreement and its preregistered floor; insufficient agreement makes judged correctness UNPROVEN. The verifier must be independent of the producer and assigned before confirmatory execution. It must rerun scoring from archived data, match counts exactly and derived statistics within frozen tolerances, and independently rederive a random sample of raw metrics without using the scoring script. A manuscript review is not that verification receipt.

## 5. Writing gates and contemporaneous record

This is the initial pre-collection entry, dated 2026-11-22. Repository inspection found the skeleton and planning documents, but no `benchmark/` archive, scoring output, `bench-prereg-v1` tag, or independent verification receipt at the source revision recorded in the README. No collection or scoring was performed for this writing entry. This observation does not certify the absence of runs outside the repository.

- Before collection: complete scaffold and methods, reconcile against PRD v2, then link the freeze record. Current state: provisional scaffold only.
- After pilot: write pilot findings only from verified scoring, record dated amendments without replacing the original protocol, and link the frozen confirmatory N. Current state: UNPROVEN, no pilot evidence available here.
- During each batch: append a contemporaneous entry below with UTC time, phase and batch IDs, protocol tag and hash, run-ledger range, archive acknowledgements, analysis revision, verified-output IDs if available, anomalies and missing evidence, and amendment links. Record operational observations separately from efficacy claims. Do not reconstruct notes retrospectively.
- After independent verification: generate figures and tables from archived measurements and verified scoring, link receipts, then write final results and discussion. Current state: UNPROVEN.

2026-11-23 (UTC), PRD v2 alignment: Updated the proposed system and methods against `dfd8900`, including outbound-only sidecar jobs, always-observe Render, disjoint token accounting, task-pair bootstrap, repeatability model and fallback, and Holm-compatible correctness inference. Revision issues #2 through #10 are closed on GitHub, but issue closure does not supply the owner-reserved G0 sign-off. No freeze, run, measurement, or certification is asserted. This is a pre-collection editorial entry, not a batch note.

### Batch notes

No batch entry is claimed. The next entry must be written during an actual batch and identify its primary evidence. Empty templates do not establish contemporaneous writing.

### Dated manuscript amendments

2026-11-22: Created a neutral pre-collection manuscript from the skeleton's topic structure. Applied execution-plan statistical resolutions, removed unsupported retrospective claims and mixed-scope historical measurements, and separated planned sample sizes from results. This is an editorial amendment, not a preregistration amendment or G0 sign-off.

2026-11-23 (UTC): Rechecked the submission after the earlier draft landed. The [pilot readiness record](../docs/pilot-status.md) reports NOT RUN; the [confirmatory readiness record](../docs/confirmatory-status.md) reports NOT RUN. The separate verifier's [receipt](../benchmark/verification/receipt.md) records **NOT CERTIFIED**, a prerequisite failure rather than a measured null effect. These are readiness and verification records, not experimental observations or batch notes. The receipt does not authorize filling result panels. The remote tag lookup still supplies no `bench-prereg-v1`. No experiment was executed by this continuation.

## 6. Results

**UNPROVEN.** No verified scoring output is available to populate results. No effect estimate, confidence interval, observed N, cost, replay count, pilot variance, or power calculation result is reported. The available verification verdict is **NOT CERTIFIED**, as documented in the [prerequisite-failure receipt](../benchmark/verification/receipt.md), not a completed statistical verification.

Required result panels are: net token use; elapsed time; binary and graded correctness; reliability and errors with distinct denominators; model and server costs; calls and adoption; deterministic replays; pilot and amendments; confirmatory effects; repeatability variance; archive reconciliation; and independent verification. Each panel must include control, treatment, absolute difference, relative change where defined, interval, observed N, and evidence links as applicable. Undefined and missing values must be explicit. Exact deterministic counts need provenance rather than inferential intervals.

Every measured claim must link to a completed evidence-map row containing protocol version and hash, immutable raw artifact IDs, analysis revision, scored-output ID, and independent verification receipt. The current map contains only design decisions and withheld result families. It contains no certified quantitative claim. No empirical figure or table has been generated. See [figure policy](figures/README.md).

## 7. Discussion and limitations

Efficacy conclusions are withheld until verification. Plausible failure modes include schema overhead exceeding reuse savings, low tool adoption, stale-cache mistakes, connector outages, scheduling contention, task selection bias, incomplete captures, scoring bugs, and unverified model identity. These are threats to test, not observed failures.

The planned study concerns a single model and a personal-project task pool. It cannot establish effects for other models, organizations, workloads, or excluded corpora. Replays cannot establish causal task savings. Correctness non-inferiority may remain UNPROVEN even if tokens improve. Adoption-conditioned analyses are exploratory; primary analysis follows assignment, including treatment agents that ignore the tools. Report null and adverse outcomes without suppressing them. A provenance or instrumentation failure may warrant NOT CERTIFIED and an honest failure report rather than an efficacy claim.

## 8. Data availability and reproducibility

No experiment archive or executable scoring command is asserted to exist. Planned small artifacts live under `benchmark/data/`; large encrypted transcripts belong in R2 with an independent off-Cloudflare mirror, immutable hashes, and a clear archive index. Keep redacted copies separately with a redaction manifest. Retain all experiment evidence indefinitely, including failed, negative, interrupted, and superseded runs. Missing evidence is a recorded data-loss failure, never silently reconstructed.

Before finalization, link the expected-run ledger, append-only index, checksum reconciliation, second-copy receipts, restore-drill receipt, frozen protocol and amendments, scored outputs, and independent verification receipt. Publish the actual repository-documented reproduction command only when it exists and has been rerun independently. Availability promises are not availability evidence.

## 9. Cross-deliverable consistency and conclusion

Effects on tokens, time, correctness, reliability, and costs remain **UNPROVEN**. Concurrent tasks added `report/report.md`, `report/scored.json`, and `docs/report/index.html` after initial inspection. Their result fields remain PENDING or UNPROVEN. The shared scored JSON is a scaffold, not verified scoring output, and its placeholder run counts are not archive-derived measurements. The paper, report, and HTML must use the same verified scoring output and evidence-map claim IDs when measurements exist. Current labels agree that efficacy is UNPROVEN; quantitative consistency is not yet certifiable. No result page was published by this task.

Final claims require G3 and independent verification. Until then, this manuscript is a methods draft and evidence contract. Completing its scaffold does not complete deliverable 7 or gate G4.

## References

- [@fleet-prd] Muse. *Fleet MCP product requirements document*. Draft, 2026-11-22. [PRD.md](../PRD.md).
- [@fleet-plan] Muse. *Fleet MCP execution plan*. 2026-11-22. [Execution plan](../docs/execution-plan.md), especially Sections 3.1, 3.4, 3.5, and 8.
- [@fleet-skeleton] Muse. *Fleet MCP paper skeleton*. 2026-11-22. [Skeleton](skeleton.md). Structural source only; its affirmative claims are not adopted as results.
