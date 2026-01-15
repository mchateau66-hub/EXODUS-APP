'use client'

import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'

function ensureLeafletIcons() {
  // @ts-ignore
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

function PickOnMap({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap()
  useEffect(() => {
    onZoom(map.getZoom())
  }, [map, onZoom])

  useMapEvents({
    zoomend() {
      onZoom(map.getZoom())
    },
  })
  return null
}

function Recenterer({
  center,
  zoom,
  recenterNonce,
}: {
  center: [number, number]
  zoom: number
  recenterNonce: number
}) {
  const map = useMap()
  useEffect(() => {
    // recenterNonce sert à forcer un recentrage sur demande
    map.setView(center, zoom, { animate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterNonce])
  return null
}

export default function LeafletPicker({
  center,
  zoom,
  marker,
  recenterNonce,
  onPick,
  onDragEnd,
  onZoom,
}: {
  center: [number, number]
  zoom: number
  marker: { lat: number; lng: number } | null
  recenterNonce: number
  onPick: (lat: number, lng: number) => void
  onDragEnd: (lat: number, lng: number) => void
  onZoom: (z: number) => void
}) {
  useEffect(() => {
    ensureLeafletIcons()
  }, [])

  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full">
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <ZoomWatcher onZoom={onZoom} />
      <PickOnMap onPick={onPick} />

      <Recenterer center={center} zoom={zoom} recenterNonce={recenterNonce} />

      {marker ? (
        <Marker
          position={[marker.lat, marker.lng]}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const m = e.target as L.Marker
              const p = m.getLatLng()
              onDragEnd(p.lat, p.lng)
            },
          }}
        />
      ) : null}
    </MapContainer>
  )
}
