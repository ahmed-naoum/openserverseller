import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { normalizeSearch as normalize } from '../../utils/search';

interface Option {
  value: string | number;
  label: string;
  /**
   * What the search should actually match on, when the label carries extra
   * context the user is not typing — e.g. a city labelled "AGADIR (Hub: SUD)"
   * would otherwise surface every city in the SUD hub for the query "agadir".
   * The label stays searchable, just ranked below these.
   */
  searchText?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  theme?: 'classic' | 'girly' | 'princess';
  searchPlaceholder?: string;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Sélectionnez...',
  disabled = false,
  error = false,
  theme = 'classic',
  searchPlaceholder = 'Rechercher...',
  isLoading = false,
  icon
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  /**
   * Ranked rather than a flat `includes`, so what was typed comes first: exact
   * prefix, then a word starting with it, then anywhere in the text. Spaces are
   * ignored on both sides, so "eljadida" finds "El Jadida".
   *
   * Only `searchText` is matched when an option provides one — the label's extra
   * context is there to be read, not searched.
   */
  const filteredOptions = useMemo(() => {
    const query = normalize(searchTerm);
    if (!query) return options;
    const compactQuery = query.replace(/ /g, '');

    const ranked: { option: Option; rank: number; index: number }[] = [];

    options.forEach((option, index) => {
      const haystack = normalize(option.searchText ?? String(option.label));
      const compact = haystack.replace(/ /g, '');

      let rank = -1;
      if (compact.startsWith(compactQuery)) rank = 0;
      else if (haystack.split(' ').some(word => word.startsWith(compactQuery))) rank = 1;
      else if (compact.includes(compactQuery)) rank = 2;

      if (rank >= 0) ranked.push({ option, rank, index });
    });

    return ranked
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map(entry => entry.option);
  }, [options, searchTerm]);

  const isPrincess = theme === 'princess';
  const isGirly = theme === 'girly';

  const ringColor = isPrincess ? 'focus:ring-amber-400' : isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400';
  const bgSelectedColor = isPrincess ? 'bg-amber-50 text-amber-700' : isGirly ? 'bg-pink-50 text-pink-700' : 'bg-indigo-50 text-indigo-700';

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) setSearchTerm('');
          }
        }}
        className={`w-full flex items-center justify-between py-2.5 border rounded-xl outline-none text-sm font-bold shadow-sm transition-all text-left ${
          icon ? 'pl-9 pr-4' : 'px-4'
        } ${
          error ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-gray-200 bg-white'
        } ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : `focus:ring-2 ${ringColor} hover:border-gray-300`}`}
      >
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 flex items-center justify-center pointer-events-none">
            {icon}
          </span>
        )}
        <span className={`block truncate ${!selectedOption ? 'text-gray-400' : 'text-gray-900'}`}>
          {isLoading ? 'Chargement...' : selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${disabled ? 'text-gray-300' : 'text-gray-400'}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className={`w-full pl-9 pr-3 py-2 text-sm font-semibold border-none bg-gray-50 rounded-lg outline-none focus:ring-2 ${ringColor} transition-all`}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          
          <ul className="overflow-y-auto flex-1 py-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-500 text-center font-medium">
                Aucun résultat trouvé
              </li>
            ) : (
              // Keyed by position, not value: option lists coming from external
              // APIs (Coliaty's cities) repeat values, and duplicate keys leave
              // React rendering stale rows after the query changes.
              filteredOptions.map((opt, index) => (
                <li
                  key={`${opt.value}-${index}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer font-semibold flex items-center justify-between transition-colors ${
                    value === opt.value
                      ? bgSelectedColor
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate pr-4">{opt.label}</span>
                  {value === opt.value && <Check className="w-4 h-4 shrink-0" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
