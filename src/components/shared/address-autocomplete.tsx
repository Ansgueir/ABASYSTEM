"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { MapPin, Search, Pencil, Loader2 } from "lucide-react"

interface AddressFields {
    street: string
    number: string
    city: string
    state: string
    zipCode: string
    country: string
    fullAddress: string
}

interface AddressAutocompleteProps {
    initialStreet?: string
    initialCity?: string
    initialState?: string
    initialZipCode?: string
    onAddressChange: (fields: AddressFields) => void
    fieldNames?: {
        address?: string
        city?: string
        state?: string
        zipCode?: string
    }
}

const USER_AGENT = "ABA-System-App/1.0 (admin@abasupervision.com)"
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

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

    const [street, setStreet] = useState(initialStreet)
    const [number, setNumber] = useState("")
    const [city, setCity] = useState(initialCity)
    const [state, setState] = useState(initialState)
    const [zipCode, setZipCode] = useState(initialZipCode)
    const [country, setCountry] = useState("")

    useEffect(() => {
        if (initialStreet || initialCity || initialState) {
            setHasSelected(true)
            setSearchQuery([initialStreet, initialCity, initialState, initialZipCode].filter(Boolean).join(", "))
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
            setShowSuggestions(false)
            return
        }

        setIsLoading(true)
        try {
            const params = new URLSearchParams({
                format: "json",
                addressdetails: "1",
                q: query,
                limit: "10",
                namedetails: "1",
                extratags: "1"
            })

            const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
                headers: { "User-Agent": USER_AGENT }
            })

            if (!res.ok) throw new Error("Nominatim request failed")

            const data = await res.json()
            if (Array.isArray(data) && data.length > 0) {
                setSuggestions(data)
                setShowSuggestions(true)
            } else {
                setSuggestions([])
                setShowSuggestions(false)
            }
        } catch (err) {
            console.error("Nominatim fetch error:", err)
            setSuggestions([])
        } finally {
            setIsLoading(false)
        }
    }, [])

    function handleSearchChange(value: string) {
        setSearchQuery(value)
        setHasSelected(false)

        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => fetchSuggestions(value), 1000)
    }

    function parseNominatimResult(result: any): AddressFields {
        const addr = result.address || {}

        // Road: neighbourhood/suburb as fallback if road is missing
        const parsedStreet = addr.road || addr.pedestrian || addr.neighbourhood || addr.suburb || addr.path || addr.footway || addr.cycleway || addr.square || ""
        const parsedNumber = addr.house_number || ""

        // City: different countries use different fields
        const parsedCity = addr.city || addr.town || addr.village || addr.hamlet 
            || addr.municipality || addr.city_district || addr.county 
            || addr.suburb || ""

        // State/Region
        const parsedState = addr.state || addr.region || addr.state_district || ""

        // Zip/Postcode
        const parsedZip = addr.postcode || ""

        // Country
        const parsedCountry = addr.country || ""

        const fullAddress = result.display_name || ""

        return {
            street: parsedStreet,
            number: parsedNumber,
            city: parsedCity,
            state: parsedState,
            zipCode: parsedZip,
            country: parsedCountry,
            fullAddress
        }
    }

    function handleSelect(result: any) {
        const parsed = parseNominatimResult(result)
        setStreet(parsed.street)
        setNumber(parsed.number)
        setCity(parsed.city)
        setState(parsed.state)
        setZipCode(parsed.zipCode)
        setCountry(parsed.country)
        setSearchQuery(parsed.fullAddress)
        setHasSelected(true)
        setShowSuggestions(false)
        onAddressChange(parsed)
    }

    function handleManualChange(field: string, value: string) {
        const updated = { street, number, city, state, zipCode, country, fullAddress: "" }
        if (field === "street") { setStreet(value); updated.street = value }
        if (field === "number") { setNumber(value); updated.number = value }
        if (field === "city") { setCity(value); updated.city = value }
        if (field === "state") { setState(value); updated.state = value }
        if (field === "zipCode") { setZipCode(value); updated.zipCode = value }
        if (field === "country") { setCountry(value); updated.country = value }
        updated.fullAddress = [updated.number, updated.street, updated.city, updated.state, updated.zipCode, updated.country].filter(Boolean).join(", ")
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

                {showSuggestions && suggestions.length > 0 && (
                    <div className="relative z-[9999]">
                        <div
                            className="absolute top-0 left-0 right-0 rounded-xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto border border-gray-200"
                            style={{ backgroundColor: "#ffffff" }}
                        >
                            {suggestions.map((result, idx) => (
                                <button
                                    key={result.place_id || idx}
                                    type="button"
                                    className="w-full text-left px-4 py-3 transition-colors text-sm flex items-start gap-2.5 border-b border-gray-100 last:border-b-0"
                                    style={{ color: "#1f2937" }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#eef2ff" }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#ffffff" }}
                                    onClick={() => handleSelect(result)}
                                >
                                    <MapPin className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                                    <span className="line-clamp-2 leading-snug">{result.display_name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Parsed Fields (locked by default) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-2 space-y-1">
                    <Label htmlFor="addr-street" className="text-xs text-muted-foreground">Street / Road</Label>
                    <Input
                        id="addr-street"
                        value={street}
                        onChange={(e) => handleManualChange("street", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed" : ""}
                        placeholder="Street name"
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="addr-number" className="text-xs text-muted-foreground">Number / Unit <span className="text-red-500">*</span></Label>
                    <Input
                        id="addr-number"
                        value={number}
                        onChange={(e) => handleManualChange("number", e.target.value)}
                        placeholder="e.g. 6075"
                        className="border-indigo-200 focus-visible:ring-indigo-500"
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
                <div className="space-y-1">
                    <Label htmlFor="addr-country" className="text-xs text-muted-foreground">Country</Label>
                    <Input
                        id="addr-country"
                        value={country}
                        onChange={(e) => handleManualChange("country", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed" : ""}
                        placeholder="Country"
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

            {/* Hidden form fields */}
            <input type="hidden" name={fieldNames.address} value={[number, street].filter(Boolean).join(" ")} />
            <input type="hidden" name={fieldNames.city} value={city} />
            <input type="hidden" name={fieldNames.state} value={state} />
            {fieldNames.zipCode && <input type="hidden" name={fieldNames.zipCode} value={zipCode} />}
            <input type="hidden" name="address_country" value={country} />
        </div>
    )
}
