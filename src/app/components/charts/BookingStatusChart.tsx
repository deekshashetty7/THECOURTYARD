import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Cell, Pie, PieChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';
import type { ChartConfig } from '../ui/chart';

type BookingStatusItem = {
  name: string;
  value: number;
  color: string;
};

interface BookingStatusChartProps {
  data?: BookingStatusItem[];
}

const chartConfig = {
  Upcoming: { label: 'Upcoming', color: '#3b82f6' },
  Completed: { label: 'Completed', color: '#808000' },
  Cancelled: { label: 'Cancelled', color: '#ef4444' },
} satisfies ChartConfig;

export const BookingStatusChart = memo(({ data }: BookingStatusChartProps) => {
  const navigate = useNavigate();
  const chartData = data && data.length ? data : [];
  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  const activeSlices = useMemo(
    () => chartData.filter((item) => item.value > 0),
    [chartData]
  );

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[240px] text-center text-gray-500">
        <p className="text-sm font-medium">No booking data yet</p>
        <p className="text-xs mt-1">Charts will update as bookings are created</p>
      </div>
    );
  }

  const handleNavigate = (status: string) => {
    navigate(`/admin/bookings?status=${status.toLowerCase()}`);
  };

  return (
    <>
      <ChartContainer config={chartConfig} className="mx-auto h-[200px] w-full max-w-[220px] aspect-square">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name) => (
                  <span className="font-semibold text-gray-800">
                    {name}: {Number(value)}
                  </span>
                )}
              />
            }
          />
          <Pie
            data={activeSlices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={activeSlices.length > 1 ? 3 : 0}
            strokeWidth={2}
            stroke="#ffffff"
            onClick={(slice) => handleNavigate(String(slice.name))}
            className="cursor-pointer outline-none"
          >
            {activeSlices.map((item) => (
              <Cell key={item.name} fill={item.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <div className="mt-3 md:mt-4 space-y-2">
        {chartData.map((item, index) => (
          <div
            key={`legend-${index}-${item.name}`}
            className="flex items-center justify-between cursor-pointer rounded-lg px-1 py-0.5 transition-colors hover:bg-gray-50"
            onClick={() => handleNavigate(item.name)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleNavigate(item.name);
              }
            }}
          >
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs md:text-sm text-gray-600">{item.name}</span>
            </div>
            <span className="text-sm md:text-base font-semibold">{item.value}</span>
          </div>
        ))}
      </div>
    </>
  );
});

BookingStatusChart.displayName = 'BookingStatusChart';
