import { useEffect, useRef, useState } from 'react';
import { User, Calendar, CreditCard, Mail, Phone as PhoneIcon, CheckCircle, XCircle, Phone, Mail as MailIcon, LogOut, Edit2, Save, X, Camera, Pause } from 'lucide-react';
import { format } from 'date-fns';
import { useLocation, useNavigate } from 'react-router';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { useBooking, getEffectiveBookingStatus, bookingBelongsToUser } from '../../context/BookingContext';
import { showSuccessToast, showErrorToast } from '../../utils/notificationHelpers';
import { isValidPhoneNumber } from '../../../utils/emailValidation';
import { resolveVenueDetails } from '../../lib/venueDetails';
import { formatBookingIdDisplay, getSubscriptionPaymentLabel } from '../../lib/bookingUtils';

export const ProfilePage = () => {
  const { user, logout, updateProfile, uploadProfilePhoto } = useAuth();
  const { bookings, subscriptions, appSettings } = useBooking();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'bookings' | 'subscriptions'>('bookings');
  const [isEditing, setIsEditing] = useState(false);
  const [editedPhone, setEditedPhone] = useState(user?.phone || '');
  const [editedLocation, setEditedLocation] = useState(user?.location || user?.address || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const shouldOpenEditor = Boolean((location.state as { editProfile?: boolean } | null)?.editProfile);

  useEffect(() => {
    setEditedPhone(user?.phone || '');
    setEditedLocation(user?.location || user?.address || '');
  }, [user?.phone, user?.location, user?.address]);
  useEffect(() => {
    if (shouldOpenEditor) {
      setIsEditing(true);
    }
  }, [shouldOpenEditor]);

  const { venuePhone: supportPhone, venueEmail: supportEmail } = resolveVenueDetails(appSettings.landing);

  const userBookings = bookings.filter(booking => bookingBelongsToUser(booking, user));

  const userSubscriptions = subscriptions.filter(subscription => {
    if (user?.id && subscription.userId === user.id) {
      return true;
    }

    const subscriptionEmail = subscription.userEmail?.trim().toLowerCase();
    const userEmail = user?.email?.trim().toLowerCase();
    return Boolean(subscriptionEmail && userEmail && subscriptionEmail === userEmail);
  });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handlePhotoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setIsUploadingPhoto(true);
    try {
      await uploadProfilePhoto(file);
      showSuccessToast('Success', 'Profile photo updated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload profile photo';
      showErrorToast('Error', message);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      showErrorToast('Error', 'Please sign in again');
      return;
    }

    const normalizedPhone = editedPhone.trim();
    if (normalizedPhone && !isValidPhoneNumber(normalizedPhone)) {
      showErrorToast('Invalid phone number', 'Please enter a valid mobile number before continuing.');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        phone: normalizedPhone,
        location: editedLocation.trim(),
      });

      showSuccessToast('Success', 'Profile updated successfully');
      setIsEditing(false);
      const returnTo = typeof (location.state as { from?: string } | null)?.from === 'string'
        ? (location.state as { from?: string }).from
        : '';
      if (returnTo) {
        navigate(returnTo);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      showErrorToast('Error', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">My Profile</h1>
          <p className="text-sm md:text-base text-gray-600">Manage your account and view booking history</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          {/* User Info Card */}
          <GlassCard className="p-4 md:p-6 lg:col-span-1 h-fit">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                {user?.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.name}
                    className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-yellow-600"
                  />
                ) : (
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-yellow-700 to-yellow-600 rounded-full flex items-center justify-center">
                    <User className="w-10 h-10 md:w-12 md:h-12 text-white" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#808000] text-white flex items-center justify-center shadow-lg hover:bg-[#5D5E1F] transition-colors disabled:opacity-60"
                  title="Upload profile photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>
              {isUploadingPhoto && (
                <p className="text-xs text-gray-500 mb-2">Uploading photo...</p>
              )}
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-1">{user?.name || 'User Name'}</h2>
              <p className="text-sm text-gray-600 mb-4 capitalize">{user?.role || 'User'} Account</p>

              {!isEditing ? (
                <div className="w-full space-y-3 text-left">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-600">Email</p>
                      <p className="text-sm font-medium text-gray-800 truncate">{user?.email || 'user@example.com'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-600">Phone</p>
                      <p className="text-sm font-medium text-gray-800">{user?.phone || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <MailIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-600">Location</p>
                      <p className="text-sm font-medium text-gray-800">{user?.location || user?.address || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-3 text-left">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-600">Email</p>
                      <p className="text-sm font-medium text-gray-800 truncate">{user?.email || 'user@example.com'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Phone</label>
                    <input
                      type="tel"
                      value={editedPhone}
                      onChange={(e) => setEditedPhone(e.target.value)}
                      placeholder="Enter your phone number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-600 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Location</label>
                    <input
                      type="text"
                      value={editedLocation}
                      onChange={(e) => setEditedLocation(e.target.value)}
                      placeholder="Enter your location"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-600 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div className="w-full mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-[#808000]">{userBookings.length}</p>
                    <p className="text-xs text-gray-600">Total Bookings</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{userSubscriptions.filter(s => s.status === 'active').length}</p>
                    <p className="text-xs text-gray-600">Active Plans</p>
                  </div>
                </div>
              </div>

              <div className="w-full mt-6 pt-6 border-t border-gray-200">
                {!isEditing ? (
                  <div className="space-y-2">
                    <Button
                      onClick={() => setIsEditing(true)}
                      className="w-full px-4 py-3 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <Edit2 className="w-4 h-4 inline mr-2" />
                      Edit Profile
                    </Button>
                    <Button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 rounded-lg font-medium bg-red-500 text-white hover:bg-red-600"
                    >
                      <LogOut className="w-4 h-4 inline mr-2" />
                      Logout
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={isSaving || isUploadingPhoto}
                      className="w-full px-4 py-3 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4 inline mr-2" />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditing(false);
                        setEditedPhone(user?.phone || '');
                        setEditedLocation(user?.location || user?.address || '');
                      }}
                      className="w-full px-4 py-3 rounded-lg font-medium bg-gray-400 text-white hover:bg-gray-500"
                    >
                      <X className="w-4 h-4 inline mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Bookings & Subscriptions */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('bookings')}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'bookings'
                    ? 'bg-[#808000] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                Booking History
              </button>
              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'subscriptions'
                    ? 'bg-[#808000] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CreditCard className="w-4 h-4 inline mr-2" />
                Subscriptions
              </button>
            </div>

            {/* Booking History */}
            {activeTab === 'bookings' && (
              <GlassCard className="p-4 md:p-6">
                <h3 className="text-lg md:text-xl font-semibold mb-4">Booking History</h3>
                {userBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">No bookings yet</p>
                    <p className="text-sm text-gray-500">Your booking history will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userBookings.map((booking) => {
                      // Get time slot range from slots
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
                        return 'Court';
                      };

                      const effectiveStatus = getEffectiveBookingStatus(booking);
                      const paymentLabel =
                        effectiveStatus === 'completed'
                          ? 'Paid'
                          : effectiveStatus === 'cancelled'
                            ? 'Cancelled'
                            : 'Pending';

                      return (
                        <div
                          key={booking.id}
                          className="border-2 border-gray-200 rounded-xl p-4 md:p-6 hover:shadow-lg transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-800">{getCourtName()}</h4>
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  effectiveStatus === 'upcoming'
                                    ? 'bg-blue-100 text-blue-700'
                                    : effectiveStatus === 'completed'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500" title={booking.id}>
                                ID: {formatBookingIdDisplay(booking.id)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-[#808000]">₹{booking.totalAmount}</p>
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3 mb-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-600 mb-1">Date</p>
                              <p className="text-sm font-semibold text-gray-800">
                                {format(new Date(booking.date), 'MMM dd, yyyy')}
                              </p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-600 mb-1">Time Slot</p>
                              <p className="text-sm font-semibold text-gray-800">{getTimeSlotRange()}</p>
                            </div>
                          </div>

                          <div className="flex justify-end text-xs text-gray-600 pt-3 border-t border-gray-200">
                            <span className="font-medium">{paymentLabel}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>
            )}

            {/* Subscription Details */}
            {activeTab === 'subscriptions' && (
              <>
                {/* Cancellation Info Banner */}
                <GlassCard className="p-4 mb-4 bg-gradient-to-r from-blue-50 to-yellow-50 border-l-4 border-[#808000]">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-[#808000] rounded-full flex items-center justify-center flex-shrink-0">
                      <Phone className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 mb-1 text-sm md:text-base">Need to Cancel a Subscription?</h4>
                      <p className="text-xs md:text-sm text-gray-600 mb-2">
                        Please contact our support team to request a cancellation.
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs md:text-sm">
                        <a 
                          href={supportPhone ? `tel:${supportPhone}` : '#'} 
                          className="flex items-center gap-1 text-[#808000] hover:text-[#5D5E1F] font-medium"
                        >
                          <Phone className="w-3 h-3 md:w-4 md:h-4" />
                          {supportPhone || 'support phone unavailable'}
                        </a>
                        <a 
                          href={supportEmail ? `mailto:${supportEmail}` : '#'} 
                          className="flex items-center gap-1 text-[#808000] hover:text-[#5D5E1F] font-medium"
                        >
                          <MailIcon className="w-3 h-3 md:w-4 md:h-4" />
                          {supportEmail || 'support email unavailable'}
                        </a>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="p-4 md:p-6">
                  <h3 className="text-lg md:text-xl font-semibold mb-4">Subscription Plans</h3>
                  {userSubscriptions.length === 0 ? (
                    <div className="text-center py-12">
                      <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600">No active subscriptions</p>
                      <p className="text-sm text-gray-500">Subscribe to get fixed court bookings</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {userSubscriptions.map((sub) => {
                        const paymentLabel = getSubscriptionPaymentLabel(sub);

                        return (
                        <div
                          key={sub.id}
                          className="border-2 border-gray-200 rounded-xl p-4 md:p-6 hover:shadow-lg transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-800">Monthly Subscription</h4>
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    sub.status === 'active'
                                      ? 'bg-green-100 text-green-700'
                                      : sub.status === 'paused'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : sub.status === 'cancelled'
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {sub.status === 'active' ? (
                                    <span className="flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" /> Active
                                    </span>
                                    ) : sub.status === 'paused' ? (
                                      <span className="flex items-center gap-1">
                                        <Pause className="w-3 h-3" /> Paused
                                      </span>
                                    ) : sub.status === 'cancelled' ? (
                                      <span className="flex items-center gap-1">
                                        <XCircle className="w-3 h-3" /> Cancelled
                                      </span>
                                  ) : (
                                    <span className="flex items-center gap-1">
                                      <XCircle className="w-3 h-3" /> Expired
                                    </span>
                                  )}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500" title={sub.id}>
                                ID: {formatBookingIdDisplay(sub.id)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-[#808000]">₹{sub.amount}</p>
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3 mb-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-600 mb-1">Subscription Period</p>
                              <p className="text-sm font-semibold text-gray-800">
                                {format(new Date(sub.startDate), 'MMM dd')} - {format(new Date(sub.endDate), 'MMM dd, yyyy')}
                              </p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-600 mb-1">Weekdays Count</p>
                              <p className="text-sm font-semibold text-[#808000]">{sub.weekdaysCount} days</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-600 mb-1">Court</p>
                              <p className="text-sm font-semibold text-gray-800">{sub.courtName}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-600 mb-1">Time Slot</p>
                              <p className="text-sm font-semibold text-gray-800">{sub.timeSlot}</p>
                            </div>
                          </div>

                          <div className="flex justify-end text-xs text-gray-600 pt-3 border-t border-gray-200">
                            <span className="font-medium">{paymentLabel}</span>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </GlassCard>
              </>
            )}
          </div>
        </div>
      </div>
  );
};
