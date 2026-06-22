import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { CreditCard, Lock, ArrowLeft, Building2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/Button';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { showSuccessToast } from '../../utils/notificationHelpers';
import { isValidPhoneNumber } from '../../../utils/emailValidation';

export const PaymentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedSlots, createBooking, getTotalAmount, appSettings, bookings, subscriptions, courtBlocks } = useBooking();
  const bookingDisabled = Boolean(appSettings.bookingDisabled);
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [processing, setProcessing] = useState(false);
  const venueName = typeof appSettings.landing?.venueName === 'string' && appSettings.landing.venueName.trim()
    ? appSettings.landing.venueName.trim()
    : appSettings.courts[0] || '';
  const hasMobileNumber = Boolean(user?.phone && isValidPhoneNumber(user.phone));

  useEffect(() => {
    if (user && !hasMobileNumber) {
      navigate('/user/profile', { state: { from: location.pathname } });
    }
  }, [hasMobileNumber, location.pathname, navigate, user]);

  const normalizeTimeSlot = (timeSlot: string) => {
    const [startPart, endPart] = timeSlot.split(' - ').map(part => part.trim());

    if (endPart) {
      return `${startPart} - ${endPart}`;
    }

    const startMatch = startPart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!startMatch) {
      return timeSlot;
    }

    const startHour = Number(startMatch[1]);
    const meridiem = startMatch[3].toUpperCase();
    let hour24 = startHour % 12;

    if (meridiem === 'PM') {
      hour24 += 12;
    }

    const endHour24 = (hour24 + 1) % 24;
    const endMeridiem = endHour24 >= 12 ? 'PM' : 'AM';
    const endHour12 = endHour24 % 12 || 12;

    return `${startPart} - ${endHour12}:00 ${endMeridiem}`;
  };

  const getSelectedSlotConflictMessage = (slot: { date: string; court: number; time: string }) => {
    const humanDate = format(new Date(slot.date), 'MMM d, yyyy');
    const normalizedTime = normalizeTimeSlot(slot.time);

    const bookingConflict = bookings.some(booking => {
      if (booking.status === 'cancelled') {
        return false;
      }

      return booking.slots.some(existingSlot => (
        existingSlot.date === slot.date
        && existingSlot.court === slot.court
        && normalizeTimeSlot(existingSlot.time) === normalizedTime
      ));
    });

    if (bookingConflict) {
      return `Slot ${slot.time} on ${humanDate} is already booked.`;
    }

    const blockedByCourtBlock = courtBlocks.some(block => {
      if (block.date !== slot.date) {
        return false;
      }

      const courtMatches = block.allCourts || block.courts.includes(slot.court);
      if (!courtMatches) {
        return false;
      }

      if (block.blockType === 'day') {
        return true;
      }

      return normalizeTimeSlot(block.timeSlot || '') === normalizedTime;
    });

    if (blockedByCourtBlock) {
      return `Slot ${slot.time} on ${humanDate} is blocked by an admin court block.`;
    }

    const blockedBySubscription = subscriptions.some(subscription => {
      if (subscription.status !== 'active') {
        return false;
      }

      if (subscription.court !== slot.court) {
        return false;
      }

      if (normalizeTimeSlot(subscription.timeSlot) !== normalizedTime) {
        return false;
      }

      const selectedDate = new Date(slot.date);
      const startDate = new Date(`${subscription.startDate}T12:00:00`);
      const endDate = new Date(`${subscription.endDate}T12:00:00`);

      if (selectedDate < startDate || selectedDate > endDate) {
        return false;
      }

      const day = selectedDate.getDay();
      return day !== 0 && day !== 6;
    });

    if (blockedBySubscription) {
      return `Slot ${slot.time} on ${humanDate} is blocked by an active subscription.`;
    }

    return null;
  };

  const blockedSelectedSlots = useMemo(() => {
    return selectedSlots
      .map(slot => ({
        slot,
        message: getSelectedSlotConflictMessage(slot),
      }))
      .filter((item): item is { slot: typeof selectedSlots[number]; message: string } => Boolean(item.message));
  }, [bookings, courtBlocks, selectedSlots, subscriptions]);

  const firstBlockingMessage = blockedSelectedSlots[0]?.message || '';

  // Use useEffect to handle navigation during render
  useEffect(() => {
    if (selectedSlots.length === 0) {
      navigate('/user/booking');
    }
  }, [selectedSlots.length, navigate]);

  // Return early if no slots to prevent rendering with empty data
  if (selectedSlots.length === 0) {
    return null;
  }

  const subtotal = getTotalAmount();
  const total = subtotal;

  const createBookingRecord = async () => {
    const booking = await createBooking({
      courtName: venueName,
      date: selectedSlots[0].date,
      slots: selectedSlots,
      totalAmount: subtotal,
      status: 'upcoming',
      paymentId: `ONSITE-${Date.now()}`,
      paymentMethod: 'onsite',
      paymentStatus: 'pending',
      userName: user?.name,
      userEmail: user?.email,
      userPhone: user?.phone,
    });

    addNotification({
      type: 'success',
      title: 'Booking Reserved!',
      message: `Your court has been reserved for ${format(new Date(selectedSlots[0].date), 'MMM d, yyyy')}. Pay at the venue to confirm payment. Booking ID: ${booking.id}`,
      action: {
        label: 'View Booking',
        onClick: () => navigate('/user/history'),
      },
    });

    navigate('/user/booking-confirmation');
  };

  const handlePayment = async () => {
    if (bookingDisabled) {
      return;
    }

    if (user && !hasMobileNumber) {
      navigate('/user/profile', { state: { from: location.pathname } });
      return;
    }

    if (blockedSelectedSlots.length > 0) {
      addNotification({
        type: 'error',
        title: 'Slot unavailable',
        message: firstBlockingMessage || 'One or more selected slots are no longer available.',
      });
      return;
    }

    setProcessing(true);
    
    try {
      await createBookingRecord();
      showSuccessToast('Online payments are temporarily closed. Your booking was reserved for pay-at-venue.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Booking Failed';
      addNotification({
        type: 'error',
        title: 'Booking Not Available',
        message,
      });
      navigate('/user/booking');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
        <button
          onClick={() => navigate('/user/booking')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 md:mb-6 text-sm md:text-base"
        >
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
          Back to Booking
        </button>

        <div className="mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Payment</h1>
          <p className="text-sm md:text-base text-gray-600">Online payments are temporarily closed. Please reserve your slot and pay at the venue.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          {/* Booking Summary */}
          <GlassCard className="p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-4">Booking Summary</h2>
            
            <div className="space-y-3 mb-6">
              <div>
                <p className="text-xs md:text-sm text-gray-600">Court</p>
                <p className="font-medium text-sm md:text-base">{venueName || 'Loading venue name from Firestore...'}</p>
              </div>
              
              <div>
                <p className="text-xs md:text-sm text-gray-600">Selected Slots</p>
                <div className="mt-2 space-y-2 max-h-48 md:max-h-64 overflow-y-auto">
                  {selectedSlots.map((slot) => (
                    <div key={slot.id} className="flex justify-between items-center bg-gray-50 p-2 md:p-3 rounded-lg">
                      <div>
                        <p className="font-medium text-xs md:text-sm">Court {slot.court} - {slot.time}</p>
                        <p className="text-[10px] md:text-xs text-gray-600">{format(new Date(slot.date), 'MMM d, yyyy')}</p>
                      </div>
                      <p className="font-semibold text-sm md:text-base">₹{slot.price}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2 md:space-y-3">
              <div className="flex justify-between text-xs md:text-base text-gray-700">
                <span>Subtotal</span>
                <span className="font-medium">₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-lg md:text-2xl font-bold text-gray-800 pt-3 border-t border-gray-200">
                <span>Total Amount</span>
                <span className="text-[#808000]">₹{subtotal}</span>
              </div>
            </div>
          </GlassCard>

          {/* Payment Method - Mock Razorpay */}
          <GlassCard className="p-4 md:p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <CreditCard className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-semibold">Pay at Venue</h2>
                <p className="text-xs md:text-sm text-gray-600">Online payments are temporarily unavailable</p>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-yellow-100 bg-yellow-50 p-4 text-sm text-yellow-900">
              Online checkout is paused for now. Your booking will be reserved for payment at the venue.
            </div>

            {blockedSelectedSlots.length > 0 && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                  <div>
                    <p className="font-semibold text-red-900">Selected slot unavailable</p>
                    <ul className="mt-2 space-y-1 pl-4 list-disc">
                      {blockedSelectedSlots.map(({ slot, message }) => (
                        <li key={slot.id}>{message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Method Selection */}
            <div className="space-y-4 mb-6">
              <button
                type="button"
                className="w-full p-3 md:p-4 rounded-xl border-2 text-left transition-all border-yellow-700 bg-yellow-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-yellow-800" />
                    <span className="font-medium text-sm md:text-base">Pay Onsite</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-900">No online payment</span>
                </div>
                <p className="text-xs md:text-sm text-gray-600">
                  Reserve the court now and pay at the venue. The slot is booked immediately.
                </p>
              </button>
            </div>

            <div className="space-y-3">
              <Button
                variant="primary"
                className="w-full text-sm md:text-base"
                onClick={handlePayment}
                loading={processing}
                disabled={processing || bookingDisabled || blockedSelectedSlots.length > 0}
              >
                {bookingDisabled
                  ? 'Bookings are currently closed for today'
                  : blockedSelectedSlots.length > 0
                  ? 'Resolve slot conflict'
                  : processing
                  ? 'Booking...'
                  : `Book Onsite - ₹${subtotal}`}
              </Button>
              
              <div className="flex items-center justify-center gap-2 text-xs md:text-sm text-gray-500">
                <Lock className="w-3 h-3 md:w-4 md:h-4" />
              </div>
            </div>

            {/* Trust Badges */}
            <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-200">
              <p className="text-[10px] md:text-xs text-gray-500 text-center">
                100% Secure Payment | Instant Confirmation | Easy Refunds
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
  );
};
