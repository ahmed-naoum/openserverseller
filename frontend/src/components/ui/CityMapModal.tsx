import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, Check, AlertTriangle, Loader2, Save } from 'lucide-react';

/**
 * Confirmation step between picking a city and committing it.
 *
 * Cities in Morocco share names across provinces and arrive from carriers and
 * webhooks with inconsistent spelling, so an agent can pick the wrong one
 * without noticing until the parcel is already out. Showing the actual location
 * on a map turns that into a one-glance check.
 *
 * Tiles come from OpenStreetMap and the library is Leaflet — both open source,
 * no API key, no per-request billing.
 */

/**
 * Leaflet resolves its default marker icons against a bundler-relative URL that
 * Vite rewrites, so the stock pin 404s. An inline SVG marker avoids the asset
 * pipeline entirely and keeps the modal self-contained.
 */
const pinIcon = (color: string) =>
  L.divIcon({
    className: 'city-map-pin',
    html: `
      <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26C32 7.163 24.837 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="16" r="6" fill="#fff"/>
      </svg>`,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  });

export interface CityMapTarget {
  id?: number | null;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  region?: string | null;
  hubName?: string | null;
  isDeliverable?: boolean;
}

interface CityMapModalProps {
  open: boolean;
  city: CityMapTarget | null;
  /** Confirms the city; receives corrected coordinates when the pin was moved. */
  onConfirm: (city: CityMapTarget) => void;
  /** Dismisses without committing, so the caller keeps the previous value. */
  onCancel: () => void;
  /** Enables the draggable pin. Wired to SUPER_ADMIN by CitySelect. */
  canEdit?: boolean;
  /** Persists a corrected position; resolves to the saved coordinates. */
  onSaveCoordinates?: (cityId: number, latitude: number, longitude: number) => Promise<void>;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function CityMapModal({
  open,
  city,
  onConfirm,
  onCancel,
  canEdit = false,
  onSaveCoordinates,
  confirmLabel = 'Confirmer cette localisation',
  cancelLabel = 'Choisir une autre ville',
}: CityMapModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [draggedTo, setDraggedTo] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasCoordinates =
    typeof city?.latitude === 'number' && typeof city?.longitude === 'number';

  // A fresh city means any pending correction from the previous one is stale.
  useEffect(() => {
    setDraggedTo(null);
    setSaveError(null);
  }, [city?.id, city?.name]);

  useEffect(() => {
    if (!open || !hasCoordinates || !containerRef.current) return;

    const lat = city!.latitude as number;
    const lng = city!.longitude as number;

    // The container is measured on creation, and it is still zero-sized while
    // the modal plays its open transition — hence invalidateSize below.
    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 12,
      scrollWheelZoom: true,
      attributionControl: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const marker = L.marker([lat, lng], {
      icon: pinIcon(city?.isDeliverable === false ? '#f59e0b' : '#4f46e5'),
      draggable: canEdit,
      keyboard: canEdit,
    }).addTo(map);

    if (canEdit) {
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setDraggedTo({ lat: pos.lat, lng: pos.lng });
        setSaveError(null);
      });
    }

    mapRef.current = map;
    markerRef.current = marker;

    const timer = window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [open, hasCoordinates, city?.id, city?.name, city?.latitude, city?.longitude, canEdit, city?.isDeliverable]);

  // Escape closes without committing, matching the Cancel button.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open || !city) return null;

  const effective = draggedTo
    ? { latitude: draggedTo.lat, longitude: draggedTo.lng }
    : { latitude: city.latitude, longitude: city.longitude };

  const handleSaveCorrection = async () => {
    if (!draggedTo || !city.id || !onSaveCoordinates) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSaveCoordinates(city.id, draggedTo.lat, draggedTo.lng);
      setDraggedTo(null);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={`Localisation de ${city.name}`}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
              <h3 className="text-base font-bold text-gray-900 truncate">{city.name}</h3>
            </div>
            <p className="mt-0.5 text-xs font-semibold text-gray-500 truncate">
              {[city.region, city.hubName].filter(Boolean).join(' · ') || 'Vérifiez la position sur la carte'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {city.isDeliverable === false && (
          <div className="flex items-start gap-2 px-5 py-2.5 bg-amber-50 border-b border-amber-100">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs font-semibold text-amber-700">
              Cette ville n'est pas desservie par Coliaty. La commande devra être livrée autrement.
            </p>
          </div>
        )}

        {hasCoordinates ? (
          <div ref={containerRef} className="h-[340px] w-full bg-gray-100" />
        ) : (
          <div className="h-[340px] w-full bg-gray-50 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <AlertTriangle className="w-7 h-7 text-gray-300" />
            <p className="text-sm font-bold text-gray-600">Position inconnue</p>
            <p className="text-xs font-medium text-gray-400 max-w-xs">
              Aucune coordonnée enregistrée pour cette ville. Vous pouvez continuer, mais la
              position ne peut pas être vérifiée.
            </p>
          </div>
        )}

        <div className="px-5 py-3 border-t border-gray-100 space-y-3">
          {hasCoordinates && (
            <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-gray-400">
              <span>
                {Number(effective.latitude).toFixed(5)}, {Number(effective.longitude).toFixed(5)}
              </span>
              {canEdit && (
                <span className="text-gray-400">
                  {draggedTo ? 'Position modifiée — pensez à enregistrer' : 'Glissez le repère pour corriger'}
                </span>
              )}
            </div>
          )}

          {saveError && <p className="text-xs font-semibold text-red-600">{saveError}</p>}

          {canEdit && draggedTo && city.id && (
            <button
              type="button"
              onClick={handleSaveCorrection}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer la position corrigée
            </button>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => onConfirm({ ...city, ...effective })}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
