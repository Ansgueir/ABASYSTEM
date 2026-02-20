/*
  Warnings:

  - The values [GENERATED] on the enum `ContractStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `contractUrl` on the `Contract` table. All the data in the column will be lost.
  - You are about to drop the column `signedAt` on the `Contract` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Contract` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ContractStatus_new" AS ENUM ('DRAFT', 'ACTIVE', 'SENT', 'SIGNED');
ALTER TABLE "Contract" ALTER COLUMN "status" TYPE "ContractStatus_new" USING ("status"::text::"ContractStatus_new");
ALTER TYPE "ContractStatus" RENAME TO "ContractStatus_old";
ALTER TYPE "ContractStatus_new" RENAME TO "ContractStatus";
DROP TYPE "ContractStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "Contract" DROP COLUMN "contractUrl",
DROP COLUMN "signedAt",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "GeneralValues" ADD COLUMN     "companyWebsite" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ContractSupervisor" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "isMainSupervisor" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ContractSupervisor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractSupervisor_contractId_supervisorId_key" ON "ContractSupervisor"("contractId", "supervisorId");

-- AddForeignKey
ALTER TABLE "ContractSupervisor" ADD CONSTRAINT "ContractSupervisor_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractSupervisor" ADD CONSTRAINT "ContractSupervisor_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
