"""Runner workspace for ariaxhan/fleet-mcp (interface: nexus-office runner/workspace.py)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
NAME = 'fleet'
TITLE = 'Fleet MCP'
REPOS = ('ariaxhan/fleet-mcp',)
INTAKE = ['ariaxhan/fleet-mcp']
LANES = 2
PROMPT = ('fleet-mcp: one unified MCP server on Cloudflare plus a preregistered benchmark of its effect. '
          'Read AGENTS.md, PRD.md, and docs/execution-plan.md before any work. No em dashes in any writing. '
          'Never touch TBS data, repos, issues, or MCP content: personal-project corpus only. '
          'No build before gate G0, no "with" run before the preregistration freeze (bench-prereg-v1), '
          'no publication before independent verification. '
          'Verify on the real surface; a commit on main plus a surface check is done.')


def checkout(repo):
    return ROOT


def prompt(task, body):
    return PROMPT
