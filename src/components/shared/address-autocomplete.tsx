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
        <div ref={containerRef} className="space-y-4 p-4 border-2 border-indigo-50 rounded-2xl bg-indigo-50/10">
            {/* SEARCH SECTION */}
            <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-indigo-700 font-bold">
                    <Search className="h-4 w-4" />
                    1. Search for Street / Avenida / Calle
                </Label>
                <div className="relative">
                    <Input
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Type street name (e.g. Avenida Pablo Neruda)..."
                        className="pl-4 pr-10 h-12 rounded-xl border-indigo-100 focus-visible:ring-indigo-500 shadow-sm"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                        ) : (
                            <MapPin className="h-5 w-5 text-indigo-300" />
                        )}
                    </div>

                    {/* Suggestions Dropdown - Positioned absolute but avoiding overlap */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-[9999] mt-2">
                            <div
                                className="bg-white rounded-xl shadow-2xl border border-indigo-100 overflow-hidden max-h-[250px] overflow-y-auto"
                            >
                                {suggestions.map((result, idx) => (
                                    <button
                                        key={result.place_id || idx}
                                        type="button"
                                        className="w-full text-left px-4 py-3 transition-colors text-sm flex items-start gap-3 border-b border-gray-50 last:border-b-0 hover:bg-indigo-50"
                                        style={{ color: "#1f2937" }}
                                        onClick={() => handleSelect(result)}
                                    >
                                        <MapPin className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                                        <div className="flex flex-col">
                                            <span className="font-medium">{result.display_name}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">{result.type}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MANUAL REFINEMENT SECTION */}
            <div className="pt-2 border-t border-indigo-100">
                <p className="text-[11px] font-bold text-indigo-600 uppercase mb-3 tracking-wider">2. Refine Address Details</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* HOUSE NUMBER - ALWAYS EDITABLE */}
                    <div className="col-span-2 sm:col-span-1 space-y-1.5">
                        <Label htmlFor="addr-number" className="text-xs font-semibold text-indigo-900 leading-none">
                            Number / Casa #
                        </Label>
                        <Input
                            id="addr-number"
                            value={number}
                            onChange={(e) => handleManualChange("number", e.target.value)}
                            placeholder="6075"
                            className="h-10 border-indigo-300 bg-indigo-50/50 focus-visible:ring-indigo-600 font-bold text-indigo-900"
                        />
                    </div>

                    {/* STREET - AUTO-FILLED */}
                    <div className="col-span-2 sm:col-span-3 space-y-1.5">
                        <Label htmlFor="addr-street" className="text-xs text-muted-foreground leading-none">Street name</Label>
                        <Input
                            id="addr-street"
                            value={street}
                            onChange={(e) => handleManualChange("street", e.target.value)}
                            disabled={fieldsLocked}
                            className={fieldsLocked ? "h-10 bg-gray-50 cursor-not-allowed text-gray-500" : "h-10 border-indigo-100"}
                            placeholder="Street"
                        />
                    </div>

                    {/* CITY, STATE, COUNTRY */}
                    <div className="space-y-1.5">
                        <Label htmlFor="addr-city" className="text-xs text-muted-foreground leading-none">City</Label>
                        <Input
                            id="addr-city"
                            value={city}
                            onChange={(e) => handleManualChange("city", e.target.value)}
                            disabled={fieldsLocked}
                            className={fieldsLocked ? "h-10 bg-gray-50 cursor-not-allowed" : "h-10"}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="addr-state" className="text-xs text-muted-foreground leading-none">State/Region</Label>
                        <Input
                            id="addr-state"
                            value={state}
                            onChange={(e) => handleManualChange("state", e.target.value)}
                            disabled={fieldsLocked}
                            className={fieldsLocked ? "h-10 bg-gray-50 cursor-not-allowed" : "h-10"}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="addr-zip" className="text-xs text-muted-foreground leading-none">Zip Code</Label>
                        <Input
                            id="addr-zip"
                            value={zipCode}
                            onChange={(e) => handleManualChange("zipCode", e.target.value)}
                            disabled={fieldsLocked}
                            className={fieldsLocked ? "h-10 bg-gray-50 cursor-not-allowed" : "h-10"}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="addr-country" className="text-xs text-muted-foreground leading-none">Country</Label>
                        <Input
                            id="addr-country"
                            value={country}
                            onChange={(e) => handleManualChange("country", e.target.value)}
                            disabled={fieldsLocked}
                            className={fieldsLocked ? "h-10 bg-gray-50 cursor-not-allowed" : "h-10"}
                        />
                    </div>
                </div>
            </div>

            {/* Manual Fallback Toggle */}
            <div className="flex justify-between items-center pt-2">
                <p className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">
                    Result provided by OpenStreetMap
                </p>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1"
                    onClick={() => setManualMode(!manualMode)}
                >
                    <Pencil className="h-3 w-3" />
                    {manualMode ? "Back to Search" : "Edit all fields manually"}
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
