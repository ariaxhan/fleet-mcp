"""Real SQLite forward application and namespace constraint checks."""
import sqlite3
from pathlib import Path

db = sqlite3.connect(":memory:")
for migration in sorted(Path("migrations").glob("*.sql")):
    db.executescript(migration.read_text())
assert db.execute("SELECT namespace_id FROM scaffold_fixture ORDER BY namespace_id").fetchall() == [
    ("fixture-production",), ("fixture-staging",)
]
try:
    db.execute("INSERT INTO scaffold_fixture (namespace_id) VALUES ('synthetic-excluded')")
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("nonfixture namespace accepted")
print("PASS forward migrations and fixture namespace constraint")
