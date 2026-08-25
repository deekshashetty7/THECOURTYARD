import { useNavigate } from 'react-router';
import { CheckCircle, Calendar, Mail, Home, History } from 'lucide-react';
import { motion } from 'motion/react';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/Button';
import { useBooking } from '../../context/BookingContext';
import { format } from 'date-fns';
import { formatBookingIdDisplay } from '../../lib/bookingUtils';

const formatPaymentMethod = (method?: string) => {
  if (method === 'onsite') return 'ONSITE';
  if (method === 'online') return 'ONLINE';
  return (method || 'ONLINE').toUpperCase();
};

export const BookingConfirmation = () => {
  const navigate = useNavigate();
  const { bookings } = useBooking();
  
  // Get the most recent booking
  const latestBooking = bookings[0];

  if (!latestBooking) {
    navigate('/user/home');
    return null;
  }

  const paymentMethod =
    latestBooking.paymentMethod ||
    (String(latestBooking.paymentId || '').toUpperCase().startsWith('ONSITE') ? 'onsite' : 'online');

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="p-6 md:p-8 text-center">
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="flex justify-center mb-6"
            >
              <div className="w-20 h-20 md:w-24 md:h-24 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 md:w-16 md:h-16 text-green-900" />
              </div>
            </motion.div>

            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Booking Confirmed!</h1>
            <p className="text-sm md:text-base text-gray-600 mb-6 md:mb-8">
              Your court has been successfully booked
            </p>

            {/* Booking Details */}
            <div className="bg-gradient-to-br from-green-50 to-green-50 rounded-2xl p-4 md:p-6 mb-4 md:mb-6 text-left">
              <div className="grid md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <p className="text-xs md:text-sm text-gray-600 mb-1">Booking ID</p>
                  <p className="font-bold text-base md:text-lg" title={latestBooking.id}>
                    {formatBookingIdDisplay(latestBooking.id)}
                  </p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-600 mb-1">Payment Method</p>
                  <p className="font-semibold text-sm md:text-base">{formatPaymentMethod(paymentMethod)}</p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-600 mb-1">Payment Status</p>
                  <p className="font-semibold text-sm md:text-base capitalize">{latestBooking.paymentStatus || 'paid'}</p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-600 mb-1">Court Name</p>
                  <p className="font-semibold text-sm md:text-base">{latestBooking.courtName}</p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-600 mb-1">Date</p>
                  <p className="font-semibold text-sm md:text-base">{format(new Date(latestBooking.date), 'EEEE, MMM d, yyyy')}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-green-200">
                <p className="text-xs md:text-sm text-gray-600 mb-2">Booked Slots</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {latestBooking.slots.map((slot) => (
                    <div key={slot.id} className="bg-white rounded-lg p-2 text-center">
                      <p className="font-medium text-xs md:text-sm">Court {slot.court}</p>
                      <p className="text-[10px] md:text-xs text-gray-600">{slot.time}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-green-200 flex justify-between items-center">
                <span className="text-base md:text-lg font-semibold uppercase tracking-wide">Total Amount</span>
                <span className="text-xl md:text-2xl font-bold text-[#808000]">₹{latestBooking.totalAmount}</span>
              </div>
            </div>

            {/* Notification Message */}
            <div className={`${latestBooking.confirmationEmailSent === false ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'} border rounded-xl p-3 md:p-4 mb-4 md:mb-6`}>
              <div className="flex items-start md:items-center gap-2 md:gap-3">
                <Mail className={`w-4 h-4 md:w-5 md:h-5 ${latestBooking.confirmationEmailSent === false ? 'text-amber-600' : 'text-blue-600'} flex-shrink-0 mt-0.5 md:mt-0`} />
                <p className={`text-xs md:text-sm ${latestBooking.confirmationEmailSent === false ? 'text-amber-800' : 'text-blue-800'} text-left`}>
                  {latestBooking.confirmationEmailSent === false
                    ? 'Your booking is saved, but we could not send the confirmation email. Please contact support if you need a copy.'
                    : 'A confirmation email has been sent to your registered email address'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
              <Button
                variant="outline"
                className="w-full text-sm md:text-base"
                onClick={() => navigate('/user/home')}
              >
                <Home className="w-4 h-4 md:w-5 md:h-5" />
                Go Home
              </Button>
              <Button
                variant="outline"
                className="w-full text-sm md:text-base"
                onClick={() => navigate('/user/booking')}
              >
                <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                Book Again
              </Button>
              <Button
                variant="primary"
                className="w-full text-sm md:text-base"
                onClick={() => navigate('/user/history')}
              >
                <History className="w-4 h-4 md:w-5 md:h-5" />
                View History
              </Button>
            </div>
          </GlassCard>
        </motion.div>
      </div>
  );
};

