import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Trash2, Users } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/Button';
import { getAPI_BASE_URL } from '../../lib/apiConfig';
import { getAuthAccessToken } from '../../lib/authToken';
import { useAuth } from '../../context/AuthContext';
import { useBooking, getEffectiveBookingStatus } from '../../context/BookingContext';
import type { Booking } from '../../context/BookingContext';
import { format } from 'date-fns';
import { showErrorToast, showSuccessToast } from '../../utils/notificationHelpers';

const normalizePhoneDigits = (phone?: string | null) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  return digits.length > 10 ? digits.slice(-10) : digits;
};

const bookingBelongsToAdminUser = (booking: Booking, adminUser: AdminUser) => {
  if (adminUser.id && booking.userId && booking.userId === adminUser.id) {
    return true;
  }

  const bookingEmail = booking.userEmail?.trim().toLowerCase();
  const userEmail = adminUser.email?.trim().toLowerCase();
  if (bookingEmail && userEmail && bookingEmail === userEmail) {
    return true;
  }

  const bookingPhone = normalizePhoneDigits(booking.userPhone);
  const userPhone = normalizePhoneDigits(adminUser.phone);
  return Boolean(bookingPhone && userPhone && bookingPhone === userPhone);
};

type BookingStats = {
  total: number;
  completed: number;
  upcoming: number;
  cancelled: number;
};

type SubscriptionStats = {
  total: number;
  active: number;
  expired: number;
  cancelled: number;
  paused: number;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: string;
  status: string;
  bookings: number;
  bookingStats?: BookingStats;
  subscriptions?: number;
  subscriptionStats?: SubscriptionStats;
  joinedAt: string;
  updatedAt?: string;
};

export const AdminUsers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bookings } = useBooking();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [refreshingUserId, setRefreshingUserId] = useState<string | null>(null);

  const loadUsers = async (active?: { current: boolean }) => {
    if (!user) {
      setUsers([]);
      return;
    }

    setLoading(true);

    try {
      const token = await getAuthAccessToken();
      if (!token) {
        throw new Error('Please sign in again to view users');
      }

      const response = await fetch(`${getAPI_BASE_URL()}/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to load users');
      }

      if (!active || active.current) {
        const loadedUsers = Array.isArray(payload?.users) ? payload.users : [];
        setUsers(loadedUsers.filter((item: AdminUser) => item.role !== 'admin'));
      }
    } catch (error) {
      if (!active || active.current) {
        setUsers([]);
        const message = error instanceof Error ? error.message : 'Unable to load users';
        showErrorToast('User management unavailable', message);
      }
    } finally {
      if (!active || active.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const active = { current: true };

    void loadUsers(active);

    return () => {
      active.current = false;
    };
  }, [user]);

  const refreshUserDetails = async (targetUser: AdminUser) => {
    setSelectedUser(targetUser);
    setRefreshingUserId(targetUser.id);

    try {
      const token = await getAuthAccessToken();
      if (!token) {
        throw new Error('Please sign in again to view users');
      }

      const response = await fetch(`${getAPI_BASE_URL()}/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to refresh user details');
      }

      const loadedUsers = Array.isArray(payload?.users) ? payload.users : [];
      const visibleUsers = loadedUsers.filter((item: AdminUser) => item.role !== 'admin');
      setUsers(visibleUsers);

      const freshUser = visibleUsers.find((item) => item.id === targetUser.id);
      if (freshUser) {
        setSelectedUser(freshUser);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh user details';
      showErrorToast('Could not refresh counts', message);
    } finally {
      setRefreshingUserId(null);
    }
  };

  const handleDeleteUser = async (targetUser: AdminUser) => {
    const confirmed = window.confirm(
      `Delete ${targetUser.name} (${targetUser.email})?\n\nThis will permanently remove their account, bookings, and subscriptions.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingUserId(targetUser.id);

    try {
      const token = await getAuthAccessToken();
      if (!token) {
        throw new Error('Please sign in again to delete users');
      }

      const response = await fetch(`${getAPI_BASE_URL()}/admin/users/${targetUser.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to delete user');
      }

      setUsers((prev) => prev.filter((item) => item.id !== targetUser.id));
      if (selectedUser?.id === targetUser.id) {
        setSelectedUser(null);
      }

      showSuccessToast('User deleted', `${targetUser.name} was removed successfully.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete user';
      showErrorToast('Delete failed', message);
    } finally {
      setDeletingUserId(null);
    }
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((item) => item.status === 'Active' || item.status === 'Subscriber').length;
  const subscribers = users.filter((item) => item.status === 'Subscriber').length;

  const getBookingStats = (adminUser: AdminUser): BookingStats => {
    const userBookings = bookings.filter((booking) => bookingBelongsToAdminUser(booking, adminUser));

    if (userBookings.length > 0) {
      const stats: BookingStats = {
        total: userBookings.length,
        completed: 0,
        upcoming: 0,
        cancelled: 0,
      };

      for (const booking of userBookings) {
        const status = getEffectiveBookingStatus(booking);
        if (status === 'completed') {
          stats.completed += 1;
        } else if (status === 'cancelled') {
          stats.cancelled += 1;
        } else {
          stats.upcoming += 1;
        }
      }

      return stats;
    }

    return adminUser.bookingStats ?? {
      total: adminUser.bookings ?? 0,
      completed: 0,
      upcoming: adminUser.bookings ?? 0,
      cancelled: 0,
    };
  };

  const getSubscriptionStats = (adminUser: AdminUser): SubscriptionStats =>
    adminUser.subscriptionStats ?? {
      total: adminUser.subscriptions ?? 0,
      active: adminUser.subscriptions ?? 0,
      expired: 0,
      cancelled: 0,
      paused: 0,
    };

  const displayedUser = selectedUser
    ? users.find((item) => item.id === selectedUser.id) ?? selectedUser
    : null;

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 text-sm md:text-base"
        >
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
          Back to Dashboard
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">User Management</h1>
          <p className="text-gray-600">View registered users, subscription status, and account activity.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <GlassCard className="p-6">
            <p className="text-green-900 text-sm font-medium mb-2">Total Users</p>
            <p className="text-3xl font-bold text-gray-800">{totalUsers.toLocaleString()}</p>
            <p className="text-xs text-blue-600 mt-2">Live users from database</p>
          </GlassCard>
          <GlassCard className="p-6">
            <p className="text-green-900 text-sm font-medium mb-2">Active Users</p>
            <p className="text-3xl font-bold text-gray-800">{activeUsers.toLocaleString()}</p>
            <p className="text-xs text-green-900 mt-2">Registered and active users</p>
          </GlassCard>
          <GlassCard className="p-6">
            <p className="text-purple-600 text-sm font-medium mb-2">Subscribers</p>
            <p className="text-3xl font-bold text-gray-800">{subscribers.toLocaleString()}</p>
            <p className="text-xs text-purple-600 mt-2">Users with active subscriptions</p>
          </GlassCard>
        </div>

        <GlassCard className="p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">All Users</h2>
                <p className="text-sm text-gray-600">Currently registered accounts in the system.</p>
              </div>
            </div>

            <div />
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-600">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-600">No users found in the database.</div>
            ) : (
              users.map((adminUser) => (
                <div key={adminUser.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-900 to-green-800 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {adminUser.name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{adminUser.name}</p>
                      <p className="text-sm text-gray-600 truncate">{adminUser.email}</p>
                      {adminUser.phone && <p className="text-xs text-gray-500 truncate">{adminUser.phone}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="secondary" onClick={() => void refreshUserDetails(adminUser)}>
                      View Details
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => void handleDeleteUser(adminUser)}
                      disabled={deletingUserId === adminUser.id}
                      loading={deletingUserId === adminUser.id}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      {displayedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">User Details</h2>
                <p className="text-sm text-gray-600">
                  {refreshingUserId === displayedUser.id ? 'Refreshing live counts...' : 'Review account and activity information'}
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close user details"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-900 to-green-800 rounded-full flex items-center justify-center text-white text-lg font-semibold">
                  {displayedUser.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-semibold text-gray-800 truncate">{displayedUser.name}</h3>
                  <p className="text-gray-600 truncate">{displayedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Phone</p>
                  <p className="mt-1 font-medium text-gray-800">{displayedUser.phone || 'Not provided'}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Subscriptions</p>
                  <p className="mt-1 font-medium text-gray-800">
                    {getSubscriptionStats(displayedUser).active} active / {getSubscriptionStats(displayedUser).total} total
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Joined</p>
                  <p className="mt-1 font-medium text-gray-800">{format(new Date(displayedUser.joinedAt), 'dd MMM yyyy')}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Last updated</p>
                  <p className="mt-1 font-medium text-gray-800">
                    {displayedUser.updatedAt ? format(new Date(displayedUser.updatedAt), 'dd MMM yyyy, h:mm a') : 'Not available'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-800 mb-3">Booking Summary</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Bookings', value: getBookingStats(displayedUser).total, className: 'border-gray-200 bg-gray-50 text-gray-800' },
                    { label: 'Completed Bookings', value: getBookingStats(displayedUser).completed, className: 'border-[#808000]/20 bg-[#808000]/5 text-[#808000]' },
                    { label: 'Upcoming Bookings', value: getBookingStats(displayedUser).upcoming, className: 'border-blue-200 bg-blue-50 text-blue-700' },
                    { label: 'Cancelled Bookings', value: getBookingStats(displayedUser).cancelled, className: 'border-red-200 bg-red-50 text-red-600' },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-xl border p-4 ${item.className}`}>
                      <p className="text-[11px] uppercase tracking-wide opacity-80">{item.label}</p>
                      <p className="mt-2 text-3xl font-bold">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="danger"
                  onClick={() => void handleDeleteUser(displayedUser)}
                  disabled={deletingUserId === displayedUser.id || refreshingUserId === displayedUser.id}
                  loading={deletingUserId === displayedUser.id}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete User
                </Button>
                <Button variant="secondary" onClick={() => setSelectedUser(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
