import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Calendar as CalendarIcon, Clock, Trash2, LogIn, UserPlus, ChevronDown, AlertTriangle, Phone, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '../../components/ui/calendar';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/Button';
import { useBooking, TimeSlot } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { getAPI_BASE_URL } from '../../lib/apiConfig';
import { motion, AnimatePresence } from 'motion/react';
import { datePickerCalendarClassNames } from '../../components/datePickerStyles';
import { isValidPhoneNumber } from '../../../utils/emailValidation';

const formatHourLabel = (hour: number) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${period}`;
};

const parseSlotStartMinutes = (timeRange: string): number | null => {
  const [start] = timeRange.split(' - ').map(part => part.trim());
  const match = start.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return null;
  }

  let hour = Number(match[1]) % 12;
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === 'PM') {
    hour += 12;
  }

  return (hour * 60) + minutes;
};

const toLocalDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

const isPastTimeSlot = (slot: TimeSlot): boolean => {
  const todayKey = toLocalDateKey(new Date());

  if (slot.date < todayKey) {
    return true;
  }

  if (slot.date > todayKey) {
    return false;
  }

  const slotStartMinutes = parseSlotStartMinutes(slot.time);
  if (slotStartMinutes === null) {
    return false;
  }

  const now = new Date();
  const nowMinutes = (now.getHours() * 60) + now.getMinutes();
  return slotStartMinutes <= nowMinutes;
};

// Generate time slots from 5 AM to 11 PM
const generateTimeSlots = (
  date: Date,
  court: number,
  pricing: { offPeak: number; peak: number },
  operatingHours: { startHour: number; endHour: number }
): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const dateStr = toLocalDateKey(date);
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  for (let hour = operatingHours.startHour; hour <= operatingHours.endHour; hour++) {
    const slotId = `${dateStr}-${hour}-${court}`;
    const time = `${formatHourLabel(hour)} - ${formatHourLabel(hour + 1)}`;
    const price = isWeekend ? pricing.peak : pricing.offPeak;
    
    slots.push({
      id: slotId,
      time,
      court,
      date: dateStr,
      status: 'available',
      price,
    });
  }
  
  return slots;
};

export const BookingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { appSettings, selectedSlots, addSlot, removeSlot, isSlotBooked, createBooking, bookings, subscriptions, courtBlocks } = useBooking();
  const bookingDisabled = Boolean(appSettings.bookingDisabled);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCourt, setSelectedCourt] = useState(1);
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDraftDate, setCalendarDraftDate] = useState<Date>(new Date());
  const [serverAvailability, setServerAvailability] = useState<TimeSlot[]>([]);
  const [onsiteProcessing, setOnsiteProcessing] = useState(false);
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const venueName = typeof appSettings.landing?.venueName === 'string' && appSettings.landing.venueName.trim()
    ? appSettings.landing.venueName.trim()
    : appSettings.courts[0] || '';
  const hasMobileNumber = Boolean(user?.phone && isValidPhoneNumber(user.phone));

  const timeSlots = generateTimeSlots(selectedDate, selectedCourt, appSettings.pricing, appSettings.operatingHours);
  const courts = appSettings.courts.length ? appSettings.courts : ['Court 1', 'Court 2', 'Court 3'];
  const selectedDateKey = toLocalDateKey(selectedDate);
  const isSelectedDateToday = selectedDateKey === toLocalDateKey(new Date());
  const availableSlotCount = timeSlots.filter((slot) => {
    const pastSlot = isPastTimeSlot(slot);
    const serverBooked = serverAvailability.some(serverSlot => (
      serverSlot.date === slot.date
      && serverSlot.court === slot.court
      && serverSlot.time === slot.time
      && serverSlot.status === 'booked'
    ));
    return !pastSlot && !serverBooked && !isSlotBooked(slot.date, slot.court, slot.time);
  }).length;

  useEffect(() => {
    if (showCalendar) {
      setCalendarDraftDate(selectedDate);
    }
  }, [selectedDate, showCalendar]);

  useEffect(() => {
    let active = true;

    const loadAvailability = async () => {
      try {
        const date = toLocalDateKey(selectedDate);
        const response = await fetch(`${getAPI_BASE_URL()}/availability?date=${date}&court=${selectedCourt}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        if (!active) {
          return;
        }

        setServerAvailability(Array.isArray(payload?.availability) ? payload.availability : []);
      } catch {
        if (active) {
          setServerAvailability([]);
        }
      }
    };

    void loadAvailability();

    return () => {
      active = false;
    };
  }, [selectedDate, selectedCourt]);

  const handleSlotClick = (slot: TimeSlot) => {
    if (bookingDisabled) return;
    if (isPastTimeSlot(slot)) return;
    if (isSlotBooked(slot.date, slot.court, slot.time)) return;
    
    const isSelected = selectedSlots.find(s => s.id === slot.id);
    if (isSelected) {
      removeSlot(slot.id);
    } else {
      addSlot(slot);
    }
  };

  const isSlotSelected = (slotId: string) => {
    return selectedSlots.some(s => s.id === slotId);
  };

  const totalAmount = selectedSlots.reduce((sum, slot) => sum + slot.price, 0);

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

  const blockedSelectedSlots = useMemo(() => {
    return selectedSlots
      .map((slot) => {
        const humanDate = format(new Date(slot.date), 'MMM d, yyyy');
        const normalizedTime = normalizeTimeSlot(slot.time);

        const bookingConflict = bookings.some((booking) => {
          if (booking.status === 'cancelled') {
            return false;
          }

          return booking.slots.some((existingSlot) => (
            existingSlot.date === slot.date
            && existingSlot.court === slot.court
            && normalizeTimeSlot(existingSlot.time) === normalizedTime
          ));
        });

        if (bookingConflict) {
          return { id: slot.id, message: `Slot ${slot.time} on ${humanDate} is already booked.` };
        }

        const blockedByCourtBlock = courtBlocks.some((block) => {
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
          return { id: slot.id, message: `Slot ${slot.time} on ${humanDate} is blocked by an admin court block.` };
        }

        const blockedBySubscription = subscriptions.some((subscription) => {
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
          return { id: slot.id, message: `Slot ${slot.time} on ${humanDate} is blocked by an active subscription.` };
        }

        return null;
      })
      .filter((item): item is { id: string; message: string } => Boolean(item));
  }, [bookings, courtBlocks, selectedSlots, subscriptions]);

  const firstBlockedSlotMessage = blockedSelectedSlots[0]?.message || '';

  const redirectToProfileEdit = () => {
    setShowPhonePrompt(true);
  };

  const handleProceedToPayment = () => {
    if (bookingDisabled) return;
    if (blockedSelectedSlots.length > 0) return;
    if (selectedSlots.length > 0) {
      if (!user) {
        setShowLoginPrompt(true);
      } else if (!hasMobileNumber) {
        redirectToProfileEdit();
      } else {
        navigate('/user/payment');
      }
    }
  };

  const handleBookOnsiteNow = async () => {
    if (bookingDisabled) return;
    if (blockedSelectedSlots.length > 0) {
      addNotification({
        type: 'error',
        title: 'Slot unavailable',
        message: firstBlockedSlotMessage || 'One or more selected slots are no longer available.',
      });
      return;
    }
    if (selectedSlots.length === 0) {
      return;
    }

    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    if (!hasMobileNumber) {
      redirectToProfileEdit();
      return;
    }

    setOnsiteProcessing(true);

    try {
      const booking = await createBooking({
        courtName: venueName,
        date: selectedSlots[0].date,
        slots: selectedSlots,
        totalAmount,
        status: 'upcoming',
        paymentId: `ONSITE-${Date.now()}`,
        paymentMethod: 'onsite',
        paymentStatus: 'pending',
        userName: user.name,
        userEmail: user.email,
        userPhone: user.phone,
      });

      addNotification({
        type: 'success',
        title: 'Booking Reserved!',
        message: `Your court has been reserved for ${format(new Date(selectedSlots[0].date), 'MMM d, yyyy')}. Pay at the venue to confirm payment. Booking ID: ${booking.id}`,
      });

      navigate('/user/booking-confirmation');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create onsite booking';
      addNotification({
        type: 'error',
        title: 'Booking Not Available',
        message,
      });
      alert(message);
    } finally {
      setOnsiteProcessing(false);
    }
  };

  // Simple date picker (previous/next day)
  const handlePreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    if (newDate >= new Date(new Date().setHours(0, 0, 0, 0))) {
      setSelectedDate(newDate);
    }
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  return (
    <>
    <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Book Your Court</h1>
          <p className="text-sm md:text-base text-gray-600">Select date, court, and time slots</p>
        </div>

        {bookingDisabled && (
          <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
            Bookings are currently paused by the admin. You can view availability, but customers cannot create new bookings right now.
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Booking Selection */}
          <div className="lg:col-span-2">
            <GlassCard className="p-4 md:p-6 space-y-6 md:space-y-8">
              {/* Date Selector */}
              <div>
                <div className="flex items-center gap-2 md:gap-3 mb-4">
                  <CalendarIcon className="w-5 h-5 md:w-6 md:h-6 text-[#808000]" />
                  <h2 className="text-lg md:text-xl font-semibold">Select Date</h2>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2 sm:gap-4 flex-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handlePreviousDay}
                      className="rounded-full border-2 border-[#808000] text-[#808000] hover:bg-yellow-50 px-3 sm:px-6 text-xs sm:text-sm"
                    >
                      Prev
                    </Button>
                    <div className="flex-1 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setShowCalendar(!showCalendar)}
                        className="text-center group"
                      >
                        <p className="text-base sm:text-xl md:text-2xl font-semibold text-gray-800 flex items-center justify-center gap-1 sm:gap-2">
                          <span className="hidden sm:inline">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
                          <span className="sm:hidden">{format(selectedDate, 'MMM d, yyyy')}</span>
                          <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 transition-transform ${showCalendar ? 'rotate-180' : ''}`} />
                        </p>
                      </button>
                      
                      {/* Calendar Icon Button */}
                      <button
                        onClick={() => setShowCalendar(!showCalendar)}
                        className="p-1.5 sm:p-2 rounded-lg border-2 border-[#808000] text-[#808000] hover:bg-yellow-50 transition-all"
                        title="Open Calendar"
                      >
                        <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleNextDay}
                      className="rounded-full border-2 border-[#808000] text-[#808000] hover:bg-yellow-50 px-3 sm:px-6 text-xs sm:text-sm"
                    >
                      Next
                    </Button>
                  </div>
                </div>
                
                {/* Calendar Popup Modal */}
                <AnimatePresence>
                  {showCalendar && (
                    <>
                      {/* Backdrop */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowCalendar(false)}
                        className="fixed inset-0 bg-black/40 z-40"
                      />

                      {/* Calendar Popup */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-1/2"
                      >
                        <div className="overflow-hidden rounded-[28px] bg-[#1f2430] text-white shadow-2xl">
                          <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{format(calendarDraftDate, 'yyyy')}</p>
                              <h3 className="mt-1 text-2xl font-semibold text-white">{format(calendarDraftDate, 'EEE, MMM d')}</h3>
                            </div>
                            <button
                              onClick={() => setShowCalendar(false)}
                              className="rounded-full p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                              aria-label="Close calendar"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          <div className="px-5 py-4">
                            <Calendar
                              mode="single"
                              selected={calendarDraftDate}
                              onSelect={(date) => {
                                if (date) {
                                  setCalendarDraftDate(date);
                                }
                              }}
                              disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                              className="p-0"
                              classNames={datePickerCalendarClassNames}
                            />
                          </div>

                          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
                            <button
                              type="button"
                              onClick={() => {
                                const today = new Date();
                                setCalendarDraftDate(today);
                                setSelectedDate(today);
                                setShowCalendar(false);
                              }}
                              className="text-sm font-medium text-[#9dc4ff] transition-colors hover:text-white"
                            >
                              Clear
                            </button>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setShowCalendar(false)}
                                className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDate(calendarDraftDate);
                                  setShowCalendar(false);
                                }}
                                className="rounded-full bg-[#9dc4ff] px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-[#b7d6ff]"
                              >
                                Set
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Court Selector */}
              <div>
                <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Select Court</h2>
                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  {courts.map((courtName, index) => {
                    const courtNumber = index + 1;
                    return (
                    <button
                      key={courtName}
                      onClick={() => setSelectedCourt(courtNumber)}
                      className={`p-2 md:p-3 rounded-xl border-2 transition-all ${
                        selectedCourt === courtNumber
                          ? 'border-[#808000] bg-yellow-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold text-sm md:text-base">{courtName}</p>
                    </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                  <Clock className="w-5 h-5 md:w-6 md:h-6 text-[#808000]" />
                  <h2 className="text-lg md:text-xl font-semibold">Available Time Slots</h2>
                </div>

                {isSelectedDateToday && availableSlotCount < timeSlots.length && (
                  <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    You are viewing today&apos;s schedule. Earlier time slots are marked as <span className="font-semibold">Past</span> because they have already started. Use <span className="font-semibold">Next</span> or pick a future date to see more open slots.
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                  {timeSlots.map((slot) => {
                    const matchingServerSlot = serverAvailability.find(serverSlot => (
                      serverSlot.date === slot.date
                      && serverSlot.court === slot.court
                      && serverSlot.time === slot.time
                    ));
                    const effectiveSlot: TimeSlot = {
                      ...slot,
                      price: typeof matchingServerSlot?.price === 'number' ? matchingServerSlot.price : slot.price,
                      status: matchingServerSlot?.status || slot.status,
                    };
                    const selected = isSlotSelected(slot.id);
                    const pastSlot = isPastTimeSlot(slot);
                    const serverBooked = matchingServerSlot?.status === 'booked';
                    const locallyBooked = !pastSlot && !serverBooked && isSlotBooked(slot.date, slot.court, slot.time);
                    const unavailable = pastSlot || serverBooked || locallyBooked;
                    
                    return (
                      <button
                        key={slot.id}
                        onClick={() => handleSlotClick(effectiveSlot)}
                        disabled={unavailable}
                        className={`px-2 py-2 md:px-3 md:py-2 rounded-full border-2 transition-all text-xs sm:text-sm font-medium ${
                          pastSlot
                            ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                            : unavailable
                            ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                            : selected
                            ? 'border-[#808000] bg-yellow-50 text-[#808000] shadow-sm'
                            : 'border-gray-200 hover:border-[#808000] hover:bg-yellow-50'
                        }`}
                      >
                        <p className="font-semibold text-xs sm:text-sm">{slot.time}</p>
                        {pastSlot && <p className="text-[10px] sm:text-xs mt-0.5">Past</p>}
                        {!pastSlot && unavailable && <p className="text-[10px] sm:text-xs mt-0.5">Booked</p>}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 md:gap-4 mt-4 md:mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 md:w-4 md:h-4 bg-yellow-50 border-2 border-[#808000] rounded"></div>
                    <span className="text-xs md:text-sm text-gray-600">Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 md:w-4 md:h-4 bg-white border-2 border-gray-200 rounded"></div>
                    <span className="text-xs md:text-sm text-gray-600">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 md:w-4 md:h-4 bg-gray-50 border-2 border-gray-100 rounded"></div>
                    <span className="text-xs md:text-sm text-gray-600">Past</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 md:w-4 md:h-4 bg-gray-100 border-2 border-gray-200 rounded"></div>
                    <span className="text-xs md:text-sm text-gray-600">Booked</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Booking Summary */}
          <div className="lg:sticky lg:top-24 lg:h-fit">
            <GlassCard className="p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-semibold mb-4">Booking Summary</h2>

              {selectedSlots.length === 0 ? (
                <div className="text-center py-6 md:py-8">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CalendarIcon className="w-6 h-6 md:w-8 md:h-8 text-gray-400" />
                  </div>
                  <p className="text-sm md:text-base text-gray-500">No slots selected</p>
                  <p className="text-xs md:text-sm text-gray-400 mt-1">Select time slots to continue</p>
                </div>
              ) : (
                <>
                  {blockedSelectedSlots.length > 0 && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                        <div>
                          <p className="font-semibold text-red-900">Selected slot unavailable</p>
                          <ul className="mt-2 space-y-1 pl-4 list-disc">
                            {blockedSelectedSlots.map(({ id, message }) => (
                              <li key={id}>{message}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 md:space-y-3 mb-4 max-h-48 md:max-h-64 overflow-y-auto">
                    {selectedSlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-xs md:text-sm">Court {slot.court}</p>
                          <p className="text-xs md:text-sm text-gray-600">{slot.time}</p>
                          <p className="text-xs md:text-sm text-gray-600">{format(new Date(slot.date), 'MMM d, yyyy')}</p>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                          <p className="font-semibold text-sm md:text-base">₹{slot.price}</p>
                          <button
                            onClick={() => removeSlot(slot.id)}
                            className="text-red-500 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-3 md:pt-4 space-y-2">
                    <div className="flex justify-between text-xs md:text-base text-gray-600">
                      <span>Subtotal ({selectedSlots.length} slots)</span>
                      <span>₹{totalAmount}</span>
                    </div>
                    <div className="flex justify-between text-lg md:text-xl font-bold text-gray-800 pt-2 border-t border-gray-200">
                      <span>Total</span>
                      <span>₹{totalAmount}</span>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    className="w-full mt-4 md:mt-6 text-sm md:text-base"
                    onClick={handleProceedToPayment}
                    disabled={bookingDisabled || blockedSelectedSlots.length > 0}
                  >
                    {bookingDisabled
                      ? 'Court is temporarily closed'
                      : blockedSelectedSlots.length > 0
                      ? 'Resolve slot conflict'
                      : 'Proceed to Payment'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full mt-3 text-sm md:text-base"
                    onClick={handleBookOnsiteNow}
                    disabled={bookingDisabled || onsiteProcessing || blockedSelectedSlots.length > 0}
                  >
                    {bookingDisabled
                      ? 'Bookings Paused'
                      : blockedSelectedSlots.length > 0
                      ? 'Resolve slot conflict'
                      : onsiteProcessing
                      ? 'Booking Onsite...'
                      : 'Book Onsite (Pay at Venue)'}
                  </Button>
                </>
              )}
            </GlassCard>
          </div>
        </div>
      </div>

      {/* Login Prompt Modal */}
      <AnimatePresence>
        {showLoginPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowLoginPrompt(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <GlassCard className="p-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-700 to-yellow-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <LogIn className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Login Required</h2>
                  <p className="text-gray-600">Please login or create an account to proceed with your booking</p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full px-6 py-3 bg-gradient-to-r from-yellow-700 to-yellow-800 text-white rounded-xl font-medium hover:from-yellow-700 hover:to-yellow-900 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-5 h-5" />
                    Login to Continue
                  </button>
                  
                  <button
                    onClick={() => navigate('/user/register')}
                    className="w-full px-6 py-3 bg-white border-2 border-yellow-700 text-yellow-800 rounded-xl font-medium hover:bg-yellow-50 transition-all flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-5 h-5" />
                    Create New Account
                  </button>

                  <button
                    onClick={() => setShowLoginPrompt(false)}
                    className="w-full px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-all"
                  >
                    Continue Browsing
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Number Prompt Modal */}
      <AnimatePresence>
        {showPhonePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowPhonePrompt(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[520px]"
            >
              <GlassCard className="overflow-hidden bg-white p-0 shadow-[0_24px_60px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80">
                <div className="h-1 w-full bg-gradient-to-r from-[#014B33] via-[#0f6a4e] to-[#b56a00]" />
                <div className="px-8 pt-10 pb-8 text-center">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#f2f7f4] ring-1 ring-[#dbe8e1]">
                    <Phone className="w-6 h-6 text-[#014B33]" />
                  </div>
                  <h2 className="mb-3 text-3xl font-semibold tracking-tight text-slate-900">Update Mobile Number</h2>
                  <p className="mx-auto max-w-sm text-base leading-7 text-slate-600">Please update your mobile number in your profile before continuing.</p>
                </div>

                <div className="px-8 pb-8">
                  <button
                    onClick={() => {
                      setShowPhonePrompt(false);
                      navigate('/user/profile', { state: { from: location.pathname, editProfile: true } });
                    }}
                    className="w-full rounded-2xl bg-[#014B33] px-6 py-4 text-base font-semibold text-white shadow-[0_10px_24px_rgba(1,75,51,0.24)] transition-all hover:bg-[#013a28] flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-5 h-5" />
                    Update Mobile Number
                  </button>

                  <button
                    onClick={() => setShowPhonePrompt(false)}
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-6 py-4 text-base font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

