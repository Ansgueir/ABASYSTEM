"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { MapPin, Search, Pencil, Loader2 } from "lucide-react"

interface AddressFields {
    street: string
    city: string
    state: string
    zipCode: string
    fullAddress: string
}

interface AddressAutocompleteProps {
    initialStreet?: string
    initialCity?: string
    initialState?: string
    initialZipCode?: string
    onAddressChange: (fields: AddressFields) => void
    /** Field names for hidden inputs in forms */
    fieldNames?: {
        address?: string
        city?: string
        state?: string
        zipCode?: string
    }
}

export function AddressAutocomplete({
    initialStreet = "",
    initialCity = "",
    initialState = "",
    initialZipCode = "",
    onAddressChange,
    fieldNames = { address: "address", city: "city", state: "state", zipCode: "zipCode" }
}: AddressAutocompleteProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [manualMode, setManualMode] = useState(false)
    const [hasSelected, setHasSelected] = useState(false)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Individual field state
    const [street, setStreet] = useState(initialStreet)
    const [city, setCity] = useState(initialCity)
    const [state, setState] = useState(initialState)
    const [zipCode, setZipCode] = useState(initialZipCode)

    // If we have initial values, consider it selected
    useEffect(() => {
        if (initialStreet || initialCity || initialState) {
            setHasSelected(true)
            setSearchQuery([initialStreet, initialCity, initialState, initialZipCode].filter(Boolean).join(", "))
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Close suggestions on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const fetchSuggestions = useCallback(async (query: string) => {
        if (query.length < 3) {
            setSuggestions([])
            return
        }

        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        if (!token || token === "pk.YOUR_MAPBOX_PUBLIC_TOKEN") {
            // No valid token → fallback to manual
            setManualMode(true)
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
                `access_token=${token}&country=us&types=address&limit=5&language=en`
            )
            const data = await res.json()
            if (data.features) {
                setSuggestions(data.features)
                setShowSuggestions(true)
            }
        } catch (err) {
            console.error("Mapbox fetch error:", err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    function handleSearchChange(value: string) {
        setSearchQuery(value)
        setHasSelected(false)

        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => fetchSuggestions(value), 350)
    }

    function parseMapboxFeature(feature: any): AddressFields {
        const context = feature.context || []
        let parsedStreet = ""
        let parsedCity = ""
        let parsedState = ""
        let parsedZip = ""

        // The place_name has the full address
        const placeName = feature.place_name || ""

        // street = address number + text
        parsedStreet = feature.address
            ? `${feature.address} ${feature.text}`
            : feature.text || ""

        for (const c of context) {
            const id = c.id || ""
            if (id.startsWith("place")) parsedCity = c.text
            else if (id.startsWith("region")) parsedState = c.short_code?.replace("US-", "") || c.text
            else if (id.startsWith("postcode")) parsedZip = c.text
            else if (id.startsWith("locality") && !parsedCity) parsedCity = c.text
        }

        return {
            street: parsedStreet,
            city: parsedCity,
            state: parsedState,
            zipCode: parsedZip,
            fullAddress: placeName
        }
    }

    function handleSelect(feature: any) {
        const parsed = parseMapboxFeature(feature)
        setStreet(parsed.street)
        setCity(parsed.city)
        setState(parsed.state)
        setZipCode(parsed.zipCode)
        setSearchQuery(parsed.fullAddress)
        setHasSelected(true)
        setShowSuggestions(false)
        onAddressChange(parsed)
    }

    function handleManualChange(field: string, value: string) {
        const updated = { street, city, state, zipCode, fullAddress: "" }
        if (field === "street") { setStreet(value); updated.street = value }
        if (field === "city") { setCity(value); updated.city = value }
        if (field === "state") { setState(value); updated.state = value }
        if (field === "zipCode") { setZipCode(value); updated.zipCode = value }
        updated.fullAddress = [updated.street, updated.city, updated.state, updated.zipCode].filter(Boolean).join(", ")
        onAddressChange(updated)
    }

    const fieldsLocked = !manualMode

    return (
        <div ref={containerRef} className="space-y-3">
            {/* Search Input */}
            <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                    Address / Location <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search your address..."
                        className="pl-9 pr-8 rounded-xl"
                    />
                    {isLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-indigo-500" />
                    )}
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full max-w-md bg-white dark:bg-gray-900 border rounded-xl shadow-lg overflow-hidden">
                        {suggestions.map((feat) => (
                            <button
                                key={feat.id}
                                type="button"
                                className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors text-sm flex items-start gap-2 border-b last:border-b-0"
                                onClick={() => handleSelect(feat)}
                            >
                                <MapPin className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{feat.place_name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Parsed Fields (locked by default) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                    <Label htmlFor="addr-street" className="text-xs text-muted-foreground">Street</Label>
                    <Input
                        id="addr-street"
                        value={street}
                        onChange={(e) => handleManualChange("street", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed" : ""}
                        placeholder="Street address"
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="addr-city" className="text-xs text-muted-foreground">City</Label>
                    <Input
                        id="addr-city"
                        value={city}
                        onChange={(e) => handleManualChange("city", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed" : ""}
                        placeholder="City"
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="addr-state" className="text-xs text-muted-foreground">State</Label>
                    <Input
                        id="addr-state"
                        value={state}
                        onChange={(e) => handleManualChange("state", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed" : ""}
                        placeholder="State"
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="addr-zip" className="text-xs text-muted-foreground">Zip Code</Label>
                    <Input
                        id="addr-zip"
                        value={zipCode}
                        onChange={(e) => handleManualChange("zipCode", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed" : ""}
                        placeholder="Zip"
                    />
                </div>
            </div>

            {/* Manual Fallback Toggle */}
            <div className="flex justify-end">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-indigo-600 gap-1.5"
                    onClick={() => setManualMode(!manualMode)}
                >
                    <Pencil className="h-3 w-3" />
                    {manualMode ? "Use address search" : "Enter address manually"}
                </Button>
            </div>

            {/* Hidden form fields for form submission */}
            <input type="hidden" name={fieldNames.address} value={street} />
            <input type="hidden" name={fieldNames.city} value={city} />
            <input type="hidden" name={fieldNames.state} value={state} />
            {fieldNames.zipCode && <input type="hidden" name={fieldNames.zipCode} value={zipCode} />}
        </div>
    )
}
