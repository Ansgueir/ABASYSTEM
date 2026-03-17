"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"

export default function ReproduceCrash() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // THIS IS THE POISON PAYLOAD FROM PRODUCTION
  const safeStudent = {
    "id": "a1dc58e0-51f3-4538-8398-4b31e57be0cf",
    "userId": "b4d65204-ff69-4d44-89ed-31c4662110ad",
    "fullName": "Ailin Yisel Garcia",
    "paymentAlias": null,
    "supervisorId": "9713b707-8b69-4788-ab6c-753764012c9c",
    "bacbId": "667022",
    "credential": "NO_CREDENTIAL",
    "school": "Imported",
    "level": "BCBA",
    "phone": "",
    "email": "ailngarcia@aol.com",
    "city": "N/A",
    "state": "FL",
    "startDate": "2024-01-08T00:00:00.000Z",
    "supervisionType": "REGULAR",
    "supervisionPercentage": 0.05,
    "hoursToDo": 130,
    "hoursToPay": 0,
    "amountToPay": 0,
    "hoursPerMonth": 130,
    "totalMonths": 0,
    "endDate": "2027-03-14T23:09:03.139Z",
    "status": "ACTIVE",
    "availableDaysGroup": null,
    "notes": null,
    "createdAt": "2026-03-14T23:09:03.141Z",
    "updatedAt": "2026-03-14T23:09:03.141Z",
    "academicDegree": null,
    "contractStartDate": null,
    "address": "",
    "fieldworkType": "REGULAR",
    "hourlyRate": 0,
    "analystPaymentRate": null,
    "assignedOptionPlan": "A",
    "concentratedHoursTarget": null,
    "independentHoursTarget": null,
    "internalComments": null,
    "officePaymentRate": null,
    "regularHoursTarget": null,
    "totalAmountContract": null,
    "vcsSequence": "FNU",
    "importBatchId": "5c0e4c88-5d64-4216-b0cd-cb19744c3bc5",
    "documents": [],
    "contracts": [],
    "independentHours": [],
    "supervisionHours": [],
    "invoices": [],
    "financialPeriods": []
  }

  if (!mounted) return <div>Loading reproduction...</div>

  return (
    <div className="p-8">
      <h1>Reproducing Crash for {safeStudent.fullName}</h1>
      
      {/* Test 1: paymentAlias.map */}
      <div className="mt-4 border p-4">
        <h3>Test 1: paymentAlias.map (Potential Poison)</h3>
        {/* If the real code does this, it will crash here if paymentAlias is null */}
        {/* {safeStudent.paymentAlias.map((a: any) => <div key={a}>{a}</div>)} */}
        {safeStudent.paymentAlias ? safeStudent.paymentAlias.map((a: any) => <div key={a}>{a}</div>) : "null alias"}
      </div>

      {/* Test 2: date-fns formatting on empty strings or weird dates */}
      <div className="mt-4 border p-4">
        <h3>Test 2: Date Formatting</h3>
        <p>Start Date: {format(new Date(safeStudent.startDate), "MMM d, yyyy")}</p>
        <p>End Date: {format(new Date(safeStudent.endDate), "MMM d, yyyy")}</p>
        {/* What if contractStartDate is null? */}
        <p>Contract Start Date: {safeStudent.contractStartDate ? format(new Date(safeStudent.contractStartDate), "MMM d, yyyy") : "N/A"}</p>
      </div>

      {/* Test 4: Spread operator on null (STAMPED AS POISON PILL) */}
      <div className="mt-4 border p-4 bg-red-50">
        <h3>Test 4: Array Spread (Potential Fatal Crash)</h3>
        {/* [...safeStudent.supervisionHours] would crash if it's null */}
        <p>This will crash if I don't guard it: {
            (() => {
                try {
                    const supervisionHours = null as any;
                    const independentHours = null as any;
                    // @ts-ignore
                    const all = [...supervisionHours, ...independentHours];
                    return "Spread worked (should not happen for null)";
                } catch (e) {
                    return `CRASHED: ${e}`;
                }
            })()
        }</p>
      </div>
    </div>
  )
}
