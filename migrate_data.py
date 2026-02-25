#!/usr/bin/env python3
"""
Migration script: Supabase → Local PostgreSQL
Uses psql COPY TEXT format (compatible across PG versions)
aba_admin must be SUPERUSER for session_replication_role
"""
import subprocess
import sys

SUPABASE = "postgresql://postgres.svvxhmhkghauhnvqcgbi:Pr0s1s.2026@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require"
LOCAL = "postgresql://aba_admin:Pr0s1s.2026@localhost:5432/aba_supervision"

TABLES = [
    "User",
    "Notification",
    "OfficeMember",
    "Supervisor",
    "Student",
    "RepeatingSchedule",
    "IndependentHour",
    "SupervisionHour",
    "GroupSupervisionSession",
    "GroupSupervisionAttendance",
    "StudentEvaluation",
    "Contract",
    "ContractSupervisor",
    "Invoice",
    "Document",
    "StudentPayment",
    "SupervisorPayment",
    "GeneralValues",
]

def psql_cmd(url, sql, input_data=None):
    proc = subprocess.Popen(
        ["psql", url, "-c", sql],
        stdin=subprocess.PIPE if input_data is not None else None,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    out, err = proc.communicate(input=input_data)
    return proc.returncode, out.decode("utf-8", errors="replace"), err.decode("utf-8", errors="replace")

print("=== Step 1: Truncating all tables (reverse FK order) ===")
for table in reversed(TABLES):
    rc, out, err = psql_cmd(LOCAL, f'SET session_replication_role = replica; TRUNCATE TABLE "{table}" CASCADE;')
    if rc == 0:
        print(f"  TRUNCATE {table}: OK")
    else:
        print(f"  TRUNCATE {table}: ERR → {err.strip()[:100]}")

print("")
print("=== Step 2: Migrating data table by table ===")
for table in TABLES:
    # Get count
    rc, out, _ = psql_cmd(SUPABASE, f'SELECT count(*) FROM "{table}";')
    lines = [l.strip() for l in out.splitlines() if l.strip().lstrip('-').strip().isdigit()]
    count = lines[0] if lines else "?"

    if count == "0":
        print(f"  SKIP (empty): {table}")
        continue

    print(f"  Migrating {table} ({count} rows)...", end=" ", flush=True)

    # Export from Supabase using COPY TO STDOUT (text format)
    export_proc = subprocess.Popen(
        ["psql", SUPABASE, "-c", f'COPY "{table}" TO STDOUT'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    export_data, export_err = export_proc.communicate()

    if export_proc.returncode != 0 or not export_data:
        print(f"EXPORT_ERR: {export_err.decode()[:100]}")
        continue

    # Import into local DB (FK checks disabled)
    import_proc = subprocess.Popen(
        ["psql", LOCAL, "-c", f'SET session_replication_role = replica; COPY "{table}" FROM STDIN'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    _, import_err = import_proc.communicate(input=export_data)

    if import_proc.returncode != 0:
        print(f"IMPORT_ERR: {import_err.decode()[:100]}")
    else:
        print("OK")

print("")
print("=== Final Verification ===")
rc, out, err = psql_cmd(LOCAL, '''SELECT
  (SELECT count(*) FROM "User") as users,
  (SELECT count(*) FROM "Student") as students,
  (SELECT count(*) FROM "Supervisor") as supervisors,
  (SELECT count(*) FROM "SupervisionHour") as sup_hours,
  (SELECT count(*) FROM "IndependentHour") as ind_hours,
  (SELECT count(*) FROM "GroupSupervisionSession") as groups;''')
print(out)
if err:
    print("ERRORS:", err[:200])
