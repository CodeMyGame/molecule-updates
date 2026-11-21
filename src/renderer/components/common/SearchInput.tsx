import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SearchInputProps {
  placeholder?: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  className?: string;
  autoFocus?: boolean;
}

const SearchInput: React.FC<SearchInputProps> = ({
  placeholder,
  onChange,
  debounceMs = 300,
  className = '',
  autoFocus = false,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onChange(value);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, debounceMs, onChange]);

  const handleClear = () => {
    setValue('');
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <Search
        size={18}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? t('common.searchPlaceholder')}
        className="w-full pl-10 pr-9 py-2 text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700
          text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500
          placeholder:text-gray-400 dark:placeholder:text-slate-500 transition-all shadow-2xs"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400
            hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default SearchInput;
