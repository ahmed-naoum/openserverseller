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
  // Aliased: `error` is already this component's own prop for the invalid-input
  // border, and shadowing it silently turns that border on whenever a fetch fails.
  const { cities, loading, error: catalogueError, resolve, refresh } = useCities({ deliverableOnly });
  const { user } = useAuth();
  const [pending, setPending] = useState<City | null>(null);

  const canEdit = user?.role === 'SUPER_ADMIN';

  /**
   * No cities at all is an environment fault — the import has not been run
   * against this database — not a legitimate empty result. Left unsaid, the
   * picker just looks like a dropdown with nothing in it, and because an
   * unresolvable name skips the map, the confirmation step vanishes too. Both
   * symptoms have this one cause, so it is worth stating plainly.
   */
  const catalogueUnavailable = !loading && (!!catalogueError || cities.length === 0);

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

  /**
   * Nothing is committed until the map is confirmed, except where there is
   * nothing to confirm: a value carried over from `optionsWithCurrent` (a city
   * already stored on the record that the catalogue does not know) has no row
   * and therefore no position to show.
   *
   * That fallback is also what an empty catalogue looks like from in here, which
   * is why `catalogueUnavailable` is surfaced above rather than left to be
   * inferred — the picker silently behaving like a text box is how an unrun
   * import stayed invisible in production.
   */
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

      {catalogueUnavailable ? (
        <p className="mt-1 flex items-start gap-1 text-[11px] font-semibold text-red-600">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
          <span>
            Liste des villes indisponible — la vérification sur carte est désactivée.
            Prévenez un administrateur.
          </span>
        </p>
      ) : (
        value && !loading && !selected && (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Ville non répertoriée — vérifiez l'orthographe.
          </p>
        )
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
