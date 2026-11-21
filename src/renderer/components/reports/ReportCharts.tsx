import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DailySalesChartProps {
  title: string;
  data: any[];
  currencySymbol: string;
  revenueLabel: string;
}

export const DailySalesChart: React.FC<DailySalesChartProps> = ({
  title,
  data,
  currencySymbol,
  revenueLabel,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="date" fontSize={12} tick={{ fill: '#6B7280' }} />
        <YAxis fontSize={12} tick={{ fill: '#6B7280' }} />
        <Tooltip
          formatter={(value: number) => [`${currencySymbol}${value.toFixed(2)}`, revenueLabel]}
          contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#3B82F6"
          strokeWidth={2}
          dot={{ r: 4 }}
          name={revenueLabel}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

interface TopItemsBarChartProps {
  title: string;
  data: any[];
  currencySymbol: string;
  revenueLabel: string;
}

export const TopItemsBarChart: React.FC<TopItemsBarChartProps> = ({
  title,
  data,
  currencySymbol,
  revenueLabel,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis type="number" fontSize={12} tick={{ fill: '#6B7280' }} />
        <YAxis dataKey="name" type="category" fontSize={12} tick={{ fill: '#6B7280' }} width={90} />
        <Tooltip
          formatter={(value: number) => [`${currencySymbol}${value.toFixed(2)}`, revenueLabel]}
          contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
        />
        <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} name={revenueLabel} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

interface CategoryPieChartProps {
  title: string;
  data: any[];
  currencySymbol: string;
  revenueLabel: string;
}

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({
  title,
  data,
  currencySymbol,
  revenueLabel,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={120}
          innerRadius={60}
          dataKey="value"
          label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
          labelLine
        >
          {data.map((entry: any, index: number) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [`${currencySymbol}${value.toFixed(2)}`, revenueLabel]}
          contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
        />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

interface PaymentModesPieChartProps {
  title: string;
  data: any[];
  currencySymbol: string;
  amountLabel: string;
}

export const PaymentModesPieChart: React.FC<PaymentModesPieChartProps> = ({
  title,
  data,
  currencySymbol,
  amountLabel,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={110}
          innerRadius={50}
          dataKey="value"
          label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
          labelLine
        >
          {data.map((entry: any, index: number) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [`${currencySymbol}${value.toFixed(2)}`, amountLabel]}
          contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
        />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

interface StaffPerformanceBarChartProps {
  title: string;
  data: any[];
  revenueLabel: string;
  ordersLabel: string;
}

export const StaffPerformanceBarChart: React.FC<StaffPerformanceBarChartProps> = ({
  title,
  data,
  revenueLabel,
  ordersLabel,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="name" fontSize={12} tick={{ fill: '#6B7280' }} />
        <YAxis fontSize={12} tick={{ fill: '#6B7280' }} />
        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
        <Legend />
        <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} name={revenueLabel} />
        <Bar dataKey="orders" fill="#10B981" radius={[4, 4, 0, 0]} name={ordersLabel} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

interface InventoryConsumptionBarChartProps {
  title: string;
  data: any[];
  costLabel: string;
  wastedLabel: string;
}

export const InventoryConsumptionBarChart: React.FC<InventoryConsumptionBarChartProps> = ({
  title,
  data,
  costLabel,
  wastedLabel,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis type="number" fontSize={12} tick={{ fill: '#6B7280' }} />
        <YAxis dataKey="name" type="category" fontSize={12} tick={{ fill: '#6B7280' }} width={90} />
        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
        <Legend />
        <Bar dataKey="cost" fill="#3B82F6" radius={[0, 4, 4, 0]} name={costLabel} />
        <Bar dataKey="wasted" fill="#EF4444" radius={[0, 4, 4, 0]} name={wastedLabel} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

interface KitchenPrepTimeBarChartProps {
  title: string;
  data: any[];
  avgMinutesLabel: string;
}

export const KitchenPrepTimeBarChart: React.FC<KitchenPrepTimeBarChartProps> = ({
  title,
  data,
  avgMinutesLabel,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis type="number" fontSize={12} tick={{ fill: '#6B7280' }} />
        <YAxis dataKey="name" type="category" fontSize={11} tick={{ fill: '#6B7280' }} width={110} />
        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
        <Bar dataKey="avgMinutes" fill="#F59E0B" radius={[0, 4, 4, 0]} name={avgMinutesLabel} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

interface TableWiseBarChartsProps {
  data: any[];
  revenueTitle: string;
  ordersTitle: string;
  completedLabel: string;
  cancelledLabel: string;
  formatCurrencyFn: (val: number) => string;
}

export const TableWiseBarCharts: React.FC<TableWiseBarChartsProps> = ({
  data,
  revenueTitle,
  ordersTitle,
  completedLabel,
  cancelledLabel,
  formatCurrencyFn,
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{revenueTitle}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data.slice(0, 15)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="tableName" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrencyFn(v)} />
          <Tooltip formatter={(v: number) => formatCurrencyFn(v)} />
          <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{ordersTitle}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data.slice(0, 15)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="tableName" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="completedOrders" name={completedLabel} fill="#10B981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="cancelledOrders" name={cancelledLabel} fill="#EF4444" radius={[4, 4, 0, 0]} />
          <Legend />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

interface BusyHoursBarChartProps {
  title: string;
  data: any[];
  ordersLabel: string;
  busyHoursView: 'hour' | 'day' | 'week' | 'month' | 'year';
}

export const BusyHoursBarChart: React.FC<BusyHoursBarChartProps> = ({
  title,
  data,
  ordersLabel,
  busyHoursView,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="name"
          fontSize={12}
          tick={{ fill: '#6B7280' }}
          interval={0}
          angle={busyHoursView === 'day' ? -45 : 0}
          textAnchor={busyHoursView === 'day' ? 'end' : 'middle'}
          height={busyHoursView === 'day' ? 60 : 30}
        />
        <YAxis fontSize={12} tick={{ fill: '#6B7280' }} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
        <Bar dataKey="orders" radius={[4, 4, 0, 0]} name={ordersLabel}>
          {data.map((entry: any, index: number) => (
            <Cell key={index} fill={entry.isPeak ? '#EF4444' : '#3B82F6'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);
