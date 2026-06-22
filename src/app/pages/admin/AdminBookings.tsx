import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Search, Calendar, Trash2, Eye, Repeat, X, Clock, User, MapPin, Phone, Plus, CheckCircle, Pause, Play } from 'lucide-react';
import { format } from 'date-fns';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useBooking, getEffectiveBookingStatus } from '../../context/BookingContext';
import { getAPI_BASE_URL } from '../../lib/apiConfig';
import { showSuccessToast, showErrorToast } from '../../utils/notificationHelpers';
import { CreateBookingModal } from './CreateBookingModal';
import { CreateSubscriptionModal } from './CreateSubscriptionModal';

export const AdminBookings = () => {
  const { bookings, subscriptions, appSettings, cancelBooking, cancelSubscription, createBooking, createSubscription, updateBooking, updateSubscription } = useBooking();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'bookings' | 'subscriptions'>('bookings');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  const [subStatusFilter, setSubStatusFilter] = useState<'all' | 'active' | 'paused' | 'expired' | 'cancelled'>('all');
  const [markingSelectedPaid, setMarkingSelectedPaid] = useState(false);
  const [viewDetailsModal, setViewDetailsModal] = useState<any>(null);
  const [createBookingModal, setCreateBookingModal] = useState(false);
  const [createSubscriptionModal, setCreateSubscriptionModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'booking' | 'subscription', id: string } | null>(null);

  const filteredBookings = bookings.filter(booking => {
    const effectiveStatus = getEffectiveBookingStatus(booking);
    const matchesSearch = booking.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.courtName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || effectiveStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = sub.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sub.courtName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sub.userName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = subStatusFilter === 'all' || sub.status === subStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCancelBooking = async (bookingId: string) => {
    setConfirmDialog({ type: 'booking', id: bookingId });
  };

  const handleCancelSubscription = async (subId: string) => {
    setConfirmDialog({ type: 'subscription', id: subId });
  };

  const handleConfirmCancel = async () => {
    if (!confirmDialog) return;

    try {
      if (confirmDialog.type === 'booking') {
        await cancelBooking(confirmDialog.id, { asAdmin: true });
        showSuccessToast('Success', 'Booking cancelled successfully!');
      } else {
        await cancelSubscription(confirmDialog.id, { asAdmin: true });
        showSuccessToast('Success', 'Subscription cancelled successfully!');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to cancel';
      showErrorToast('Error', message);
    } finally {
      setConfirmDialog(null);
    }
  };

  const handleMarkPaid = async (bookingId: string) => {
    try {
      await updateBooking(bookingId, { paymentStatus: 'paid' });
      showSuccessToast('Payment Updated', 'Booking marked as paid successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update payment status';
      showErrorToast('Update Failed', message);
    }
  };

  // Bulk and single booking delete removed from admin UI

  const handleDeleteBookingFromDetails = (bookingId: string) => {
    setViewDetailsModal(null);
    setConfirmDialog({ type: 'booking', id: bookingId });
  };

  const handlePauseSubscription = async (subscriptionId: string) => {
    try {
      await updateSubscription(subscriptionId, { status: 'paused' }, { asAdmin: true });
      showSuccessToast('Subscription paused', 'Subscription has been paused successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to pause subscription';
      showErrorToast('Error', message);
    }
  };

  const handleResumeSubscription = async (subscriptionId: string) => {
    try {
      const subscription = subscriptions.find(s => s.id === subscriptionId);
      if (!subscription) throw new Error('Subscription not found');
      
      // Calculate additional days to extend based on pause duration
      if (subscription.pausedAt && subscription.pausedOriginalEndDate) {
        const pausedDate = new Date(subscription.pausedAt);
        const todayDate = new Date();
        const daysPaused = Math.floor((todayDate.getTime() - pausedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Count weekdays in the pause period
        let weekdaysPaused = 0;
        for (let i = 0; i < daysPaused; i++) {
          const date = new Date(pausedDate);
          date.setDate(date.getDate() + i);
          const day = date.getDay();
          if (day !== 0 && day !== 6) weekdaysPaused++; // Not Sunday or Saturday
        }
        
        // Extend end date by weekdays paused
        const originalEndDate = new Date(subscription.pausedOriginalEndDate);
        const newEndDate = new Date(originalEndDate);
        let daysAdded = 0;
        while (daysAdded < weekdaysPaused) {
          newEndDate.setDate(newEndDate.getDate() + 1);
          const day = newEndDate.getDay();
          if (day !== 0 && day !== 6) daysAdded++; // Only count weekdays
        }
        
        const totalPausedDays = (subscription.totalPausedDays || 0) + weekdaysPaused;
        const newEndDateStr = newEndDate.toISOString().split('T')[0];
        
        await updateSubscription(subscriptionId, { 
          status: 'active',
          endDate: newEndDateStr,
          totalPausedDays,
          pausedAt: null,
          pausedOriginalEndDate: null
        }, { asAdmin: true });
      } else {
        await updateSubscription(subscriptionId, { status: 'active' }, { asAdmin: true });
      }
      
      showSuccessToast('Subscription resumed', 'Subscription has been resumed and dates extended.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to resume subscription';
      showErrorToast('Error', message);
    }
  };

  const handleMarkSubscriptionPaid = async (subscriptionId: string) => {
    try {
      const updated = await updateSubscription(subscriptionId, { paymentStatus: 'paid' }, { asAdmin: true });
      setViewDetailsModal((current: any) =>
        current?.type === 'subscription' && current.data?.id === subscriptionId
          ? { ...current, data: updated }
          : current
      );
      showSuccessToast('Payment Updated', 'Subscription marked as paid successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update payment status';
      showErrorToast('Update Failed', message);
    }
  };

  const handleCreateBooking = async (data: any) => {
    const toHourRange = (value: string) => {
      const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!match) {
        return value;
      }

      const hour12 = Number(match[1]);
      const minutes = match[2];
      const period = match[3].toUpperCase();
      let hour24 = hour12 % 12;

      if (period === 'PM') {
        hour24 += 12;
      }

      const endHour24 = (hour24 + 1) % 24;
      const endPeriod = endHour24 >= 12 ? 'PM' : 'AM';
      const endHour12 = endHour24 % 12 || 12;

      return `${hour12}:${minutes} ${period} - ${endHour12}:${minutes} ${endPeriod}`;
    };

    // Convert time slots from strings to proper TimeSlot objects
    const slots = data.timeSlots.map((time: string, index: number) => ({
      id: `slot-${Date.now()}-${index}`,
      time: toHourRange(time),
      court: parseInt(data.court.replace('Court ', '')),
      date: data.date,
      status: 'booked' as const,
      price: 500
    }));

    try {
      await createBooking({
        courtName: data.court,
        date: data.date,
        slots: slots,
        totalAmount: data.totalAmount,
        status: 'upcoming',
        paymentId: data.paymentId,
        userName: data.userName,
        userEmail: data.userEmail || undefined,
        userPhone: data.userPhone,
      }, { asAdmin: true });

      showSuccessToast('Success', 'Onsite booking created successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create booking';
      showErrorToast('Error', message);
    }
  };

  const handleCreateSubscription = async (data: any) => {
    try {
      await createSubscription({
        userId: data.userEmail || data.userPhone,
        courtName: data.court,
        court: Number(String(data.court).replace('Court ', '')),
        timeSlot: data.timeSlot,
        startDate: data.startDate,
        endDate: data.endDate,
        weekdaysCount: data.weekdaysCount,
        amount: data.amount,
        status: 'active',
        paymentId: data.paymentId,
        userName: data.userName,
        userEmail: data.userEmail || undefined,
        userPhone: data.userPhone,
      }, { asAdmin: true });

      showSuccessToast('Success', 'Onsite subscription created successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create subscription';
      showErrorToast('Error', message);
    }
  };

  // Auto-open details modal if ?view=<bookingId> is present in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const viewId = params.get('view');
    const statusParam = params.get('status');
    if (viewId && bookings && bookings.length > 0) {
      const found = bookings.find(b => String(b.id) === String(viewId));
      if (found) {
        setViewDetailsModal({ type: 'booking', data: found });
        // remove query param
        navigate(location.pathname, { replace: true });
        return;
      }
    }
    if (statusParam) {
      const s = String(statusParam).toLowerCase();
      if (s === 'upcoming' || s === 'completed' || s === 'cancelled' || s === 'all') {
        setStatusFilter(s as any);
      }
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, bookings, navigate, location.pathname]);

  const getStatusBadge = (status: string) => {
    const styles = {
      upcoming: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      expired: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Manage Bookings</h1>
          <p className="text-gray-600">View, modify, and cancel bookings</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'bookings'
                ? 'bg-[#808000] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setActiveTab('bookings')}
          >
            Bookings
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'subscriptions'
                ? 'bg-[#808000] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setActiveTab('subscriptions')}
          >
            Subscriptions
          </button>
        </div>

        {/* Filters and Search */}
        <GlassCard className="p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <Input
                placeholder={`Search by ${activeTab === 'bookings' ? 'booking ID or court' : 'subscription ID, user or court'}...`}
                icon={<Search className="w-5 h-5" />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              onClick={() => activeTab === 'bookings' ? setCreateBookingModal(true) : setCreateSubscriptionModal(true)}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              {activeTab === 'bookings' ? 'Create Booking' : 'Create Subscription'}
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap mt-4">
            {activeTab === 'bookings' ? (
              ['all', 'upcoming', 'completed', 'cancelled'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status as any)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${
                    statusFilter === status
                      ? 'bg-[#808000] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))
            ) : (
              ['all', 'active', 'paused', 'expired', 'cancelled'].map((status) => (
                <button
                  key={status}
                  onClick={() => setSubStatusFilter(status as any)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${
                    subStatusFilter === status
                      ? 'bg-[#808000] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))
            )}
          </div>

        </GlassCard>

        {/* Bookings Table */}
        {activeTab === 'bookings' && (
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 w-12">
                      <div className="w-4" />
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Booking ID</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">User</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Court</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Time Slot</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Amount</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBookings.map((booking) => {
                    // Get time slot range
                    const getTimeSlotRange = () => {
                      if (booking.slots.length === 0) return 'No slots';
                      if (booking.slots.length === 1) return booking.slots[0].time;
                      
                      const firstSlot = booking.slots[0].time;
                      const lastSlotTime = booking.slots[booking.slots.length - 1].time;
                      const lastSlotEndTime = lastSlotTime.split(' - ')[1] || lastSlotTime;
                      return `${firstSlot.split(' - ')[0]} - ${lastSlotEndTime}`;
                    };

                    // Get court name
                    const getCourtName = () => {
                      if (booking.slots.length > 0) {
                        return `Court ${booking.slots[0].court}`;
                      }
                      return booking.courtName;
                    };

                    return (
                      <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4 align-top">
                              <div className="w-4" />
                            </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-800">{booking.id}</p>
                          <p className="text-xs text-gray-500">{booking.paymentId}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-700">{booking.userName || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{booking.userEmail || 'N/A'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-700">{getCourtName()}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {format(new Date(booking.date), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700">{getTimeSlotRange()}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-[#808000]">₹{booking.totalAmount}</span>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(getEffectiveBookingStatus(booking))}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setViewDetailsModal({ type: 'booking', data: booking })}
                              className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4 text-blue-600" />
                            </button>
                            {booking.paymentStatus === 'pending' && (
                              <button
                                onClick={() => handleMarkPaid(booking.id)}
                                className="p-2 hover:bg-green-50 rounded-lg transition-colors"
                                title="Mark as Paid"
                              >
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              </button>
                            )}
                            {getEffectiveBookingStatus(booking) === 'upcoming' && booking.status !== 'cancelled' && (
                              <button
                                onClick={() => handleCancelBooking(booking.id)}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                title="Cancel Booking"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredBookings.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No bookings found</p>
              </div>
            )}
          </GlassCard>
        )}

        {/* Subscriptions Table */}
        {activeTab === 'subscriptions' && (
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Subscription ID</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">User</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Court</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Time Slot</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Start Date</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">End Date</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Weekdays Count</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Amount</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSubscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-800">{sub.id}</p>
                        <p className="text-xs text-gray-500">{sub.paymentId}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-700">{sub.userName}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-700">{sub.courtName}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">{sub.timeSlot}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700">
                            {format(new Date(sub.startDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700">
                            {format(new Date(sub.endDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">{sub.weekdaysCount} days</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-[#808000]">₹{sub.amount}</span>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(sub.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewDetailsModal({ type: 'subscription', data: sub })}
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </button>
                          {sub.status === 'active' && (
                            <>
                              <button
                                onClick={() => handlePauseSubscription(sub.id)}
                                className="p-2 hover:bg-yellow-50 rounded-lg transition-colors"
                                title="Pause Subscription"
                              >
                                <Pause className="w-4 h-4 text-yellow-700" />
                              </button>
                              <button
                                onClick={() => handleCancelSubscription(sub.id)}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                title="Cancel Subscription"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </>
                          )}
                          {sub.status === 'paused' && (
                            <>
                              <button
                                onClick={() => handleResumeSubscription(sub.id)}
                                className="p-2 hover:bg-green-50 rounded-lg transition-colors"
                                title="Resume Subscription"
                              >
                                <Play className="w-4 h-4 text-green-700" />
                              </button>
                              <button
                                onClick={() => handleCancelSubscription(sub.id)}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                title="Cancel Subscription"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredSubscriptions.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No subscriptions found</p>
              </div>
            )}
          </GlassCard>
        )}

        {/* Summary Stats */}
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <GlassCard className="p-6">
            <p className="text-sm text-gray-600 mb-1">Total Bookings</p>
            <p className="text-2xl font-bold text-gray-800">{bookings.length}</p>
          </GlassCard>
          <GlassCard className="p-6">
            <p className="text-sm text-gray-600 mb-1">Upcoming Bookings</p>
            <p className="text-2xl font-bold text-blue-600">
              {bookings.filter(b => getEffectiveBookingStatus(b) === 'upcoming').length}
            </p>
          </GlassCard>
          <GlassCard className="p-6">
            <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-green-900">
              ₹{bookings.reduce((sum, b) => sum + b.totalAmount, 0)}
            </p>
          </GlassCard>
        </div>

        {/* View Details Modal */}
        {viewDetailsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                <h3 className="text-2xl font-bold text-gray-800">
                  {viewDetailsModal.type === 'booking' ? 'Booking Details' : 'Subscription Details'}
                </h3>
                <button
                  onClick={() => setViewDetailsModal(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                {viewDetailsModal.type === 'booking' ? (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Booking ID</p>
                        <p className="font-semibold text-gray-800">{viewDetailsModal.data.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Payment ID</p>
                        <p className="font-semibold text-gray-800">{viewDetailsModal.data.paymentId}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">User Name</p>
                        <p className="font-semibold text-gray-800">{viewDetailsModal.data.userName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">User Email</p>
                        <p className="font-semibold text-gray-800">{viewDetailsModal.data.userEmail || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">User Phone</p>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <p className="font-semibold text-gray-800">{viewDetailsModal.data.userPhone || 'N/A'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Court</p>
                        <p className="font-semibold text-gray-800">{viewDetailsModal.data.courtName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Date</p>
                        <p className="font-semibold text-gray-800">
                          {format(new Date(viewDetailsModal.data.date), 'MMMM d, yyyy')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Status</p>
                        {getStatusBadge(viewDetailsModal.data.status)}
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                        <p className="font-semibold text-[#808000]">₹{viewDetailsModal.data.totalAmount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Payment Method</p>
                        <p className="font-semibold text-gray-800 capitalize">{viewDetailsModal.data.paymentMethod || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Payment Status</p>
                        <div className="flex items-center gap-2">
                          {viewDetailsModal.data.paymentStatus === 'paid' ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Paid</span>
                            </>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Time Slots</p>
                      <div className="flex flex-wrap gap-2">
                        {viewDetailsModal.data.slots.map((slot: any) => (
                          <span key={slot.id} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                            {slot.time}
                          </span>
                        ))}
                      </div>
                    </div>
                    {viewDetailsModal.data.paymentMethod === 'onsite' && viewDetailsModal.data.paymentStatus === 'pending' && viewDetailsModal.data.status !== 'cancelled' && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <button
                          onClick={() => {
                            handleMarkPaid(viewDetailsModal.data.id);
                            setViewDetailsModal(null);
                          }}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          Mark Payment Successful
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Subscription ID</p>
                        <p className="font-semibold text-gray-800">{viewDetailsModal.data.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Payment ID</p>
                        <p className="font-semibold text-gray-800">{viewDetailsModal.data.paymentId}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">User Name</p>
                        <p className="font-semibold text-gray-800">{viewDetailsModal.data.userName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">User Email</p>
                        <p className="font-semibold text-gray-800">{viewDetailsModal.data.userId}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">User Phone</p>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <p className="font-semibold text-gray-800">{viewDetailsModal.data.userPhone || 'N/A'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Court</p>
                        <p className="font-semibold text-gray-800">{viewDetailsModal.data.court}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Time Slot</p>
                        <p className="font-semibold text-gray-800">{viewDetailsModal.data.timeSlot}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Start Date</p>
                        <p className="font-semibold text-gray-800">
                          {format(new Date(viewDetailsModal.data.startDate), 'MMMM d, yyyy')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">End Date</p>
                        <p className="font-semibold text-gray-800">
                          {format(new Date(viewDetailsModal.data.endDate), 'MMMM d, yyyy')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Weekdays Count</p>
                        <p className="font-semibold text-gray-800">{viewDetailsModal.data.weekdaysCount} days</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Status</p>
                        {getStatusBadge(viewDetailsModal.data.status)}
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Amount</p>
                        <p className="font-semibold text-[#808000]">₹{viewDetailsModal.data.amount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Payment Method</p>
                        <p className="font-semibold text-gray-800 capitalize">{viewDetailsModal.data.paymentMethod || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Payment Status</p>
                        <div className="flex items-center gap-2">
                          {viewDetailsModal.data.paymentStatus === 'paid' ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Paid</span>
                            </>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {viewDetailsModal.data.status === 'paused' && (
                      <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-sm text-orange-800">
                          <strong>Paused Since:</strong> {viewDetailsModal.data.pausedAt ? format(new Date(viewDetailsModal.data.pausedAt), 'MMMM d, yyyy') : 'N/A'}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <div className="p-6 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {viewDetailsModal.type === 'booking'
                    && getEffectiveBookingStatus(viewDetailsModal.data) === 'upcoming'
                    && viewDetailsModal.data.status !== 'cancelled' && (
                    <button
                      onClick={() => handleDeleteBookingFromDetails(viewDetailsModal.data.id)}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                    >
                      Cancel Booking
                    </button>
                  )}
                  {viewDetailsModal.type === 'subscription' && (
                    <>
                      {viewDetailsModal.data.paymentMethod === 'onsite' && viewDetailsModal.data.paymentStatus === 'pending' && viewDetailsModal.data.status !== 'cancelled' && (
                        <button
                          onClick={() => void handleMarkSubscriptionPaid(viewDetailsModal.data.id)}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                        >
                          Mark as Paid
                        </button>
                      )}
                      
                      {viewDetailsModal.data.status === 'active' && (
                        <button
                          onClick={() => {
                            handlePauseSubscription(viewDetailsModal.data.id);
                            setViewDetailsModal(null);
                          }}
                          className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                        >
                          <Pause className="w-4 h-4" />
                          Pause
                        </button>
                      )}
                      
                      {viewDetailsModal.data.status === 'paused' && (
                        <button
                          onClick={() => {
                            handleResumeSubscription(viewDetailsModal.data.id);
                            setViewDetailsModal(null);
                          }}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Resume
                        </button>
                      )}
                      
                      {viewDetailsModal.data.status !== 'cancelled' && (
                        <button
                          onClick={() => {
                            setViewDetailsModal(null);
                            setConfirmDialog({ type: 'subscription', id: viewDetailsModal.data.id });
                          }}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                        >
                          Cancel
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
                  <div />

                  <Button onClick={() => setViewDetailsModal(null)}>
                    Close
                  </Button>
                </div>
            </div>
          </div>
        )}

        {/* Create Booking Modal */}
        <CreateBookingModal
          isOpen={createBookingModal}
          onClose={() => setCreateBookingModal(false)}
          onCreate={handleCreateBooking}
          existingBookings={bookings}
          existingSubscriptions={subscriptions}
        />

        {/* Create Subscription Modal */}
        <CreateSubscriptionModal
          isOpen={createSubscriptionModal}
          onClose={() => setCreateSubscriptionModal(false)}
          onCreate={handleCreateSubscription}
        />

        {/* Confirmation Dialog */}
        {confirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Confirm Cancellation</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to cancel this {confirmDialog.type}? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCancel}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};
