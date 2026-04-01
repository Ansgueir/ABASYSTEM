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
        <div ref={containerRef} className="space-y-4">
            <div className="space-y-2">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">
                    Search your location
                </Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search address..."
                        className="pl-9 h-10 rounded-lg border-gray-200"
                    />
                    {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-indigo-500" />}
                    
                    {showSuggestions && (
                        <div className="absolute top-full left-0 right-0 z-[100] mt-1 bg-white border rounded-xl shadow-xl overflow-hidden max-h-[250px] overflow-y-auto">
                            {suggestions.map((result, idx) => (
                                <button
                                    key={result.place_id || idx}
                                    type="button"
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors text-sm border-b last:border-b-0"
                                    onClick={() => handleSelect(result)}
                                >
                                    <div className="font-medium text-gray-900">{result.display_name}</div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase">{result.type}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-6 gap-3">
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Number</Label>
                    <Input
                        value={number}
                        onChange={(e) => handleManualChange("number", e.target.value)}
                        placeholder="6075"
                        className="h-9 border-gray-200"
                    />
                </div>
                <div className="col-span-4 sm:col-span-3 space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Street</Label>
                    <Input
                        value={street}
                        onChange={(e) => handleManualChange("street", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "h-9 bg-gray-50/50" : "h-9"}
                        placeholder="Street"
                    />
                </div>
                <div className="col-span-3 sm:col-span-2 space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">City</Label>
                    <Input
                        value={city}
                        onChange={(e) => handleManualChange("city", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "h-9 bg-gray-50/50" : "h-9"}
                    />
                </div>
                <div className="col-span-2 space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">State</Label>
                    <Input
                        value={state}
                        onChange={(e) => handleManualChange("state", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "h-9 bg-gray-50/50" : "h-9"}
                    />
                </div>
                <div className="col-span-2 space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Zip</Label>
                    <Input
                        value={zipCode}
                        onChange={(e) => handleManualChange("zipCode", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "h-9 bg-gray-50/50" : "h-9"}
                    />
                </div>
                <div className="col-span-2 space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Country</Label>
                    <Input
                        value={country}
                        onChange={(e) => handleManualChange("country", e.target.value)}
                        disabled={fieldsLocked}
                        className={fieldsLocked ? "h-9 bg-gray-50/50" : "h-9"}
                    />
                </div>
            </div>

            <div className="flex justify-between items-center pt-1">
                <span className="text-[10px] text-gray-400 italic">Nominatim OSM</span>
                <Button
                    type="button"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] text-gray-500 hover:text-indigo-600 gap-1.5"
                    onClick={() => setManualMode(!manualMode)}
                >
                    <Pencil className="h-3 w-3" />
                    {manualMode ? "Lock manual editing" : "Edit all fields"}
                </Button>
            </div>

            <input type="hidden" name={fieldNames.address} value={[number, street].filter(Boolean).join(" ")} />
            <input type="hidden" name={fieldNames.city} value={city} />
            <input type="hidden" name={fieldNames.state} value={state} />
            {fieldNames.zipCode && <input type="hidden" name={fieldNames.zipCode} value={zipCode} />}
            <input type="hidden" name="address_country" value={country} />
        </div>
    )
}
