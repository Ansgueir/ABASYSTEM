#!/bin/bash
SUPABASE="postgresql://postgres.svvxhmhkghauhnvqcgbi:Pr0s1s.2026@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require"
LOCAL="postgresql://aba_admin:Pr0s1s.2026@localhost:5432/aba_supervision"

TABLES=("User" "Notification" "OfficeMember" "Supervisor" "Student" "RepeatingSchedule" "IndependentHour" "SupervisionHour" "GroupSupervisionSession" "GroupSupervisionAttendance" "StudentEvaluation" "Contract" "ContractSupervisor" "Invoice" "Document" "StudentPayment" "SupervisorPayment" "GeneralValues")

echo "=== Step 1: Truncate all tables (FK disabled) ==="
for T in "${TABLES[@]}"; do
  psql "$LOCAL" -c "SET session_replication_role = replica; TRUNCATE TABLE \"$T\" CASCADE;" 2>/dev/null && echo "Truncated: $T" || echo "Skip truncate: $T"
done

echo ""
echo "=== Step 2: Migrate data table by table ==="
for T in "${TABLES[@]}"; do
  COUNT=$(psql "$SUPABASE" -t -A -c "SELECT count(*) FROM \"$T\";" 2>/dev/null | tr -d ' ')
  if [ -z "$COUNT" ] || [ "$COUNT" == "0" ]; then
    echo "SKIP (empty): $T"
    continue
  fi
  echo -n "Migrating $T ($COUNT rows)... "
  psql "$SUPABASE" -c "\COPY \"$T\" TO STDOUT WITH (FORMAT binary)" 2>/dev/null | \
    psql "$LOCAL" -c "SET session_replication_role = replica; \COPY \"$T\" FROM STDIN WITH (FORMAT binary)" 2>&1 | \
    grep -E "^COPY|ERROR" | head -1
done

echo ""
echo "=== Final Verification ==="
psql "$LOCAL" -c "SELECT
  (SELECT count(*) FROM \"User\") as users,
  (SELECT count(*) FROM \"Student\") as students,
  (SELECT count(*) FROM \"Supervisor\") as supervisors,
  (SELECT count(*) FROM \"IndependentHour\") as ind_hours,
  (SELECT count(*) FROM \"SupervisionHour\") as sup_hours,
  (SELECT count(*) FROM \"GroupSupervisionSession\") as groups;"
