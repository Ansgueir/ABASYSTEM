import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const studentId = 'a1dc58e0-51f3-4538-8398-4b31e57be0cf'
  console.log(`Fetching raw data for student: ${studentId}...`)

  try {
    const student = await (prisma as any).student.findUnique({
      where: { id: studentId }
    })

    if (!student) {
      console.error('Student not found')
      return
    }

    // Now try to fetch relations individually to see which ones exist
    const relations: any = {}
    
    try { relations.documents = await (prisma as any).document.findMany({ where: { studentId } }) } catch (e) {}
    try { relations.contracts = await (prisma as any).contract.findMany({ where: { studentId } }) } catch (e) {}
    try { relations.independentHours = await (prisma as any).independentHour.findMany({ where: { studentId } }) } catch (e) {}
    try { relations.supervisionHours = await (prisma as any).supervisionHour.findMany({ where: { studentId } }) } catch (e) {}
    try { relations.invoices = await (prisma as any).invoice.findMany({ where: { studentId } }) } catch (e) {}
    
    const fullPayload = { ...student, ...relations }

    console.log('---START_JSON---')
    console.log(JSON.stringify(fullPayload, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value, 2))
    console.log('---END_JSON---')
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
