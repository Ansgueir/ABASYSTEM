/**
 * Serialization helpers to safely convert Prisma result objects (which may contain
 * Decimal, Date, BigInt) into plain JS objects safe to pass to Client Components.
 *
 * Two-pass approach:
 *   1. Explicit type handling (BigInt, Decimal, Date, Array, plain object)
 *   2. Final JSON round-trip as bulletproof fallback — eliminates any residual
 *      non-serializable objects (e.g. Prisma Decimal variants, custom Date-like
 *      objects with {month, year} shape) that manual checks might miss.
 */

/** Recursively converts Decimal/Date/BigInt to JSON-safe primitives */
function _serialize<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj
    if (typeof obj === "bigint") return Number(obj) as unknown as T
    // Prisma Decimal – has toNumber() method
    if (typeof obj === "object" && obj !== null && typeof (obj as any).toNumber === "function") {
        return Number((obj as any).toNumber()) as unknown as T
    }
    if (obj instanceof Date) return obj.toISOString() as unknown as T
    if (Array.isArray(obj)) return obj.map(_serialize) as unknown as T
    if (typeof obj === "object" && obj !== null) {
        const result: any = {}
        for (const key of Object.keys(obj as any)) {
            result[key] = _serialize((obj as any)[key])
        }
        return result as T
    }
    return obj
}

export function serialize<T>(obj: T): T {
    try {
        const firstPass = _serialize(obj)
        // Second pass: JSON round-trip catches any remaining non-serializable values
        return JSON.parse(JSON.stringify(firstPass))
    } catch {
        // If JSON.stringify fails, return the first pass as-is
        return _serialize(obj)
    }
}
