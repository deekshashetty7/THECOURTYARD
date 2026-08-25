import { memo, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';
import type { ChartConfig } from '../ui/chart';

type RevenuePoint = {
  month: string;
  revenue: number;
};

interface RevenueChartProps {
  data?: RevenuePoint[];
}

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: '#808000',
  },
} satisfies ChartConfig;

const formatAxisValue = (value: number) => {
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }

  if (value >= 1000) {
    return `₹${Math.round(value / 1000)}k`;
  }

  return `₹${value}`;
};

const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN')}`;

const getYAxisMax = (maxRevenue: number) => {
  if (maxRevenue <= 0) {
    return 1000;
  }

  const padded = maxRevenue * 1.15;
  const magnitude = Math.pow(10, Math.floor(Math.log10(padded)));
  return Math.ceil(padded / magnitude) * magnitude;
};

export const RevenueChart = memo(({ data }: RevenueChartProps) => {
  const chartData = data && data.length ? data : [];

  const maxRevenue = useMemo(
    () => Math.max(...chartData.map((item) => item.revenue), 0),
    [chartData]
  );
  const yAxisMax = useMemo(() => getYAxisMax(maxRevenue), [maxRevenue]);
  const totalRevenue = useMemo(
    () => chartData.reduce((sum, item) => sum + item.revenue, 0),
    [chartData]
  );

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[280px] text-center text-gray-500">
        <p className="text-sm font-medium">No revenue data yet</p>
        <p className="text-xs mt-1">Charts will update as bookings and subscriptions are created</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Last 4 months</p>
          <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-full bg-[#808000]/10 px-3 py-1 text-xs font-medium text-[#5D5E1F]">
          {chartData.filter((item) => item.revenue > 0).length} active month
          {chartData.filter((item) => item.revenue > 0).length === 1 ? '' : 's'}
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[260px] w-full aspect-auto">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <defs>
            <linearGradient id="revenueBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9CA33B" />
              <stop offset="100%" stopColor="#5D5E1F" />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#E5E7EB" />

          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B7280', fontSize: 12 }}
            dy={8}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickFormatter={formatAxisValue}
            domain={[0, yAxisMax]}
            width={52}
          />

          <ChartTooltip
            cursor={{ fill: 'rgba(128, 128, 0, 0.06)', radius: 8 }}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value) => (
                  <span className="font-semibold text-[#5D5E1F]">{formatCurrency(Number(value))}</span>
                )}
              />
            }
          />

          <Bar dataKey="revenue" radius={[8, 8, 0, 0]} maxBarSize={52}>
            {chartData.map((item, index) => (
              <Cell
                key={`cell-${index}-${item.month}`}
                fill={item.revenue > 0 ? 'url(#revenueBarGradient)' : '#E5E7EB'}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
});

RevenueChart.displayName = 'RevenueChart';
