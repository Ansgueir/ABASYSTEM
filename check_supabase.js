const { PrismaClient } = require('@prisma/client')

const supabase = new PrismaClient({
    datasources: { db: { url: "postgresql://postgres.svvxhmhkghauhnvqcgbi:Pr0s1s.2026@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require" } }
})

supabase.user.count()
    .then(n => { console.log("Users in Supabase:", n); supabase.$disconnect() })
    .catch(e => { console.error("ERROR:", e.message); supabase.$disconnect() })
