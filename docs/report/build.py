#!/usr/bin/env python3
"""Generate docs/report/index.html from report/scored.json.

The scored data file is the single source of numbers shared with the paper and
the full report, so the page cannot drift from them. Run with --check to fail
when the committed page differs from what the data produces.

  python3 docs/report/build.py          # regenerate
  python3 docs/report/build.py --check  # drift check (exit 1 on drift)
"""
import html
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / "report" / "scored.json"
OUT = ROOT / "docs" / "report" / "index.html"
REPO = "https://github.com/ariaxhan/fleet-mcp"
BLOB = REPO + "/blob/main/"

e = html.escape


def link(path, label=None):
    return f'<a href="{BLOB}{e(path)}">{e(label or path)}</a>'


def cell(v):
    s = str(v)
    cls = ' class="pending"' if s.startswith("PENDING") else (' class="unproven"' if s.startswith("UNPROVEN") else "")
    return f"<td{cls}>{e(s)}</td>"


def table(head, rows):
    h = "".join(f"<th>{e(x)}</th>" for x in head)
    b = "".join("<tr>" + "".join(cell(c) for c in r) + "</tr>" for r in rows)
    return f'<div class="scroll"><table><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table></div>'


ARCH_SVG = """<svg viewBox="0 0 720 360" role="img" aria-labelledby="archt" class="arch">
<title id="archt">Fleet MCP architecture: agents call one Cloudflare Worker with a Context side and a State side over one shared core and Cloudflare storage; a Studio connector pushes local state in.</title>
<g font-family="inherit" font-size="13">
<rect x="10" y="20" width="150" height="60" rx="6" class="box"/><text x="85" y="46" text-anchor="middle">Agents (Codex,</text><text x="85" y="64" text-anchor="middle">any MCP client)</text>
<rect x="10" y="260" width="150" height="70" rx="6" class="box"/><text x="85" y="286" text-anchor="middle">Studio connector</text><text x="85" y="304" text-anchor="middle">(flights, probes,</text><text x="85" y="320" text-anchor="middle">local checks)</text>
<rect x="200" y="10" width="510" height="250" rx="8" class="worker"/><text x="215" y="32" font-weight="600">One Cloudflare Worker, one MCP endpoint</text>
<rect x="215" y="45" width="235" height="95" rx="6" class="box"/><text x="332" y="67" text-anchor="middle" font-weight="600">Context side</text><text x="332" y="89" text-anchor="middle">Exemplar, Recall,</text><text x="332" y="107" text-anchor="middle">Issue Context, Brief</text><text x="332" y="127" text-anchor="middle" class="sub">versioned resources</text>
<rect x="465" y="45" width="235" height="95" rx="6" class="box"/><text x="582" y="67" text-anchor="middle" font-weight="600">State side</text><text x="582" y="89" text-anchor="middle">Fleet Status, Verify</text><text x="582" y="107" text-anchor="middle">(incl. Render), Handoff</text><text x="582" y="127" text-anchor="middle" class="sub">live services</text>
<rect x="215" y="155" width="485" height="90" rx="6" class="core"/><text x="457" y="177" text-anchor="middle" font-weight="600">Shared core</text><text x="457" y="199" text-anchor="middle">content-addressed store, version registry,</text><text x="457" y="217" text-anchor="middle">ordered change feed, cache layer, delta engine</text>
<rect x="200" y="290" width="510" height="55" rx="6" class="box"/><text x="455" y="315" text-anchor="middle">D1 records, KV hot cache, R2 blobs,</text><text x="455" y="333" text-anchor="middle">Durable Objects coordination, Browser Rendering</text>
<line x1="160" y1="50" x2="200" y2="50" class="ln"/><line x1="160" y1="295" x2="215" y2="220" class="ln"/><line x1="455" y1="245" x2="455" y2="290" class="ln"/>
</g></svg>"""


def build(d):
    pre = d["preregistration"]
    ver = d["verification"]
    runs = d["runs"]
    outcomes = table(
        ["Hypothesis", "Metric", "Preregistered bar", "Control", "Treatment", "Abs. diff", "% change", "95% CI", "N", "Status"],
        [[o["id"], o["metric"], o["bar"], o["control"], o["treatment"], o["abs_diff"], o["pct_change"], o["ci95"], o["n"], o["status"]] for o in d["outcomes"]],
    )
    unproven = "".join(f"<li><b>{e(o['id'])}</b>: {e(o['status'])}</li>" for o in d["outcomes"] if o["status"].startswith("UNPROVEN"))
    costs = table(["Item", "Control", "Treatment", "95% CI"], [[c["item"], c["control"], c["treatment"], c["ci95"]] for c in d["costs"]])
    runrows = table(["Experiment phase", "Planned runs", "Completed"], [[k, v["planned"], v["done"]] for k, v in runs.items()])
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fleet MCP: what was built, how it is measured, what is proven</title>
<style>
:root{{--ink:#1d1b16;--paper:#f6f2e8;--rule:#cfc6b0;--accent:#7a3b12;--muted:#6b6455;--pend:#8a6d1a;--unp:#9b2c2c}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font:17px/1.6 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif}}
main{{max-width:880px;margin:0 auto;padding:48px 22px 80px}}
h1{{font-size:2.1rem;line-height:1.15;margin:0 0 8px}}h2{{font-size:1.35rem;margin:48px 0 10px;padding-top:14px;border-top:1px solid var(--rule)}}
.lede{{color:var(--muted);margin:0 0 22px}}a{{color:var(--accent)}}a:focus-visible{{outline:2px solid var(--accent);outline-offset:2px}}
.status{{border:1px solid var(--rule);background:#fffaf0;padding:14px 18px;border-radius:6px}}
nav ol{{columns:2;padding-left:20px;margin:8px 0}}
.scroll{{overflow-x:auto}}table{{border-collapse:collapse;width:100%;font-size:.86rem;margin:10px 0}}
th,td{{border-bottom:1px solid var(--rule);padding:6px 8px;text-align:left;vertical-align:top}}th{{font-family:ui-monospace,Menlo,monospace;font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}}
td.pending{{color:var(--pend);font-family:ui-monospace,Menlo,monospace;font-size:.8rem}}td.unproven{{color:var(--unp)}}
code{{font-family:ui-monospace,Menlo,monospace;font-size:.86em;background:#ece5d4;padding:1px 4px;border-radius:3px}}
.arch{{width:100%;height:auto;margin:10px 0}}.arch .box{{fill:#fffaf0;stroke:var(--ink)}}.arch .worker{{fill:none;stroke:var(--accent);stroke-dasharray:5 4}}.arch .core{{fill:#ece5d4;stroke:var(--ink)}}.arch .ln{{stroke:var(--ink);stroke-width:1.5}}.arch .sub{{fill:var(--muted);font-style:italic}}.arch text{{fill:var(--ink)}}
footer{{margin-top:56px;color:var(--muted);font-size:.85rem}}
@media(max-width:600px){{body{{font-size:16px}}nav ol{{columns:1}}h1{{font-size:1.7rem}}}}
</style></head><body><main>
<h1>Fleet MCP</h1>
<p class="lede">One unified MCP server on Cloudflare that serves the working state of a personal agent fleet, plus a preregistered benchmark of its effect on token use, speed, accuracy, and reliability. This page is generated from <code>report/scored.json</code>, the same scored data the paper and full report use.</p>
<div class="status"><b>Current status ({e(d['updated'])}):</b> {e(d['phase'])} Every result below reads PENDING until it is measured, scored from archived raw data, and independently verified. No result on this page is a claim.</div>
<nav aria-label="Contents"><ol>
<li><a href="#built">What was built</a></li><li><a href="#arch">Architecture</a></li><li><a href="#methods">Methods</a></li><li><a href="#prereg">Preregistration</a></li><li><a href="#results">Results</a></li><li><a href="#unproven">UNPROVEN items</a></li><li><a href="#data">Data index</a></li><li><a href="#verify">How to verify</a></li><li><a href="#costs">Costs</a></li><li><a href="#limits">Limitations</a></li><li><a href="#unfinished">What remains unfinished</a></li>
</ol></nav>

<h2 id="built">What was built, and why</h2>
<p>A baseline study of the fleet's own transcripts and runner records ({link('docs/baseline/report.md', 'baseline report')}) measured where agents waste work. Across 134 Antigravity lanes, 27.3% of prompt bytes were exact-line repeats. Across 12 Codex sessions, 11.2% of shell commands were repeat executions and 42.8% of file reads were re-reads. Across 12 Claude sessions, agents ran 311 sleep commands in polling loops and 500 GitHub CLI calls. In 6.8 days of runner records, 46% of attempts (488 of 1,056) were re-attempts (all figures: baseline report Part 1).</p>
<p>Fleet MCP is the response: one server that gives agents structured, cached, versioned access to fleet state, so they stop re-reading, re-fetching, re-polling, and rebuilding context after restarts. The {link('PRD.md', 'PRD')} specifies 33 tools across 7 areas. Build status: <b>not started</b>. Building waits on gate G0 (PRD v2 addressing both reviews) and a platform spike (gate G1).</p>
<p>Scope: a personal project with its own corpus, enforced by a repo allowlist in code. It never reads, serves, or benchmarks TBS data, repos, issues, or MCP content.</p>

<h2 id="arch">Architecture</h2>
{ARCH_SVG}
<p><b>Context side</b> (what the agent needs to know): reference exemplars, agentdb recall, GitHub issue state, and briefs, served as versioned resources with diffs. <b>State side</b> (what is true now): job and flight status with credential preflight, cached verification and renders, and handoff checkpoints, served as live services that wait server-side instead of in sleep loops. Both sit on one core: a content-addressed store keyed by SHA-256, an append-only version registry, one ordered change feed, and a cache that labels every response hit, miss, stale, or bypass. A Studio-side connector pushes local flight state and probe results in; credentials never leave the machine (execution plan item R1).</p>

<h2 id="methods">Methods</h2>
<ul>
<li><b>Design:</b> paired controlled experiment on Codex solo, one pinned model ID. Control arm works as agents do today (brief, files, CLI, bash agentdb). Treatment arm adds Fleet MCP. Arm order randomized, fresh agents and isolated worktrees per arm, caches reset cold per run.</li>
<li><b>Runs:</b> pilot 10 tasks x 2 arms (not pooled), confirmatory floor 30 x 2 up to a cap of 50 x 2 powered from the pilot SD upper confidence limit, repeatability substudy 10 tasks re-run twice more per arm. Minimum 120 runs.</li>
<li><b>Primary endpoint:</b> total tokens per task (input, output, cache-read reported separately), estimated as the mean per-task log ratio back-transformed to percent change, BCa bootstrap 95% CI primary, paired t-interval as robustness check. Wall clock and correctness are key secondaries under Holm correction; everything else is exploratory.</li>
<li><b>Deterministic replays</b> of the measured baselines run first and report exact counts (targets R1 to R7).</li>
<li>Failures, timeouts, and aborted runs are outcomes, not exclusions. Intent-to-treat: an agent that ignores the tools still counts.</li>
</ul>
<p>Full protocol: {link('docs/execution-plan.md', 'execution plan')} (Section 3.4), {link('paper/skeleton.md', 'paper')} Section 5.</p>

<h2 id="prereg">Preregistration</h2>
<p>Hypotheses, task pool with selection rule and seed, model ID, cache condition, and analysis plan freeze as git tag <code>{e(pre['tag'])}</code> before the first treatment run, pilot included.</p>
{table(['Field', 'Value'], [['Tag', pre['tag']], ['Frozen', 'yes' if pre['frozen'] else 'PENDING (not frozen)'], ['SHA-256', pre['sha256']], ['Remote timestamped record', pre['remote_record']]])}
<p>Link once frozen: <a href="{REPO}/releases/tag/{e(pre['tag'])}">{REPO}/releases/tag/{e(pre['tag'])}</a> (does not resolve until the freeze).</p>

<h2 id="results">Results</h2>
<p>Columns follow deliverable 1: control, treatment, absolute difference, relative percent change, 95% CI, and N. A headline number without its CI and N is never shown.</p>
{outcomes}
{runrows}

<h2 id="unproven">UNPROVEN items</h2>
<p>A result that cannot be proven to the evidence standard is labeled UNPROVEN with what it would take to prove it. Known in advance:</p>
<ul>{unproven}
<li><b>Avoidability of baseline repetition:</b> transcripts count repetition exactly, but cannot show a re-read was unnecessary without knowing whether the file changed. Bounded, not proven (baseline report, Limitations).</li>
<li><b>Zero-event criteria (H5, H7):</b> zero observed events will be reported with a finite-sample interval, never as proof of a zero rate.</li></ul>

<h2 id="data">Data index</h2>
<ul>
<li>Scored data (single source for this page, paper, report): {link('report/scored.json')}</li>
<li>Baseline report and analyses: {link('docs/baseline/report.md')}, {link('docs/baseline/analysis/codex-findings.md', 'Codex')}, {link('docs/baseline/analysis/antigravity-findings.md', 'Antigravity')}, {link('docs/baseline/analysis/agentdb-recent-findings.md', 'agentdb and runner')}</li>
<li>Reviews: {link('docs/reviews/codex-review.md', 'Codex review')}, {link('docs/reviews/claude-review.md', 'Claude review')}</li>
<li>Benchmark raw data, task pool, scoring script, and archive index: <code>benchmark/</code> (PENDING, created in Phase 3; large transcripts in R2 keyed by content hash)</li>
</ul>

<h2 id="verify">How to verify</h2>
<ol>
<li>Clone <a href="{REPO}">{REPO}</a>.</li>
<li>Check this page matches the data: <code>python3 docs/report/build.py --check</code> (exits nonzero on drift).</li>
<li>Once frozen, confirm the preregistration hash: <code>git show {e(pre['tag'])}</code> and compare the SHA-256 in the tag message with the one above.</li>
<li>Once runs exist, re-run the one-command scoring script from archived raw data and compare to <code>report/scored.json</code> (exact for counts, preregistered tolerance for derived statistics).</li>
<li>Independent verification receipt: <b>{e(ver['status'])}</b> (verifier: {e(ver['verifier'])}; receipt: {e(ver['receipt'])}).</li>
</ol>

<h2 id="costs">Costs</h2>
<p>Dollars are computed from recorded tokens and the model price at run time; the baseline has no dollar data (no cost column in runner records, no cost field in Codex rollouts).</p>
{costs}

<h2 id="limits">Limitations</h2>
<ul>
<li>Single model (Codex, one pinned version): results do not transfer to other models without a separate run.</li>
<li>One fleet's tasks: personal-project jobs only, preregistered selection rule, selection bias is a named risk.</li>
<li>Baseline sample: the Codex sample is the 12 largest of 936 rollouts (1.3% of files); its rates describe large sessions.</li>
<li>The server's own schema and tool-response tokens count against it; the benchmark measures net effect.</li>
<li>Correctness non-inferiority is likely underpowered (see H4).</li>
<li>Cache staleness and stored-content prompt injection are design risks with mitigations, not eliminated risks.</li>
</ul>

<h2 id="unfinished">What remains unfinished</h2>
<ul>
<li>Gate G0: PRD v2 with every review item addressed.</li>
<li>Gate G1: platform spike verdict on eight proof criteria.</li>
<li>Gate G2: full server build, acceptance matrix green on real personal-project data.</li>
<li>Gate G3: preregistration freeze, all runs, independent verification receipt.</li>
<li>Gate G4: all seven deliverables accepted, including this page in final form.</li>
</ul>
<footer>Generated by <code>docs/report/build.py</code> from <code>report/scored.json</code>. Do not edit this file by hand.</footer>
</main></body></html>
"""


def main():
    page = build(json.loads(DATA.read_text()))
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text() != page:
            print("docs/report/index.html is stale: run python3 docs/report/build.py")
            return 1
        print("docs/report/index.html matches report/scored.json")
        return 0
    OUT.write_text(page)
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
