"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"

type SearchResult = {
    id: string
    title: string
    subtitle: string
    type: "Student" | "Supervisor" | "Office Team"
    url: string
}

export function GlobalSearch() {
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<SearchResult[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const router = useRouter()
    const containerRef = useRef<HTMLDivElement>(null)

    // Handle clicks outside to close the dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    useEffect(() => {
        if (!query || query.trim().length < 2) {
            setResults([])
            setIsOpen(false)
            return
        }

        const timer = setTimeout(async () => {
            setIsLoading(true)
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
                if (res.ok) {
                    const data = await res.json()
                    setResults(data.results || [])
                    setIsOpen(true)
                }
            } catch (error) {
                console.error("Failed to fetch search results", error)
            } finally {
                setIsLoading(false)
            }
        }, 300) // 300ms debounce

        return () => clearTimeout(timer)
    }, [query])

    const groupedResults = results.reduce((acc, result) => {
        if (!acc[result.type]) acc[result.type] = []
        acc[result.type].push(result)
        return acc
    }, {} as Record<string, SearchResult[]>)

    return (
        <div ref={containerRef} className="relative flex-1 max-w-xl">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search students, supervisors..."
                    className="pl-10 pr-10 bg-background"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => {
                        if (results.length > 0) setIsOpen(true)
                    }}
                />
                {isLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
            </div>

            {isOpen && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-popover/95 backdrop-blur-md border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-[70vh] flex flex-col">
                    <div className="p-2 overflow-y-auto">
                        {Object.entries(groupedResults).map(([type, items]) => (
                            <div key={type} className="mb-4 last:mb-0">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2 mt-1">
                                    {type}s Found
                                </h3>
                                <ul className="space-y-1">
                                    {items.map((item) => (
                                        <li key={item.id}>
                                            <button
                                                onClick={() => {
                                                    router.push(item.url)
                                                    setIsOpen(false)
                                                    setQuery("")
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-muted/50 rounded-md transition-colors flex flex-col gap-0.5"
                                            >
                                                <span className="font-medium text-sm text-foreground">{item.title}</span>
                                                <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isOpen && query.trim().length >= 2 && !isLoading && results.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-xl z-50 p-6 text-center text-muted-foreground">
                    No results found for "{query}"
                </div>
            )}
        </div>
    )
}
