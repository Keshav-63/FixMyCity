'use client'

import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { createClient } from '@/lib/supabase/client'
import type { Complaint } from '@/lib/types'
import { CATEGORY_CONFIG } from '@/lib/types'
import { ComplaintCard } from '@/components/complaint/complaint-card'

// Create custom marker icons for each category
function createCategoryIcon(category: string): L.DivIcon {
  const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.other
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${config.color};
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

// Component to handle location tracking
function LocationMarker({ 
  onLocationFound 
}: { 
  onLocationFound: (lat: number, lng: number) => void 
}) {
  const map = useMap()

  useEffect(() => {
    map.locate({ setView: true, maxZoom: 15 })
    
    map.on('locationfound', (e) => {
      onLocationFound(e.latlng.lat, e.latlng.lng)
    })

    map.on('locationerror', () => {
      // Default to a central location if geolocation fails
      map.setView([40.7128, -74.0060], 13)
    })
  }, [map, onLocationFound])

  return null
}

// Component to handle click events for adding new complaints
function MapClickHandler({ 
  onMapClick,
  isSelecting
}: { 
  onMapClick: (lat: number, lng: number) => void
  isSelecting: boolean
}) {
  useMapEvents({
    click: (e) => {
      if (isSelecting) {
        onMapClick(e.latlng.lat, e.latlng.lng)
      }
    },
  })
  return null
}

interface IssueMapProps {
  complaints: Complaint[]
  onComplaintClick?: (complaint: Complaint) => void
  onMapClick?: (lat: number, lng: number) => void
  isSelectingLocation?: boolean
  selectedLocation?: { lat: number; lng: number } | null
  onLocationFound?: (lat: number, lng: number) => void
}

export function IssueMap({ 
  complaints, 
  onComplaintClick,
  onMapClick,
  isSelectingLocation = false,
  selectedLocation,
  onLocationFound,
}: IssueMapProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

  const handleLocationFound = useCallback((lat: number, lng: number) => {
    setUserLocation({ lat, lng })
    onLocationFound?.(lat, lng)
  }, [onLocationFound])

  const handleMapClick = useCallback((lat: number, lng: number) => {
    onMapClick?.(lat, lng)
  }, [onMapClick])

  // User location marker icon
  const userIcon = L.divIcon({
    className: 'user-marker',
    html: `<div style="
      background-color: #3B82F6;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 0 3px rgba(59,130,246,0.3), 0 2px 4px rgba(0,0,0,0.2);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })

  // Selected location marker
  const selectedIcon = L.divIcon({
    className: 'selected-marker',
    html: `<div style="
      background-color: #10B981;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 0 3px rgba(16,185,129,0.3), 0 2px 8px rgba(0,0,0,0.3);
      animation: pulse 1.5s infinite;
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

  return (
    <div className="relative h-full w-full">
      {isSelectingLocation && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium shadow-lg">
          Click on the map to select location
        </div>
      )}
      <MapContainer
        center={[40.7128, -74.0060]}
        zoom={13}
        className="h-full w-full z-0"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <LocationMarker onLocationFound={handleLocationFound} />
        <MapClickHandler onMapClick={handleMapClick} isSelecting={isSelectingLocation} />

        {/* User location marker */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>Your location</Popup>
          </Marker>
        )}

        {/* Selected location for new complaint */}
        {selectedLocation && (
          <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={selectedIcon}>
            <Popup>New issue location</Popup>
          </Marker>
        )}

        {/* Complaint markers */}
        {complaints.map((complaint) => (
          <Marker
            key={complaint.id}
            position={[complaint.latitude, complaint.longitude]}
            icon={createCategoryIcon(complaint.category)}
            eventHandlers={{
              click: () => onComplaintClick?.(complaint),
            }}
          >
            <Popup maxWidth={350} minWidth={300}>
              <ComplaintCard complaint={complaint} isPopup />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
