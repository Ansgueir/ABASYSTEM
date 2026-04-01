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

    // Separate states for UI editing
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
            setStreet(initialStreet)
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
            setSuggestions(Array.isArray(data) ? data : [])
            setShowSuggestions(Array.isArray(data) && data.length > 0)
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

    // Crucial: Combines number + road and notifies parent
    const notifyParent = (d: { street: string, number: string, city: string, state: string, zipCode: string, country: string }) => {
        const fullStreet = [d.number, d.street].filter(Boolean).join(" ")
        onAddressChange({
            ...d,
            street: fullStreet, // The parent expects the full address here
            fullAddress: [fullStreet, d.city, d.state, d.zipCode, d.country].filter(Boolean).join(", ")
        })
    }

    function handleSelect(result: any) {
        const addr = result.address || {}
        const parsedStreet = addr.road || addr.pedestrian || addr.neighbourhood || addr.suburb || addr.path || addr.footway || addr.cycleway || addr.square || ""
        const parsedNumber = addr.house_number || ""
        const parsedCity = addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || addr.city_district || addr.county || addr.suburb || ""
        const parsedState = addr.state || addr.region || addr.state_district || ""
        const parsedZip = addr.postcode || ""
        const parsedCountry = addr.country || ""

        setStreet(parsedStreet)
        setNumber(parsedNumber)
        setCity(parsedCity)
        setState(parsedState)
        setZipCode(parsedZip)
        setCountry(parsedCountry)
        setSearchQuery(result.display_name)
        setHasSelected(true)
        setShowSuggestions(false)

        notifyParent({
            street: parsedStreet,
            number: parsedNumber,
            city: parsedCity,
            state: parsedState,
            zipCode: parsedZip,
            country: parsedCountry
        })
    }

    const handleManualChange = (field: string, value: string) => {
        const current = { street, number, city, state, zipCode, country }
        if (field === "street") { setStreet(value); current.street = value }
        if (field === "number") { setNumber(value); current.number = value }
        if (field === "city") { setCity(value); current.city = value }
        if (field === "state") { setState(value); current.state = value }
        if (field === "zipCode") { setZipCode(value); current.zipCode = value }
        if (field === "country") { setCountry(value); current.country = value }
        notifyParent(current)
    }

    const fieldsLocked = !manualMode

    return (
        <div ref={containerRef} className="space-y-6 pt-2">
            {/* SEARCH SECTION */}
            <div className="space-y-3">
                <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                    Search Location
                </Label>
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Type street name..."
                        className="pl-11 h-12 rounded-xl border-gray-200 focus-visible:ring-indigo-500 shadow-sm transition-all text-base"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />}
                    </div>
                    
                    {showSuggestions && (
                        <div className="absolute top-full left-0 right-0 z-[100] mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-300">
                            {suggestions.map((result, idx) => (
                                <button
                                    key={result.place_id || idx}
                                    type="button"
                                    className="w-full text-left px-5 py-4 hover:bg-indigo-50 transition-colors text-sm border-b border-gray-50 last:border-b-0"
                                    onClick={() => handleSelect(result)}
                                >
                                    <div className="font-semibold text-gray-800 line-clamp-1">{result.display_name}</div>
                                    <div className="text-[10px] text-indigo-400 font-bold uppercase mt-1 tracking-wider">{result.type}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* REFINED FIELDS GRID */}
            <div className="grid grid-cols-12 gap-x-4 gap-y-5">
                {/* ROW 1: Number + Street + City */}
                <div className="col-span-12 sm:col-span-2 space-y-2">
                    <Label className="text-xs font-medium text-gray-500 ml-1">Number</Label>
                    <Input
                        value={number}
                        onChange={(e) => handleManualChange("number", e.target.value)}
                        placeholder="6075"
                        className="h-11 border-gray-200 rounded-xl focus:border-indigo-300 transition-all font-medium"
                    />
                </div>
                <div className="col-span-12 sm:col-span-6 space-y-2">
                    <Label className="text-xs font-medium text-gray-500 ml-1">Street / Avenue</Label>
                    <Input
                        value={street}
                        onChange={(e) => handleManualChange("street", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "h-11 bg-gray-50/70 border-gray-100 text-gray-400 cursor-not-allowed" : "h-11 border-gray-200"}
                        placeholder="Street"
                    />
                </div>
                <div className="col-span-12 sm:col-span-4 space-y-2">
                    <Label className="text-xs font-medium text-gray-500 ml-1">City</Label>
                    <Input
                        value={city}
                        onChange={(e) => handleManualChange("city", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "h-11 bg-gray-50/70 border-gray-100 text-gray-400 cursor-not-allowed" : "h-11 border-gray-200"}
                        placeholder="City"
                    />
                </div>

                {/* ROW 2: State + Zip + Country */}
                <div className="col-span-12 sm:col-span-5 space-y-2">
                    <Label className="text-xs font-medium text-gray-500 ml-1">State / Province</Label>
                    <Input
                        value={state}
                        onChange={(e) => handleManualChange("state", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "h-11 bg-gray-50/70 border-gray-100 text-gray-400 cursor-not-allowed" : "h-11 border-gray-200"}
                        placeholder="State"
                    />
                </div>
                <div className="col-span-12 sm:col-span-3 space-y-2">
                    <Label className="text-xs font-medium text-gray-500 ml-1">Zip Code</Label>
                    <Input
                        value={zipCode}
                        onChange={(e) => handleManualChange("zipCode", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "h-11 bg-gray-50/70 border-gray-100 text-gray-400 cursor-not-allowed" : "h-11 border-gray-200"}
                        placeholder="Zip"
                    />
                </div>
                <div className="col-span-12 sm:col-span-4 space-y-2">
                    <Label className="text-xs font-medium text-gray-500 ml-1">Country</Label>
                    <Input
                        value={country}
                        onChange={(e) => handleManualChange("country", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "h-11 bg-gray-50/70 border-gray-100 text-gray-400 cursor-not-allowed" : "h-11 border-gray-200"}
                        placeholder="Country"
                    />
                </div>
            </div>

            {/* CONTROLS & FOOTER */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-50 mt-2">
                <div className="flex items-center gap-2 text-[10px] text-gray-300">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    <span>Powered by OpenStreetMap</span>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-3 text-[11px] text-gray-400 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-lg transition-all gap-2"
                    onClick={() => setManualMode(!manualMode)}
                >
                    <Pencil className="h-3.5 w-3.5" />
                    {manualMode ? "Lock Edits" : "Edit Fields Manually"}
                </Button>
            </div>

            {/* HIDDEN INPUTS */}
            <input type="hidden" name={fieldNames.address} value={[number, street].filter(Boolean).join(" ")} />
            <input type="hidden" name={fieldNames.city} value={city} />
            <input type="hidden" name={fieldNames.state} value={state} />
            {fieldNames.zipCode && <input type="hidden" name={fieldNames.zipCode} value={zipCode} />}
            <input type="hidden" name="address_country" value={country} />
        </div>
    )
}

