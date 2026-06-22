import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Calendar, DollarSign, TrendingUp, Users } from 'lucide-react';
import { format } from 'date-fns';
import { GlassCard } from '../../components/GlassCard';
import { useBooking } from '../../context/BookingContext';
import { getBookingPaymentState, getSubscriptionPaymentState } from '../../lib/bookingUtils';

export const AdminRevenuePage = () => {
  const { bookings, subscriptions, appSettings } = useBooking();
  const navigate = useNavigate();

  const currentMonthKey = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const monthLabel = useMemo(() => format(new Date(), 'MMMM yyyy'), []);

  const activeBookings = useMemo(() => bookings.filter((booking) => booking.status !== 'cancelled'), [bookings]);
  const currentMonthBookings = useMemo(
    () => activeBookings.filter((booking) => (booking.createdAt || '').slice(0, 7) === currentMonthKey || (booking.date || '').slice(0, 7) === currentMonthKey),
    [activeBookings, currentMonthKey]
  );

  const currentMonthSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => subscription.status !== 'cancelled' && (subscription.createdAt || '').slice(0, 7) === currentMonthKey),
    [currentMonthKey, subscriptions]
  );

  const liveStats = useMemo(() => {
    const totalBookings = activeBookings.length;
    const bookingAmounts = currentMonthBookings.map((booking) => ({
      amount: Number(booking.totalAmount || 0),
      state: getBookingPaymentState(booking),
    }));
    const subscriptionAmounts = currentMonthSubscriptions.map((subscription) => ({
      amount: Number(subscription.amount || 0),
      state: getSubscriptionPaymentState(subscription),
    }));

    const bookingRevenue = bookingAmounts.reduce((sum, item) => sum + item.amount, 0);
    const subscriptionRevenue = subscriptionAmounts.reduce((sum, item) => sum + item.amount, 0);
    const paidBookingRevenue = bookingAmounts.filter((item) => item.state === 'paid').reduce((sum, item) => sum + item.amount, 0);
    const pendingBookingRevenue = bookingAmounts.filter((item) => item.state === 'pending').reduce((sum, item) => sum + item.amount, 0);
    const paidSubscriptionRevenue = subscriptionAmounts.filter((item) => item.state === 'paid').reduce((sum, item) => sum + item.amount, 0);
    const pendingSubscriptionRevenue = subscriptionAmounts.filter((item) => item.state === 'pending').reduce((sum, item) => sum + item.amount, 0);
    const totalRevenue = bookingRevenue + subscriptionRevenue;
    const paidRevenue = paidBookingRevenue + paidSubscriptionRevenue;
    const pendingRevenue = pendingBookingRevenue + pendingSubscriptionRevenue;
    const activeUsers = new Set(
      [...bookings, ...subscriptions]
        .filter((item) => item.status !== 'cancelled')
        .map((item) => item.userEmail || item.userName || '')
        .filter(Boolean)
    ).size;

    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const operatingHours = Math.max(1, appSettings.operatingHours.endHour - appSettings.operatingHours.startHour + 1);
    const totalCapacity = daysInMonth * appSettings.courts.length * operatingHours;
    const bookedSlots = currentMonthBookings.reduce((sum, booking) => sum + (booking.slots?.length || 0), 0);
    const avgUtilization = totalCapacity > 0 ? Math.round((bookedSlots / totalCapacity) * 100) : 0;

    return {
      totalBookings,
      totalRevenue,
      paidRevenue,
      pendingRevenue,
      activeUsers,
      avgUtilization,
      bookingRevenue,
      subscriptionRevenue,
      paidBookingRevenue,
      pendingBookingRevenue,
      paidSubscriptionRevenue,
      pendingSubscriptionRevenue,
    };
  }, [activeBookings.length, appSettings.courts.length, appSettings.operatingHours.endHour, appSettings.operatingHours.startHour, bookings, currentMonthBookings, currentMonthSubscriptions, subscriptions]);

  const revenueChartData = useMemo(() => {
    const monthMap = new Map<string, number>();

    const sourceRecords = [
      ...activeBookings.map((booking) => ({ dateKey: (booking.createdAt || booking.date || '').slice(0, 7), amount: Number(booking.totalAmount || 0) })),
      ...subscriptions
        .filter((subscription) => subscription.status !== 'cancelled')
        .map((subscription) => ({ dateKey: (subscription.createdAt || subscription.startDate || '').slice(0, 7), amount: Number(subscription.amount || 0) })),
    ];

    for (const record of sourceRecords) {
      if (!record.dateKey) continue;
      monthMap.set(record.dateKey, (monthMap.get(record.dateKey) || 0) + record.amount);
    }

    const months = Array.from({ length: 4 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (3 - index));
      const key = format(date, 'yyyy-MM');
      return { month: format(date, 'MMM'), revenue: monthMap.get(key) || 0 };
    });

    return months;
  }, [activeBookings, subscriptions]);

  return (
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-7xl">
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 text-sm md:text-base"
        >
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
          Back to Dashboard
        </button>

        <div className="mb-6 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1 md:mb-2">Revenue Report</h1>
            <p className="text-sm md:text-base text-gray-600">Detailed financial analysis</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-900 border border-green-100">
            <TrendingUp className="w-4 h-4" />
            {monthLabel}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <GlassCard className="bg-gradient-to-br from-green-50 to-yellow-50 border border-green-100 p-6">
            <p className="text-green-900 text-sm font-medium mb-2">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-800">₹{liveStats.totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-green-900 mt-2">Live current month value</p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 p-6">
            <p className="text-emerald-700 text-sm font-medium mb-2">Paid Amount</p>
            <p className="text-3xl font-bold text-gray-800">₹{liveStats.paidRevenue.toLocaleString()}</p>
            <p className="text-xs text-emerald-700 mt-2">
              {liveStats.totalRevenue > 0 ? Math.round((liveStats.paidRevenue / liveStats.totalRevenue) * 100) : 0}% of total revenue
            </p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-6">
            <p className="text-amber-700 text-sm font-medium mb-2">Pending Amount</p>
            <p className="text-3xl font-bold text-gray-800">₹{liveStats.pendingRevenue.toLocaleString()}</p>
            <p className="text-xs text-amber-700 mt-2">
              {liveStats.totalRevenue > 0 ? Math.round((liveStats.pendingRevenue / liveStats.totalRevenue) * 100) : 0}% awaiting payment
            </p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-blue-50 to-yellow-50 border border-blue-100 p-6">
            <p className="text-blue-600 text-sm font-medium mb-2">Total Bookings</p>
            <p className="text-3xl font-bold text-gray-800">{liveStats.totalBookings.toLocaleString()}</p>
            <p className="text-xs text-blue-600 mt-2">Live database count</p>
          </GlassCard>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          <GlassCard className="p-4 md:p-6 lg:col-span-2">
            <h2 className="text-lg md:text-xl font-semibold mb-4">Revenue Breakdown</h2>
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">By Source</p>
                <div className="space-y-4">
                  {[
                    {
                      label: 'Court Bookings',
                      amount: liveStats.bookingRevenue,
                      paid: liveStats.paidBookingRevenue,
                      pending: liveStats.pendingBookingRevenue,
                      percentage: liveStats.totalRevenue > 0 ? (liveStats.bookingRevenue / liveStats.totalRevenue) * 100 : 0,
                      color: 'bg-blue-500',
                    },
                    {
                      label: 'Subscriptions',
                      amount: liveStats.subscriptionRevenue,
                      paid: liveStats.paidSubscriptionRevenue,
                      pending: liveStats.pendingSubscriptionRevenue,
                      percentage: liveStats.totalRevenue > 0 ? (liveStats.subscriptionRevenue / liveStats.totalRevenue) * 100 : 0,
                      color: 'bg-green-900',
                    },
                  ].map((item, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                        <span className="text-sm font-semibold text-gray-800">₹{item.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between mb-2 text-xs">
                        <span className="text-emerald-700">Paid ₹{item.paid.toLocaleString()}</span>
                        <span className="text-amber-700">Pending ₹{item.pending.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`${item.color} h-2 rounded-full`} style={{ width: `${item.percentage}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <p className="text-sm font-medium text-gray-700 mb-3">By Payment Status</p>
                <div className="space-y-4">
                  {[
                    {
                      label: 'Paid',
                      amount: liveStats.paidRevenue,
                      percentage: liveStats.totalRevenue > 0 ? (liveStats.paidRevenue / liveStats.totalRevenue) * 100 : 0,
                      color: 'bg-emerald-500',
                    },
                    {
                      label: 'Pending',
                      amount: liveStats.pendingRevenue,
                      percentage: liveStats.totalRevenue > 0 ? (liveStats.pendingRevenue / liveStats.totalRevenue) * 100 : 0,
                      color: 'bg-amber-500',
                    },
                  ].map((item, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                        <span className="text-sm font-semibold text-gray-800">₹{item.amount.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`${item.color} h-2 rounded-full`} style={{ width: `${item.percentage}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-4">Live Stats</h2>
            <div className="space-y-3">
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600"><Users className="w-4 h-4" /> Active Users</div>
                <p className="mt-2 text-2xl font-bold text-gray-800">{liveStats.activeUsers.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600"><Calendar className="w-4 h-4" /> Avg. Utilization</div>
                <p className="mt-2 text-2xl font-bold text-gray-800">{liveStats.avgUtilization}%</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600"><DollarSign className="w-4 h-4" /> Capacity</div>
                <p className="mt-2 text-2xl font-bold text-gray-800">{appSettings.courts.length} courts</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 md:p-6 lg:col-span-3">
            <h2 className="text-lg md:text-xl font-semibold mb-4">Monthly Comparison</h2>
            <div className="space-y-2">
              {revenueChartData.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                  <span className="text-sm font-medium text-gray-700">{item.month}</span>
                  <span className="text-sm font-semibold text-green-900">₹{item.revenue.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
  );
};
