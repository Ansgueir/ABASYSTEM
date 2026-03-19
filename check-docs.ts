
import { prisma } from "./src/lib/prisma"

async function main() {
    const docs = await prisma.document.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    })
    console.log(JSON.stringify(docs, null, 2))
}

main()
