import React, { useCallback, useMemo, useState } from 'react';
import { MapPin, AlertTriangle } from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import { CityMapModal, CityMapTarget } from './CityMapModal';
import { useCities, City } from '../../hooks/useCities';
import { useAuth } from '../../contexts/AuthContext';
import { citiesApi } from '../../lib/api';

/**
 * The city input used across the platform: search, pick, then confirm the
 * location on a map before the value is committed.
 *
 * The map step exists because picking the wrong city is both easy and expensive
 * — Moroccan localities repeat names across provinces, and a misrouted parcel is
 * only discovered after the courier has it. Nothing reaches the form until the
 * operator has seen where the city actually is.
 *
 * Values are exchanged as plain city-name strings so this drops into the
 * existing forms, all of which store `city` as text and send it to Coliaty
 * verbatim.
 */

interface CitySelectProps {
  value: string;
  onChange: (cityName: string, city: City | null) => void;
  /** Restricts the list to cities Coliaty ships to. Dispatch screens set this. */
  deliverableOnly?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: boolean;
  theme?: 'classic' | 'girly' | 'princess';
  /** Shows the hub next to each option — useful when routing parcels. */
  showHub?: boolean;
  /**
   * Skips the map confirmation. Only for filter dropdowns, where picking a city
   * narrows a list rather than deciding where a parcel goes.
   */
  skipConfirmation?: boolean;
  icon?: React.ReactNode;
}

export function CitySelect({
  value,
  onChange,
  deliverableOnly = false,
  placeholder = 'Sélectionnez une ville...',
  searchPlaceholder = 'Rechercher une ville...',
  disabled = false,
  error = false,
  theme = 'classic',
  showHub = false,
  skipConfirmation = false,
  icon,
}: CitySelectProps) {
  const { cities, loading, resolve, refresh } = useCities({ deliverableOnly });
  const { user } = useAuth();
  const [pending, setPending] = useState<City | null>(null);

  const canEdit = user?.role === 'SUPER_ADMIN';

  const options = useMemo(
    () =>
      cities.map((city) => ({
        value: city.name,
        label: showHub && city.hubName ? `${city.name} (${city.hubName})` : city.name,
        // Without this the hub name is searchable too, so typing "agadir"
        // surfaces every city in the Agadir hub instead of Agadir itself.
        searchText: city.name,
      })),
    [cities, showHub]
  );

  /**
   * A stored city that is not in the catalogue — an old lead, or a value typed
   * before this table existed — still has to be selectable, otherwise editing
   * anything else on the record silently wipes the city.
   */
  const optionsWithCurrent = useMemo(() => {
    if (!value || options.some((o) => o.value === value)) return options;
    return [{ value, label: `${value} (non répertoriée)`, searchText: value }, ...options];
  }, [options, value]);

  const selected = useMemo(() => (value ? resolve(value) : null), [value, resolve]);

  const handleSelect = useCallback(
    (next: string | number) => {
      const name = String(next);
      const city = resolve(name);

      if (skipConfirmation || !city) {
        onChange(name, city);
        return;
      }

      setPending(city);
    },
    [resolve, onChange, skipConfirmation]
  );

  const handleConfirm = useCallback(
    (confirmed: CityMapTarget) => {
      onChange(confirmed.name, pending);
      setPending(null);
    },
    [onChange, pending]
  );

  const handleSaveCoordinates = useCallback(
    async (cityId: number, latitude: number, longitude: number) => {
      await citiesApi.updateCoordinates(cityId, { latitude, longitude });
      // The catalogue is cached process-wide, so the correction has to be pulled
      // back in — otherwise this picker keeps handing the old coordinates to the
      // map the next time the same city is chosen.
      await refresh();
      setPending((prev) => (prev ? { ...prev, latitude, longitude } : prev));
    },
    [refresh]
  );

  return (
    <>
      <SearchableSelect
        options={optionsWithCurrent}
        value={value}
        onChange={handleSelect}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        disabled={disabled}
        error={error}
        theme={theme}
        isLoading={loading}
        icon={icon ?? <MapPin className="w-4 h-4" />}
      />

      {value && !loading && !selected && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Ville non répertoriée — vérifiez l'orthographe.
        </p>
      )}

      {value && selected && selected.isDeliverable === false && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Non desservie par Coliaty.
        </p>
      )}

      <CityMapModal
        open={!!pending}
        city={pending}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
        canEdit={canEdit}
        onSaveCoordinates={handleSaveCoordinates}
      />
    </>
  );
}
