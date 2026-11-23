"""Read only the enumerated personal-project lesson DB, push to authenticated Worker."""
import json
import os
from pathlib import Path
import sqlite3
import sys
from datetime import datetime, timezone
from urllib.request import Request, urlopen

root = Path(__file__).resolve().parents[1]
# Never discover DBs, follow workspace links, or read a global lesson store.
path = root / '_meta/agentdb/agent.db'
if path.is_symlink() or path.resolve() != path:
    raise RuntimeError('Source DB must be the canonical project file')
origin = sys.argv[1]
if origin not in ('https://fleet-mcp-staging.ariaxhan.workers.dev', 'https://fleet-mcp.ariaxhan.workers.dev'):
    raise RuntimeError('Origin not allowlisted')
db = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
db.row_factory = sqlite3.Row
# This project DB is an explicit collection. Only its project-tagged lessons are
# eligible; no global/imported corpus or confidential/human-only lessons.
rows = db.execute("""SELECT id,type,insight,evidence,hit_count,last_hit FROM learnings
 WHERE insight LIKE '%fleet-mcp%' AND visibility='agent' AND sensitivity='low'
 AND archived_at IS NULL ORDER BY id""").fetchall()
lessons = [dict(id=r['id'],kind=r['type'],what=r['insight'],why=r['evidence'] or '',
                hit_count=r['hit_count'] or 0,last_recalled=r['last_hit']) for r in rows]
migrations = [r[0] for r in db.execute('SELECT name FROM _migrations ORDER BY name')]
report = dict(schema_version=migrations[-1] if migrations else 'unversioned',
              drift_flags=[] if migrations else ['missing_migration_history'],
              errors_last_write=db.execute('SELECT max(ts) FROM errors').fetchone()[0],
              collection_filter="project-tagged active agent-visible low-sensitivity lessons",
              source_rows=len(lessons),
              top_failure_classes=[dict(kind=r['type'],count=r['n']) for r in db.execute("""SELECT type,count(*) n FROM learnings
               WHERE insight LIKE '%fleet-mcp%' AND visibility='agent' AND sensitivity='low' AND archived_at IS NULL GROUP BY type""")])
payload = dict(source_db='ariaxhan/fleet-mcp/_meta/agentdb/agent.db',source_repo='ariaxhan/fleet-mcp',
               observed_at=datetime.now(timezone.utc).isoformat(),lessons=lessons,report=report)
request = Request(origin+'/admin/sync/recall',data=json.dumps(payload).encode(),
                  headers={'Authorization':'Bearer '+os.environ['FLEET_READ_PATH_TOKEN'],'Content-Type':'application/json'})
with urlopen(request, timeout=60) as response:
    print(response.read().decode())
