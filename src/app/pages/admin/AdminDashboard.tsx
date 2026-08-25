import { useMemo } from 'react';
import { Users, Calendar, TrendingUp, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { useBooking, getEffectiveBookingStatus } from '../../context/BookingContext';
import { RevenueChart } from '../../components/charts/RevenueChart';
import { BookingStatusChart } from '../../components/charts/BookingStatusChart';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';

export const AdminDashboard = () => {
  const { bookings, subscriptions, appSettings } = useBooking();
  const { user } = useAuth();
  const navigate = useNavigate();

  const currentMonthKey = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const monthLabel = useMemo(() => format(new Date(), 'MMMM yyyy'), []);

  const activeBookings = useMemo(() => bookings.filter(booking => booking.status !== 'cancelled'), [bookings]);
  const currentMonthBookings = useMemo(
    () => activeBookings.filter(booking => (booking.createdAt || '').slice(0, 7) === currentMonthKey || (booking.date || '').slice(0, 7) === currentMonthKey),
    [activeBookings, currentMonthKey]
  );

  const currentMonthSubscriptions = useMemo(
    () => subscriptions.filter(subscription => subscription.status !== 'cancelled' && (subscription.createdAt || '').slice(0, 7) === currentMonthKey),
    [currentMonthKey, subscriptions]
  );

  const liveStats = useMemo(() => {
    const totalBookings = activeBookings.length;
    const bookingRevenue = currentMonthBookings.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0);
    const subscriptionRevenue = currentMonthSubscriptions.reduce((sum, subscription) => sum + Number(subscription.amount || 0), 0);
    const totalRevenue = bookingRevenue + subscriptionRevenue;
    const activeUsers = new Set(
      [...bookings, ...subscriptions]
        .filter(item => item.status !== 'cancelled')
        .map(item => item.userEmail || item.userName || '')
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
      activeUsers,
      avgUtilization,
      bookingRevenue,
      subscriptionRevenue,
    };
  }, [activeBookings.length, appSettings.courts.length, appSettings.operatingHours.endHour, appSettings.operatingHours.startHour, bookings, currentMonthBookings, currentMonthKey, currentMonthSubscriptions, subscriptions]);

  const revenueChartData = useMemo(() => {
    const monthMap = new Map<string, number>();

    const sourceRecords = [
      ...activeBookings.map(booking => ({ dateKey: (booking.createdAt || booking.date || '').slice(0, 7), amount: Number(booking.totalAmount || 0) })),
      ...subscriptions
        .filter(subscription => subscription.status !== 'cancelled')
        .map(subscription => ({ dateKey: (subscription.createdAt || subscription.startDate || '').slice(0, 7), amount: Number(subscription.amount || 0) })),
    ];

    for (const record of sourceRecords) {
      if (!record.dateKey) {
        continue;
      }

      monthMap.set(record.dateKey, (monthMap.get(record.dateKey) || 0) + record.amount);
    }

    const months = Array.from({ length: 4 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (3 - index));
      const key = format(date, 'yyyy-MM');
      return {
        month: format(date, 'MMM'),
        revenue: monthMap.get(key) || 0,
      };
    });

    return months;
  }, [activeBookings, subscriptions]);

  const bookingStatusData = useMemo(() => {
    const upcoming = bookings.filter(booking => getEffectiveBookingStatus(booking) === 'upcoming').length;
    const completed = bookings.filter(booking => getEffectiveBookingStatus(booking) === 'completed').length;
    const cancelled = bookings.filter(booking => getEffectiveBookingStatus(booking) === 'cancelled').length;

    return [
      { name: 'Upcoming', value: upcoming, color: '#3b82f6' },
      { name: 'Completed', value: completed, color: '#808000' },
      { name: 'Cancelled', value: cancelled, color: '#ef4444' },
    ];
  }, [bookings]);

  const stats = [
    {
      label: 'Total Bookings',
      value: liveStats.totalBookings.toLocaleString(),
      change: 'Live',
      icon: <Calendar className="w-6 h-6" />,
      color: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Revenue (This Month)',
      value: `₹${liveStats.totalRevenue.toLocaleString()}`,
      change: monthLabel,
      icon: <DollarSign className="w-6 h-6" />,
      color: 'from-green-900 to-green-800',
    },
    {
      label: 'Active Users',
      value: liveStats.activeUsers.toLocaleString(),
      change: 'Live',
      icon: <Users className="w-6 h-6" />,
      color: 'from-purple-500 to-purple-600',
    },
    {
      label: 'Avg. Utilization',
      value: `${liveStats.avgUtilization}%`,
      change: 'Current month',
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'from-orange-500 to-orange-600',
    },
  ];

  const upcomingBookings = useMemo(() => {
    return bookings
      .filter((booking) => getEffectiveBookingStatus(booking) === 'upcoming')
      .sort((a, b) => {
        const left = `${a.date || ''} ${a.createdAt || ''}`;
        const right = `${b.date || ''} ${b.createdAt || ''}`;
        return left.localeCompare(right);
      })
      .slice(0, 5);
  }, [bookings]);

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-7xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1 md:mb-2">Admin Dashboard</h1>
          <p className="text-sm md:text-base text-gray-600">Overview of your sports facility</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          {stats.map((stat, index) => (
            <GlassCard key={index} className="p-4 md:p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-3 md:mb-4">
                <div className={`w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center text-white`}>
                  {stat.icon}
                </div>
                <span className="text-xs md:text-sm font-medium text-green-900 bg-green-50 px-2 py-1 rounded">
                  {stat.change}
                </span>
              </div>
              <p className="text-gray-600 text-xs md:text-sm mb-1">{stat.label}</p>
              <p className="text-xl md:text-2xl font-bold text-gray-800">{stat.value}</p>
            </GlassCard>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          {/* Revenue Chart */}
          <GlassCard className="p-4 md:p-6 lg:col-span-2">
            <h2 className="text-lg md:text-xl font-semibold mb-4 md:mb-6">Revenue Overview</h2>
            <RevenueChart data={revenueChartData} />
          </GlassCard>

          {/* Booking Status Pie Chart */}
          <GlassCard className="p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-4 md:mb-6">Booking Status</h2>
            <BookingStatusChart data={bookingStatusData} />
          </GlassCard>

          {/* Upcoming Bookings */}
          <GlassCard className="p-4 md:p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-lg md:text-xl font-semibold">Upcoming Bookings</h2>
              <button
                onClick={() => navigate('/admin/bookings')}
                className="text-xs md:text-sm text-[#808000] hover:text-[#5D5E1F] font-medium"
              >
                View All
              </button>
            </div>
            <div className="space-y-2 md:space-y-3">
              {upcomingBookings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-gray-500">
                  No upcoming bookings yet.
                </div>
              ) : (
                upcomingBookings.map((booking) => (
                  <div
                    key={booking.id}
                    onClick={() => navigate(`/admin/bookings?view=${booking.id}`)}
                    className="cursor-pointer select-none flex items-center justify-between p-3 md:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/admin/bookings?view=${booking.id}`); }}
                  >
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800 text-sm md:text-base truncate">{booking.id}</p>
                        <p className="text-xs md:text-sm text-gray-600 truncate">{booking.date} • {booking.slots.length} slots</p>
                      </div>
                    </div>
                    <span className="font-semibold text-[#808000] text-sm md:text-base ml-2 flex-shrink-0">₹{booking.totalAmount}</span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          {/* Quick Actions */}
          <GlassCard className="p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-4 md:mb-6">Quick Actions</h2>
            <div className="space-y-2 md:space-y-3">
              <button 
                onClick={() => navigate('/admin/bookings')}
                className="w-full p-3 md:p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center md:justify-start gap-3 text-sm md:text-base"
              >
                <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                <span>View All Bookings</span>
              </button>
              <button 
                onClick={() => navigate('/admin/revenue')}
                className="w-full p-3 md:p-4 bg-gradient-to-r from-green-900 to-green-800 text-white rounded-xl hover:from-green-950 hover:to-green-900 transition-all flex items-center justify-center md:justify-start gap-3 text-sm md:text-base"
              >
                <DollarSign className="w-4 h-4 md:w-5 md:h-5" />
                <span>Revenue Report</span>
              </button>
              <button 
                onClick={() => navigate('/admin/users')}
                className="w-full p-3 md:p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all flex items-center justify-center md:justify-start gap-3 text-sm md:text-base"
              >
                <Users className="w-4 h-4 md:w-5 md:h-5" />
                <span>User Management</span>
              </button>
            </div>
          </GlassCard>
        </div>
    </div>
  );
};

