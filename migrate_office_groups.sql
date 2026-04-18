-- CreateTable OfficeGroup + OfficeGroupSupervisor
-- Migration: add_office_groups

CREATE TABLE IF NOT EXISTS "OfficeGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupType" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OfficeGroup_groupType_dayOfWeek_key" ON "OfficeGroup"("groupType", "dayOfWeek");

CREATE TABLE IF NOT EXISTS "OfficeGroupSupervisor" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeGroupSupervisor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OfficeGroupSupervisor_groupId_supervisorId_key" ON "OfficeGroupSupervisor"("groupId", "supervisorId");
CREATE INDEX IF NOT EXISTS "OfficeGroupSupervisor_groupId_idx" ON "OfficeGroupSupervisor"("groupId");
CREATE INDEX IF NOT EXISTS "OfficeGroupSupervisor_supervisorId_idx" ON "OfficeGroupSupervisor"("supervisorId");

ALTER TABLE "OfficeGroupSupervisor" ADD CONSTRAINT "OfficeGroupSupervisor_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "OfficeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfficeGroupSupervisor" ADD CONSTRAINT "OfficeGroupSupervisor_supervisorId_fkey"
  FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add updatedAt trigger for OfficeGroup
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_office_group_updated_at ON "OfficeGroup";
CREATE TRIGGER set_office_group_updated_at
  BEFORE UPDATE ON "OfficeGroup"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
