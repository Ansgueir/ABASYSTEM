/**
 * Serialization helpers to safely convert Prisma result objects (which may contain
 * Decimal, Date, BigInt) into plain JS objects safe to pass to Client Components.
 */

/** Recursively converts Decimal/Date/BigInt to JSON-safe primitives */
export function serialize<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj
    if (typeof obj === "bigint") return Number(obj) as unknown as T
    if (typeof obj === "object" && "toNumber" in (obj as any)) {
        // Prisma Decimal
        return Number((obj as any).toNumber()) as unknown as T
    }
    if (obj instanceof Date) return obj.toISOString() as unknown as T
    if (Array.isArray(obj)) return obj.map(serialize) as unknown as T
    if (typeof obj === "object") {
        const result: any = {}
        for (const key in obj as any) {
            result[key] = serialize((obj as any)[key])
        }
        return result as T
    }
    return obj
}
