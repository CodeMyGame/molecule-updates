import React, { useMemo } from 'react';
import {
  ChefHat,
  Flame,
  Wine,
  IceCreamCone,
  LayoutGrid,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

type StationKey = 'all' | 'main_kitchen' | 'tandoor' | 'bar' | 'dessert';

interface StationFilterProps {
  selectedStation: StationKey;
  onSelect: (station: StationKey) => void;
  counts: Record<StationKey, number>;
}

const STATION_DEFS: { key: StationKey; labelKey: string; icon: React.ReactNode }[] = [
  { key: 'all', labelKey: 'kitchen.stationAll', icon: <LayoutGrid size={20} /> },
  { key: 'main_kitchen', labelKey: 'kitchen.stationMainKitchen', icon: <ChefHat size={20} /> },
  { key: 'tandoor', labelKey: 'kitchen.stationTandoor', icon: <Flame size={20} /> },
  { key: 'bar', labelKey: 'kitchen.stationBar', icon: <Wine size={20} /> },
  { key: 'dessert', labelKey: 'kitchen.stationDessert', icon: <IceCreamCone size={20} /> },
];

const StationFilter: React.FC<StationFilterProps> = ({
  selectedStation,
  onSelect,
  counts,
}) => {
  const { t, i18n } = useTranslation();
  const stations = useMemo(
    () =>
      STATION_DEFS.map((s) => ({
        ...s,
        label: t(s.labelKey),
      })),
    [t, i18n.language]
  );

  return (
    <div className="inline-flex items-center p-1 bg-gray-100 dark:bg-slate-800/90 rounded-xl border border-gray-200/80 dark:border-slate-700/70 shadow-2xs gap-1 overflow-x-auto no-scrollbar max-w-full">
      {stations.map((station) => {
        const isActive = selectedStation === station.key;
        const count = counts[station.key] ?? 0;

        return (
          <button
            key={station.key}
            type="button"
            onClick={() => onSelect(station.key)}
            className={`
              relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold
              transition-all duration-150 select-none whitespace-nowrap
              ${
                isActive
                  ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-xs border border-gray-200/60 dark:border-blue-500/50'
                  : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50 border border-transparent'
              }
            `}
          >
            <span className={isActive ? 'text-blue-600 dark:text-white' : 'text-gray-500 dark:text-slate-400'}>
              {station.icon}
            </span>
            <span>{station.label}</span>
            {count > 0 && (
              <span
                className={`
                  inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5
                  rounded-full text-[11px] font-bold tabular-nums
                  ${
                    isActive
                      ? 'bg-blue-600 text-white dark:bg-white dark:text-blue-700'
                      : 'bg-gray-200/90 text-gray-700 dark:bg-slate-700 dark:text-slate-200'
                  }
                `}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default StationFilter;
