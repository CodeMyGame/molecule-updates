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
    <div className="flex items-center gap-2">
      {stations.map((station) => {
        const isActive = selectedStation === station.key;
        const count = counts[station.key] ?? 0;

        return (
          <button
            key={station.key}
            type="button"
            onClick={() => onSelect(station.key)}
            className={`
              relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm
              transition-all duration-150 select-none
              ${
                isActive
                  ? 'bg-white text-gray-900 shadow-lg shadow-white/20'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
              }
            `}
          >
            {station.icon}
            <span className="hidden md:inline">{station.label}</span>
            {count > 0 && (
              <span
                className={`
                  inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5
                  rounded-full text-xs font-bold
                  ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-200'
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
