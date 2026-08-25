import { useEffect, useMemo, useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { DatePickerField } from '../../components/DatePickerField';
import { getAPI_BASE_URL } from '../../lib/apiConfig';
import { useBooking } from '../../context/BookingContext';

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: any) => void;
  existingBookings?: any[];
  existingSubscriptions?: any[];
}

export const CreateBookingModal = ({
  isOpen,
  onClose,
  onCreate,
  existingBookings = [],
  existingSubscriptions = [],
}: CreateBookingModalProps) => {
  const { appSettings } = useBooking();
  const [formData, setFormData] = useState({
    userName: '',
    userEmail: '',
    userPhone: '',
    court: 'Court 1',
    date: '',
    timeSlots: [] as string[],
    paymentMethod: 'cash',
  });
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const timeSlots = [
    '5:00 AM', '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM',
    '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM',
    '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM'
  ];

  const normalizeSlotLabel = (value: string) => value.split(' - ')[0].trim().toUpperCase();
  const normalizeDateValue = (value: string) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return '';
    }

    // Native date input values are usually yyyy-mm-dd.
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    // Accept dd-mm-yyyy just in case browser locale formatting leaks through.
    const ddmmyyyy = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
    }

    return trimmed;
  };

  const isWeekday = (dateKey: string) => {
    const date = new Date(`${dateKey}T12:00:00`);
    const day = date.getDay();
    return day !== 0 && day !== 6;
  };

  useEffect(() => {
    if (!isOpen || !formData.date) {
      setBookedSlots(new Set());
      return;
    }

    const courtNumber = Number(String(formData.court).replace('Court ', ''));
    if (!Number.isFinite(courtNumber) || courtNumber <= 0) {
      setBookedSlots(new Set());
      return;
    }

    let active = true;
    setLoadingAvailability(true);

    const loadAvailability = async () => {
      try {
        const response = await fetch(
          `${getAPI_BASE_URL()}/availability?date=${encodeURIComponent(formData.date)}&court=${courtNumber}`
        );

        const payload = await response.json().catch(() => null);
        if (!active || !response.ok || !Array.isArray(payload?.availability)) {
          return;
        }

        const unavailable = new Set<string>(
          payload.availability
            .filter((slot: { status?: string }) => slot.status === 'booked')
            .map((slot: { time?: string }) => normalizeSlotLabel(slot.time || ''))
            .filter(Boolean)
        );

        setBookedSlots(unavailable);
      } finally {
        if (active) {
          setLoadingAvailability(false);
        }
      }
    };

    void loadAvailability();

    return () => {
      active = false;
    };
  }, [formData.court, formData.date, isOpen]);

  const localBlockedSlots = useMemo(() => {
    const dateKey = normalizeDateValue(formData.date);
    const courtNumber = Number(String(formData.court).replace('Court ', ''));

    if (!dateKey || !Number.isFinite(courtNumber) || courtNumber <= 0) {
      return new Set<string>();
    }

    const blocked = new Set<string>();

    for (const booking of existingBookings) {
      if (!booking || booking.status === 'cancelled') {
        continue;
      }

      const bookingDate = normalizeDateValue(booking.date || '');
      if (bookingDate !== dateKey) {
        continue;
      }

      const slots = Array.isArray(booking.slots) ? booking.slots : [];
      for (const slot of slots) {
        if (Number(slot?.court) !== courtNumber) {
          continue;
        }

        const label = normalizeSlotLabel(String(slot?.time || ''));
        if (label) {
          blocked.add(label);
        }
      }
    }

    if (isWeekday(dateKey)) {
      for (const sub of existingSubscriptions) {
        if (!sub || sub.status !== 'active') {
          continue;
        }

        if (Number(sub.court) !== courtNumber) {
          continue;
        }

        const startDate = normalizeDateValue(sub.startDate || '');
        const endDate = normalizeDateValue(sub.endDate || '');
        if (!startDate || !endDate || dateKey < startDate || dateKey > endDate) {
          continue;
        }

        const label = normalizeSlotLabel(String(sub.timeSlot || ''));
        if (label) {
          blocked.add(label);
        }
      }
    }

    return blocked;
  }, [existingBookings, existingSubscriptions, formData.court, formData.date]);

  const blockedSlots = useMemo(
    () => new Set<string>([...bookedSlots, ...localBlockedSlots]),
    [bookedSlots, localBlockedSlots]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormData((prev) => {
      const nextTimeSlots = prev.timeSlots.filter((slot) => !blockedSlots.has(normalizeSlotLabel(slot)));

      // Avoid unnecessary state updates that can trigger render loops.
      if (nextTimeSlots.length === prev.timeSlots.length) {
        return prev;
      }

      return {
        ...prev,
        timeSlots: nextTimeSlots,
      };
    });
  }, [blockedSlots, isOpen]);

  const handleTimeSlotToggle = (slot: string) => {
    if (blockedSlots.has(normalizeSlotLabel(slot))) {
      return;
    }

    setFormData(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.includes(slot)
        ? prev.timeSlots.filter(s => s !== slot)
        : [...prev.timeSlots, slot]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const conflicting = formData.timeSlots.find((slot) => blockedSlots.has(normalizeSlotLabel(slot)));
    if (conflicting) {
      alert(`${conflicting} is already booked for this court/date. Please choose another slot.`);
      return;
    }

    const normalizedDate = normalizeDateValue(formData.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      alert('Please select a valid booking date.');
      return;
    }
    
    if (!formData.userName || !formData.userPhone || !formData.date || formData.timeSlots.length === 0) {
      alert('Please fill all required fields and select at least one time slot');
      return;
    }

    const selectedDate = new Date(`${normalizedDate}T12:00:00`);
    const slotPrice = selectedDate.getDay() === 0 || selectedDate.getDay() === 6
      ? Number(appSettings.pricing.peak || 0)
      : Number(appSettings.pricing.offPeak || 0);
    const subtotal = formData.timeSlots.length * slotPrice;
    const totalAmount = subtotal;

    onCreate({
      ...formData,
      date: normalizedDate,
      totalAmount,
      paymentId: formData.paymentMethod === 'cash' ? 'CASH-' + Date.now() : 'CARD-' + Date.now(),
    });
    
    // Reset form
    setFormData({
      userName: '',
      userEmail: '',
      userPhone: '',
      court: 'Court 1',
      date: '',
      timeSlots: [],
      paymentMethod: 'cash',
    });
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-2xl font-bold text-gray-800">Create Onsite Booking</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Customer Details */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-4">Customer Details</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.userName}
                  onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                  placeholder="Enter customer name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.userPhone}
                  onChange={(e) => setFormData({ ...formData, userPhone: e.target.value })}
                  placeholder="+91 XXXXX XXXXX"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email (Optional)
                </label>
                <Input
                  type="email"
                  value={formData.userEmail}
                  onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                  placeholder="customer@example.com"
                />
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-4">Booking Details</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Court <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.court}
                  onChange={(e) => setFormData({ ...formData, court: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#808000] focus:border-transparent"
                  required
                >
                  <option value="Court 1">Court 1</option>
                  <option value="Court 2">Court 2</option>
                  <option value="Court 3">Court 3</option>
                </select>
              </div>
              <div>
                <DatePickerField
                  label="Date"
                  value={formData.date}
                  onChange={(value) => setFormData({ ...formData, date: value })}
                  minDate={new Date().toISOString().split('T')[0]}
                  required
                  placeholder="Select date"
                />
              </div>
            </div>
          </div>

          {/* Time Slots */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Time Slots <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {timeSlots.map((slot) => (
                (() => {
                  const isBlocked = blockedSlots.has(normalizeSlotLabel(slot));
                  const isSelected = formData.timeSlots.includes(slot);

                  return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleTimeSlotToggle(slot)}
                  disabled={isBlocked}
                  className={`p-2 rounded-lg text-sm font-medium transition-all ${
                    isBlocked
                      ? 'bg-red-100 text-red-500 cursor-not-allowed opacity-70'
                      : isSelected
                        ? 'bg-[#808000] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isBlocked ? `${slot} (Booked)` : slot}
                </button>
                  );
                })()
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Selected: {formData.timeSlots.length} slot(s)
            </p>
            {formData.date && (
              <p className="text-xs text-gray-500 mt-1">
                {loadingAvailability ? 'Checking availability...' : 'Booked slots are disabled for admin as well.'}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cash"
                  checked={formData.paymentMethod === 'cash'}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-4 h-4 text-[#808000] focus:ring-[#808000]"
                />
                <span className="text-sm font-medium text-gray-700">Cash</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  checked={formData.paymentMethod === 'card'}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-4 h-4 text-[#808000] focus:ring-[#808000]"
                />
                <span className="text-sm font-medium text-gray-700">Card/UPI</span>
              </label>
            </div>
          </div>

          {/* Summary */}
          {formData.timeSlots.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2">Booking Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Slots ({formData.timeSlots.length})</span>
                  <span className="font-medium">₹{formData.timeSlots.length * 500}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-800">Total</span>
                  <span className="font-bold text-[#808000]">
                    ₹{formData.timeSlots.length * 500}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Create Booking
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

