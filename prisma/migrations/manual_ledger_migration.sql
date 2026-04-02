-- Migration: add_supervisor_ledger_and_ready_to_go_status
-- Generated manually for Supabase direct execution
-- Date: 2026-04-02

-- 1. Add READY_TO_GO to InvoiceStatus enum
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'READY_TO_GO';

-- 2. Create SupervisorLedgerEntry table
CREATE TABLE IF NOT EXISTS "SupervisorLedgerEntry" (
    "id"                           TEXT NOT NULL,
    "invoiceId"                    TEXT NOT NULL,
    "supervisorId"                 TEXT NOT NULL,
    "studentId"                    TEXT NOT NULL,
    "paymentFromStudent"           DECIMAL(10,2) NOT NULL,
    "supervisorCapTotal"           DECIMAL(10,2) NOT NULL,
    "supervisorCapRemainingBefore" DECIMAL(10,2) NOT NULL,
    "supervisorPayout"             DECIMAL(10,2) NOT NULL,
    "officePayout"                 DECIMAL(10,2) NOT NULL,
    "supervisorCapRemainingAfter"  DECIMAL(10,2) NOT NULL,
    "createdAt"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisorLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- 3. Add Foreign Key Constraints
ALTER TABLE "SupervisorLedgerEntry"
    ADD CONSTRAINT "SupervisorLedgerEntry_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupervisorLedgerEntry"
    ADD CONSTRAINT "SupervisorLedgerEntry_supervisorId_fkey"
    FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupervisorLedgerEntry"
    ADD CONSTRAINT "SupervisorLedgerEntry_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS "SupervisorLedgerEntry_invoiceId_idx"
    ON "SupervisorLedgerEntry"("invoiceId");

CREATE INDEX IF NOT EXISTS "SupervisorLedgerEntry_supervisorId_idx"
    ON "SupervisorLedgerEntry"("supervisorId");
