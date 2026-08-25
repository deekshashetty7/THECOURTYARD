import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Calendar as CalendarIcon, Clock, MapPin, CreditCard, CheckCircle, AlertCircle, CalendarDays, Building2 } from 'lucide-react';
import { format, addDays, isWeekend, eachDayOfInterval, parse } from 'date-fns';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/Button';
import { DatePickerField } from '../../components/DatePickerField';
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../context/BookingContext';
import { showSuccessToast, showErrorToast } from '../../utils/notificationHelpers';
import { isValidPhoneNumber } from '../../../utils/emailValidation';

export const SubscriptionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { appSettings, courtBlocks, bookings, subscriptions, createSubscription } = useBooking();
  const bookingDisabled = Boolean(appSettings.bookingDisabled);
  const [step, setStep] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [selectedCourt, setSelectedCourt] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paymentMethod] = useState<'onsite'>('onsite');
  const [dateError, setDateError] = useState('');

  const subscriptionPrice = appSettings.pricing.subscription || 2500;
  const courts = appSettings.courts.length ? appSettings.courts : ['Court 1', 'Court 2', 'Court 3'];
  const hasMobileNumber = Boolean(user?.phone && isValidPhoneNumber(user.phone));
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = appSettings.operatingHours.startHour; hour <= appSettings.operatingHours.endHour; hour += 1) {
      const formatHour = (value: number) => {
        const period = value >= 12 ? 'PM' : 'AM';
        const displayHour = value % 12 || 12;
        return `${displayHour}:00 ${period}`;
      };

      slots.push(`${formatHour(hour)} - ${formatHour(hour + 1)}`);
    }
    return slots;
  }, [appSettings.operatingHours.endHour, appSettings.operatingHours.startHour]);

  useEffect(() => {
    if (user && !hasMobileNumber) {
      navigate('/user/profile', { state: { from: location.pathname } });
    }
  }, [hasMobileNumber, location.pathname, navigate, user]);

  const calculateEndDate = (start: string) => {
    if (!start) return '';
    const startDateObj = new Date(start);
    const endDateObj = addDays(startDateObj, 29); // 30 days total
    return format(endDateObj, 'yyyy-MM-dd');
  };

  const calculateWeekdays = () => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const end = new Date(calculateEndDate(startDate));
    const days = eachDayOfInterval({ start, end });
    return days.filter(day => !isWeekend(day)).length;
  };

  const getSubscriptionDates = () => {
    if (!startDate) {
      return [] as string[];
    }

    const start = new Date(startDate);
    const end = new Date(calculateEndDate(startDate));
    const days = eachDayOfInterval({ start, end });

    return days
      .filter(day => !isWeekend(day))
      .map(day => format(day, 'yyyy-MM-dd'));
  };

  const subscriptionDates = useMemo(getSubscriptionDates, [startDate]);
  const selectedCourtNumber = selectedCourt ? Number(selectedCourt.replace('Court ', '')) : 0;

  const conflictingDates = useMemo(() => {
    if (!startDate || !selectedCourtNumber || !selectedTimeSlot) {
      return [] as string[];
    }

    return subscriptionDates.filter(date => bookings.some(booking => {
      if (booking.status === 'cancelled') {
        return false;
      }

      return booking.slots.some(slot => slot.date === date && slot.court === selectedCourtNumber && slot.time === selectedTimeSlot);
    }) || subscriptions.some(subscription => {
      if (subscription.status !== 'active') {
        return false;
      }

      if (subscription.court !== selectedCourtNumber) {
        return false;
      }

      if (subscription.timeSlot !== selectedTimeSlot) {
        return false;
      }

      return date >= subscription.startDate && date <= subscription.endDate;
    }));
  }, [bookings, selectedCourtNumber, selectedTimeSlot, subscriptionDates, startDate, subscriptions]);

  const blockedDates = useMemo(() => {
    if (!startDate || !selectedCourtNumber || !selectedTimeSlot) {
      return [] as string[];
    }

    return subscriptionDates.filter((date) => courtBlocks.some((block) => {
      if (block.date !== date) {
        return false;
      }

      const courtMatches = block.allCourts || block.courts.includes(selectedCourtNumber);
      if (!courtMatches) {
        return false;
      }

      if (block.blockType === 'day') {
        return true;
      }

      return block.timeSlot === selectedTimeSlot || block.timeSlotKey === selectedTimeSlot;
    }));
  }, [courtBlocks, selectedCourtNumber, selectedTimeSlot, startDate, subscriptionDates]);

  const isSelectedSlotUnavailable = (slot: string) => {
    if (!startDate || !selectedCourtNumber) {
      return false;
    }

    return subscriptionDates.some(date => bookings.some(booking => {
      if (booking.status === 'cancelled') {
        return false;
      }

      return booking.slots.some(existingSlot => existingSlot.date === date && existingSlot.court === selectedCourtNumber && existingSlot.time === slot);
    }) || subscriptions.some(subscription => {
      if (subscription.status !== 'active') {
        return false;
      }

      if (subscription.court !== selectedCourtNumber) {
        return false;
      }

      if (subscription.timeSlot !== slot) {
        return false;
      }

      return date >= subscription.startDate && date <= subscription.endDate;
    }));
  };

  useEffect(() => {
    if (selectedTimeSlot && isSelectedSlotUnavailable(selectedTimeSlot)) {
      setSelectedTimeSlot('');
    }
  }, [selectedCourtNumber, selectedTimeSlot, startDate, subscriptionDates]);

  const handleDateChange = (value: string) => {
    setDateError('');
    
    if (!value) {
      setStartDate('');
      return;
    }

    const selectedDate = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      setDateError('Please select a future date');
      return;
    }
    
    if (isWeekend(selectedDate)) {
      setDateError('Weekend dates are not available. Please select a weekday (Monday - Friday)');
      return;
    }
    
    setStartDate(value);
  };

  const handleSubscribe = async () => {
    if (bookingDisabled) {
      showErrorToast('Bookings paused', 'Bookings are temporarily paused by the admin.');
      return;
    }

    if (!user) {
      navigate('/user/login');
      return;
    }

    if (!hasMobileNumber) {
      navigate('/user/profile', { state: { from: location.pathname } });
      return;
    }

    if (!startDate || !selectedCourt || !selectedTimeSlot) {
      showErrorToast('Incomplete Selection', 'Please select a start date, court, and time slot before subscribing.');
      return;
    }

    if (conflictingDates.length > 0) {
      showErrorToast('Slot Unavailable', `This court and time slot is already booked on ${conflictingDates.length} date(s). Please choose another slot.`);
      return;
    }

    setProcessing(true);

    try {
      const subscription = await createSubscription({
        courtName: selectedCourt,
        court: Number(selectedCourt.replace('Court ', '')),
        timeSlot: selectedTimeSlot,
        startDate,
        endDate: calculateEndDate(startDate),
        weekdaysCount: calculateWeekdays(),
        amount: subscriptionPrice,
        status: 'active',
        paymentId: `ONSITE-${Date.now()}`,
        paymentMethod: 'onsite',
        paymentStatus: 'pending',
        userName: user.name,
        userEmail: user.email,
        userPhone: user.phone,
      });

      console.log('Subscription created:', subscription);

      showSuccessToast('Subscription Reserved', 'Please pay at the venue.');
      if (subscription.confirmationEmailSent === false) {
        showErrorToast('Email Not Sent', 'Your subscription was saved, but the confirmation email could not be sent.');
      }
      navigate('/user/profile');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Subscription could not be completed';
      showErrorToast('Subscription Failed', message);
    } finally {
      setProcessing(false);
    }
  };

  const endDate = calculateEndDate(startDate);
  const weekdaysCount = calculateWeekdays();

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Monthly Subscription</h1>
          <p className="text-sm md:text-base text-gray-600">Subscribe and secure your favorite court & time slot for 30 days</p>
          <p className="text-sm md:text-base text-gray-600">Online payments are temporarily closed. Subscribe and pay at the venue.</p>
        </div>

        {bookingDisabled && (
          <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
            Bookings are currently paused by the admin. Customers cannot create new subscriptions right now.
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-center gap-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s ? 'bg-[#808000] text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {s}
                </div>
                {s < 3 && <div className={`w-12 md:w-20 h-1 ${step > s ? 'bg-[#808000]' : 'bg-gray-200'}`}></div>}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs md:text-sm text-gray-600 max-w-md mx-auto">
            <span>Select Dates</span>
            <span>Choose Court</span>
            <span>Confirm</span>
          </div>
        </div>

        {/* Step 1: Date Selection */}
        {step === 1 && (
          <GlassCard className="p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-[#808000]" />
              Select Start Date
            </h2>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs md:text-sm text-blue-800">
                    <p className="font-medium mb-1">Important Information:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Subscription is valid for 30 days (weekdays only)</li>
                      <li>Saturdays and Sundays are automatically excluded</li>
                      <li>Select a weekday as your start date</li>
                      <li>Same court and time slot for entire subscription period</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <DatePickerField
                  label="Start Date (Weekday Only)"
                  value={startDate}
                  onChange={handleDateChange}
                  minDate={format(new Date(), 'yyyy-MM-dd')}
                  required
                  placeholder="Select start date"
                />
                {dateError && <p className="text-red-500 text-sm mt-1">{dateError}</p>}
              </div>

              {startDate && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Start Date</p>
                      <p className="font-semibold text-gray-800">{format(new Date(startDate), 'MMM dd, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">End Date</p>
                      <p className="font-semibold text-gray-800">{format(new Date(endDate), 'MMM dd, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Days</p>
                      <p className="font-semibold text-gray-800">30 days</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Weekdays Count</p>
                      <p className="font-semibold text-[#808000]">{weekdaysCount} days</p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                className="w-full"
                onClick={() => setStep(2)}
                disabled={!startDate || bookingDisabled}
              >
                Continue to Court Selection
              </Button>
            </div>
          </GlassCard>
        )}

        {/* Step 2: Court & Time Selection */}
        {step === 2 && (
          <GlassCard className="p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#808000]" />
              Select Court & Time Slot
            </h2>

            <div className="space-y-6">
              {/* Court Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Court
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {courts.map((court) => (
                    <button
                      key={court}
                      onClick={() => setSelectedCourt(court)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedCourt === court
                          ? 'border-[#808000] bg-yellow-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <MapPin className={`w-5 h-5 mx-auto mb-2 ${selectedCourt === court ? 'text-[#808000]' : 'text-gray-400'}`} />
                      <p className={`font-medium ${selectedCourt === court ? 'text-[#808000]' : 'text-gray-700'}`}>
                        {court}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slot Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Fixed Time Slot
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => {
                        if (!isSelectedSlotUnavailable(slot)) {
                          setSelectedTimeSlot(slot);
                        }
                      }}
                      disabled={isSelectedSlotUnavailable(slot)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        isSelectedSlotUnavailable(slot)
                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          : selectedTimeSlot === slot
                          ? 'border-[#808000] bg-yellow-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${isSelectedSlotUnavailable(slot) ? 'text-gray-400' : selectedTimeSlot === slot ? 'text-[#808000]' : 'text-gray-400'}`} />
                        <span className={`text-sm font-medium ${isSelectedSlotUnavailable(slot) ? 'text-gray-400' : selectedTimeSlot === slot ? 'text-[#808000]' : 'text-gray-700'}`}>
                          {slot}
                        </span>
                      </div>
                      {isSelectedSlotUnavailable(slot) && (
                        <p className="text-xs text-red-500 mt-1">Booked for selected dates</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {conflictingDates.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-red-700 mb-2">Unavailable Selection</p>
                  <p className="text-sm text-red-600 mb-2">
                    The selected court and time slot is already booked on {conflictingDates.length} date(s) in this subscription period.
                  </p>
                  <p className="text-xs text-red-500">
                    Please choose a different start date, court, or time slot.
                  </p>
                </div>
              )}

              {blockedDates.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-700 mb-2">Admin block detected</p>
                  <p className="text-sm text-blue-600 mb-2">
                    This subscription period includes {blockedDates.length} blocked date(s). Your subscription will be extended automatically.
                  </p>
                  <p className="text-xs text-blue-500">
                    You can continue without changing the selection.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => setStep(3)}
                  disabled={!selectedCourt || !selectedTimeSlot || conflictingDates.length > 0}
                >
                  Continue to Summary
                </Button>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Step 3: Summary & Payment */}
        {step === 3 && (
          <div className="space-y-4">
            <GlassCard className="p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#808000]" />
                Subscription Summary
              </h2>

              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Subscription Period</p>
                    <p className="font-semibold text-gray-800">
                      {format(new Date(startDate), 'MMM dd')} - {format(new Date(endDate), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Weekdays Count</p>
                    <p className="font-semibold text-[#808000]">{weekdaysCount} days</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Court</p>
                    <p className="font-semibold text-gray-800">{selectedCourt}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Time Slot</p>
                    <p className="font-semibold text-gray-800">{selectedTimeSlot}</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Monthly Subscription</span>
                    <span className="font-medium">₹{subscriptionPrice}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <span className="text-lg font-semibold">Total Amount</span>
                    <span className="text-2xl font-bold text-[#808000]">₹{subscriptionPrice}</span>
                  </div>
                </div>

                {conflictingDates.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-700 mb-1">Booking conflict detected</p>
                    <p className="text-sm text-red-600">
                      This subscription cannot be completed because the selected time slot is already booked for some dates in the period.
                    </p>
                  </div>
                )}

                {blockedDates.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-700 mb-1">Blocked dates will be compensated</p>
                    <p className="text-sm text-blue-600">
                      The subscription period includes {blockedDates.length} blocked date(s). The backend will extend the subscription automatically.
                    </p>
                  </div>
                )}
              </div>
            </GlassCard>

            <GlassCard className="p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Payment Method</h3>
                  <p className="text-sm text-gray-600">Choose online or onsite payment</p>
                </div>
                <p className="text-sm text-gray-600">Online payments are temporarily unavailable</p>
              </div>

              <div className="space-y-3 mb-4">
                <div className="w-full p-3 rounded-lg border-2 text-left transition-all border-yellow-700 bg-yellow-50">
                  <p className="font-medium text-gray-800">Pay Onsite</p>
                  <p className="text-xs text-gray-600 mt-1">Reserve now, pay at the venue.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep(2)}
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => void handleSubscribe()}
                    loading={processing}
                    disabled={processing || conflictingDates.length > 0 || bookingDisabled}
                  >
                    {bookingDisabled ? 'Bookings Paused' : processing ? 'Processing...' : `Reserve Onsite - ₹${subscriptionPrice}`}
                  </Button>
                </div>
              </div>
            </GlassCard>
          </div>
        )}
      </div>
  );
};
