import { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { DatePickerField } from '../../components/DatePickerField';

interface CreateSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: any) => void;
}

export const CreateSubscriptionModal = ({ isOpen, onClose, onCreate }: CreateSubscriptionModalProps) => {
  const [formData, setFormData] = useState({
    userName: '',
    userEmail: '',
    userPhone: '',
    court: 'Court 1',
    timeSlot: '6:00 AM - 7:00 AM',
    startDate: '',
    paymentMethod: 'cash',
  });

  const timeSlots = [
    '5:00 AM - 6:00 AM', '6:00 AM - 7:00 AM', '7:00 AM - 8:00 AM', '8:00 AM - 9:00 AM',
    '9:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM', '12:00 PM - 1:00 PM',
    '1:00 PM - 2:00 PM', '2:00 PM - 3:00 PM', '3:00 PM - 4:00 PM', '4:00 PM - 5:00 PM',
    '5:00 PM - 6:00 PM', '6:00 PM - 7:00 PM', '7:00 PM - 8:00 PM', '8:00 PM - 9:00 PM',
    '9:00 PM - 10:00 PM', '10:00 PM - 11:00 PM'
  ];

  const calculateEndDate = (startDate: string) => {
    if (!startDate) return '';
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    return end.toISOString().split('T')[0];
  };

  const calculateWeekdays = (startDate: string) => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    
    let weekdayCount = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) { // Not Sunday (0) or Saturday (6)
        weekdayCount++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return weekdayCount;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.userName || !formData.userPhone || !formData.startDate) {
      alert('Please fill all required fields');
      return;
    }

    const endDate = calculateEndDate(formData.startDate);
    const weekdaysCount = calculateWeekdays(formData.startDate);
    const amount = 2500; // Fixed subscription price

    onCreate({
      ...formData,
      endDate,
      weekdaysCount,
      amount,
      paymentId: formData.paymentMethod === 'cash' ? 'CASH-' + Date.now() : 'CARD-' + Date.now(),
    });
    
    // Reset form
    setFormData({
      userName: '',
      userEmail: '',
      userPhone: '',
      court: 'Court 1',
      timeSlot: '6:00 AM - 7:00 AM',
      startDate: '',
      paymentMethod: 'cash',
    });
    
    onClose();
  };

  if (!isOpen) return null;

  const weekdaysCount = calculateWeekdays(formData.startDate);
  const endDate = calculateEndDate(formData.startDate);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-2xl font-bold text-gray-800">Create Onsite Subscription</h3>
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

          {/* Subscription Details */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-4">Subscription Details</h4>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time Slot <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.timeSlot}
                  onChange={(e) => setFormData({ ...formData, timeSlot: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#808000] focus:border-transparent"
                  required
                >
                  {timeSlots.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
              <div>
                <DatePickerField
                  label="Start Date"
                  value={formData.startDate}
                  onChange={(value) => setFormData({ ...formData, startDate: value })}
                  minDate={new Date().toISOString().split('T')[0]}
                  required
                  placeholder="Select start date"
                />
              </div>
              {formData.startDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <div className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-gray-600">
                    {endDate}
                  </div>
                </div>
              )}
            </div>
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
          {formData.startDate && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3">Subscription Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration</span>
                  <span className="font-medium">30 days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Weekdays Only</span>
                  <span className="font-medium">{weekdaysCount} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monthly Subscription</span>
                  <span className="font-medium">₹2,500</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-800">Total</span>
                  <span className="font-bold text-[#808000]">₹2,500</span>
                </div>
              </div>
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> This subscription is valid for {weekdaysCount} weekdays (Mon-Fri) from{' '}
                  {formData.startDate ? new Date(formData.startDate).toLocaleDateString() : '...'} to{' '}
                  {endDate ? new Date(endDate).toLocaleDateString() : '...'}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Create Subscription
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

