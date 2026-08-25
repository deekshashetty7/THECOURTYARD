import { useState } from 'react';
import { Phone, Mail, MapPin, Clock, Send, CheckCircle, MessageCircle, HelpCircle, Calendar, Navigation } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { motion } from 'motion/react';
import { useNavigate, useLocation } from 'react-router';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { useLandingPage } from '../context/LandingPageContext';
import { useAuth } from '../context/AuthContext';
import { buildMapsLink, resolveVenueDetails } from '../lib/venueDetails';
import { useEffect } from 'react';

const defaultQuickActions = [
  {
    title: 'Book a Court',
    description: 'Reserve your court in minutes',
    icon: 'Calendar',
    color: 'emerald',
    actionType: 'navigate',
    actionValue: '/user/booking',
  },
  {
    title: 'Chat Support',
    description: 'Get instant help',
    icon: 'MessageCircle',
    color: 'blue',
    actionType: 'navigate',
    actionValue: '/contact',
  },
  {
    title: 'FAQs',
    description: 'Find quick answers',
    icon: 'HelpCircle',
    color: 'purple',
    actionType: 'scroll',
    actionValue: 'contact-faqs',
  },
] as const;

const defaultFaqs = [
  {
    id: 'faq-booking',
    question: 'How do I book a court?',
    answer: 'Go to the booking page, choose your preferred date and time slot, and confirm your booking.',
  },
  {
    id: 'faq-cancel',
    question: 'Can I cancel or reschedule a booking?',
    answer: 'Yes, you can manage bookings from your account. Cancellation and reschedule availability depends on the slot policy.',
  },
  {
    id: 'faq-response',
    question: 'How soon will I get a response?',
    answer: 'We usually respond to support emails and contact requests within 24 hours.',
  },
] as const;

const quickActionIcons = {
  Calendar,
  MessageCircle,
  HelpCircle,
};

const actionStyles: Record<string, { container: string; icon: string }> = {
  emerald: { container: 'bg-green-100', icon: 'text-green-900' },
  blue: { container: 'bg-blue-100', icon: 'text-blue-600' },
  purple: { container: 'bg-purple-100', icon: 'text-purple-600' },
};

export const ContactPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isPublicContact = location.pathname === '/contact';

  useEffect(() => {
    if (user?.role === 'user' && user?.emailVerified && isPublicContact) {
      navigate('/user/contact', { replace: true });
    }
  }, [user, isPublicContact, navigate]);
  const { content } = useLandingPage();
  const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';
  const API_BASE_URL =
    typeof window !== 'undefined' && window.location.hostname.includes('localhost')
      ? '/api'
      : RAW_API_BASE_URL;
  const {
    venueName,
    venueAddress,
    venuePhone,
    venueEmail,
    venueOperatingHoursText: venueHours,
  } = resolveVenueDetails(content);
  const mapsLink = buildMapsLink(venueAddress);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [userMessages, setUserMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [isCheckRepliesOpen, setIsCheckRepliesOpen] = useState(false);
  const [checkMessages, setCheckMessages] = useState<any[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [activeReplyEmail, setActiveReplyEmail] = useState('');

  const getContactEmail = () => formData.email.trim() || user?.email?.trim() || '';

  const fetchReplies = async (email: string) => {
    setIsChecking(true);
    setCheckMessages([]);
    try {
      const response = await fetch(`${API_BASE_URL}/contact-messages-by-email?email=${encodeURIComponent(email)}`);
      const payload = await response.json().catch(() => null);
      if (response.ok && Array.isArray(payload?.messages)) {
        setCheckMessages(payload.messages.filter((msg: any) => msg.adminReply));
      } else {
        setCheckMessages([]);
      }
    } catch {
      setCheckMessages([]);
    } finally {
      setIsChecking(false);
    }
  };

  const handleOpenCheckReplies = async () => {
    const email = getContactEmail();
    if (!email) {
      setSubmitError('Enter your email in the form above to check replies.');
      return;
    }

    setSubmitError('');
    setActiveReplyEmail(email);
    setIsCheckRepliesOpen(true);
    await fetchReplies(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setSubmitError('');

    const requestBody = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      subject: formData.subject,
      message: formData.message.trim(),
    };

    if (!requestBody.name || !requestBody.email || !requestBody.subject || !requestBody.message) {
      setSubmitError('Please fill all required fields before submitting.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/contact-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(responseData?.error?.message || 'Unable to send your message right now. Please try again.');
      }

      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      setTimeout(() => {
        setSubmitted(false);
      }, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send your message right now. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const loadUserMessages = async (email: string) => {
    if (!email.trim()) {
      setUserMessages([]);
      return;
    }

    setLoadingMessages(true);
    try {
      const response = await fetch(`${API_BASE_URL}/contact-messages-by-email?email=${encodeURIComponent(email)}`);
      const payload = await response.json().catch(() => null);
      if (response.ok && Array.isArray(payload?.messages)) {
        setUserMessages(payload.messages.filter((msg: any) => msg.adminReply));
      } else {
        setUserMessages([]);
      }
    } catch {
      setUserMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (user?.email && !formData.email) {
      setFormData((prev) => ({ ...prev, email: user.email }));
    }
  }, [user?.email]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.email) {
        void loadUserMessages(formData.email);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.email, API_BASE_URL]);

  const quickActions = Array.isArray(content.contactQuickActions) && content.contactQuickActions.length > 0
    ? content.contactQuickActions
    : defaultQuickActions;
  const faqs = Array.isArray(content.contactFaqs) && content.contactFaqs.length > 0
    ? content.contactFaqs
    : defaultFaqs;

  const handleQuickAction = (action: typeof quickActions[number]) => {
    if (action.actionType === 'navigate') {
      navigate(action.actionValue || '/');
      return;
    }

    if (action.actionType === 'phone') {
      window.open(`tel:${action.actionValue}`);
      return;
    }

    if (action.actionType === 'scroll') {
      const sectionId = action.actionValue || 'contact-faqs';
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30">
      {isPublicContact && <Navbar />}

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-900 to-green-800 text-white py-12 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-bold mb-4"
          >
            Get in Touch
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-green-50 max-w-2xl mx-auto"
          >
            We're here to help! Whether you have questions, need support, or want to give feedback
          </motion.p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12 max-w-7xl">
        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4 mb-12 -mt-8">
          {quickActions.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <GlassCard
                className="p-6 hover:shadow-xl transition-all duration-300 cursor-pointer group"
                onClick={() => handleQuickAction(action)}
              >
                <div className={`w-12 h-12 ${actionStyles[action.color]?.container || 'bg-gray-100'} rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  {(() => {
                    const ActionIcon = quickActionIcons[action.icon as keyof typeof quickActionIcons] || Calendar;
                    return <ActionIcon className={`w-6 h-6 ${actionStyles[action.color]?.icon || 'text-gray-600'}`} />;
                  })()}
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">{action.title}</h3>
                <p className="text-sm text-gray-600">{action.description}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          {/* Contact Info Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Phone */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <GlassCard className="p-5 hover:shadow-lg transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-2">Call Us</h3>
                    <a
                      href={venuePhone ? `tel:${venuePhone}` : '#'}
                      className="block text-sm text-yellow-800 hover:text-yellow-900 font-medium mb-1 transition-colors"
                    >
                      {venuePhone}
                    </a>
                    <p className="text-xs text-gray-500 mt-2">Available 7 days a week</p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* Email */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <GlassCard className="p-5 hover:shadow-lg transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-900 to-green-950 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-2">Email Us</h3>
                    <a
                      href={venueEmail ? `mailto:${venueEmail}` : '#'}
                      className="block text-sm text-yellow-800 hover:text-yellow-900 font-medium mb-1 transition-colors"
                    >
                      {venueEmail}
                    </a>
                    <p className="text-xs text-gray-500 mt-2">Response within 24 hours</p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* Location */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <GlassCard className="p-5 hover:shadow-lg transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-2">Visit Us</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3 whitespace-pre-line">
                      {venueName}
                      <br />
                      {venueAddress}
                    </p>
                    <button
                      onClick={() => window.open(mapsLink, '_blank')}
                      className="flex items-center gap-1 text-xs text-green-900 hover:text-green-950 font-medium transition-colors"
                    >
                      <Navigation className="w-3 h-3" />
                      Get Directions
                    </button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* Hours */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <GlassCard className="p-5 hover:shadow-lg transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-2">Operating Hours</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{venueHours}</p>
                    <div className="mt-3 px-2 py-1 bg-green-100 rounded text-xs font-medium text-green-700 inline-block">
                      Open Now
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <GlassCard className="p-6 md:p-8">
                <div className="mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Send us a Message</h2>
                  <p className="text-gray-600">Fill out the form below and we'll get back to you as soon as possible</p>
                </div>

                {submitted ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center justify-center py-16"
                  >
                    <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-900 rounded-full flex items-center justify-center mb-6 shadow-xl">
                      <CheckCircle className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-3">Message Sent Successfully!</h3>
                    <p className="text-gray-600 text-center max-w-md mb-6">
                      Thank you for reaching out to us. Our team will review your message and respond within 24 hours.
                    </p>
                    <Button
                      onClick={() => setSubmitted(false)}
                      variant="outline"
                      className="mt-4"
                    >
                      Send Another Message
                    </Button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {submitError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {submitError}
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Your Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-700 focus:border-transparent transition-all"
                          placeholder="John Doe"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-700 focus:border-transparent transition-all"
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-700 focus:border-transparent transition-all"
                          placeholder="+91 98765 43210"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Subject <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="subject"
                          value={formData.subject}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-700 focus:border-transparent transition-all"
                        >
                          <option value="">Select a subject</option>
                          <option value="booking">Booking Inquiry</option>
                          <option value="cancellation">Cancellation Request</option>
                          <option value="payment">Payment Issue</option>
                          <option value="feedback">Feedback</option>
                          <option value="general">General Question</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Your Message <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={6}
                        minLength={10}
                        maxLength={1200}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-700 focus:border-transparent resize-none transition-all"
                        placeholder="Tell us how we can help you..."
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-gray-500">Please provide as much detail as possible</p>
                        <p className="text-xs text-gray-400">{formData.message.length}/1200</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        className="px-8 py-3 text-base"
                        disabled={submitting}
                      >
                        <Send className="w-5 h-5 mr-2" />
                        {submitting ? 'Sending...' : 'Send Message'}
                      </Button>
                      <p className="text-sm text-gray-500 hidden sm:block">We typically respond within 24 hours</p>
                      <button
                        type="button"
                        onClick={() => void handleOpenCheckReplies()}
                        className="ml-auto flex items-center gap-2 text-sm text-green-900 hover:text-emerald-800 bg-green-50 hover:bg-green-100 px-4 py-2 rounded-full transition-all duration-300 font-semibold border border-green-200 hover:shadow-md active:scale-95"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Check Replies
                      </button>
                    </div>
                  </form>
                )}
              </GlassCard>
            </motion.div>

            {/* Your Messages Section */}
            {formData.email && (loadingMessages || userMessages.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8"
                id="your-messages"
              >
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Messages</h2>
                {loadingMessages ? (
                  <GlassCard className="p-4 text-sm text-gray-600">Loading your latest replies...</GlassCard>
                ) : (
                  <div className="space-y-3">
                    {userMessages.map((msg) => (
                      <GlassCard key={msg.id} className="p-4 bg-gradient-to-br from-blue-50 to-green-50">
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900 text-sm">{msg.subject}</h3>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                  msg.adminReply
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}
                              >
                                {msg.adminReply ? '✓ Replied' : 'Pending'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">{msg.createdAt?.split('T')[0]}</p>
                            <p className="text-xs text-gray-700">{msg.message}</p>
                          </div>

                          {msg.adminReply && (
                            <div className="bg-green-100 border border-green-200 p-3 rounded-lg">
                              <p className="text-xs font-semibold text-green-800 mb-1">💚 Admin Reply</p>
                              <p className="text-xs text-green-800">{msg.adminReply}</p>
                              <p className="text-xs text-green-900 mt-1">by {msg.adminReplyBy}</p>
                            </div>
                          )}
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* FAQs Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8"
            >
              <div id="contact-faqs" />
              <GlassCard className="p-6 md:p-8">
                <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-6">Frequently Asked Questions</h3>
                <div className="space-y-4">
                  {faqs.map((faq) => (
                    <div key={faq.id} className="pb-4 border-b border-gray-200 last:border-0">
                      <h4 className="font-semibold text-gray-800 mb-2 flex items-start gap-2">
                        <HelpCircle className="w-5 h-5 text-green-900 flex-shrink-0 mt-0.5" />
                        {faq.question}
                      </h4>
                      <p className="text-gray-600 text-sm ml-7">{faq.answer}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600 text-center">
                    Can't find what you're looking for?{' '}
                    <button
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      className="text-green-900 hover:text-green-950 font-semibold"
                    >
                      Contact us directly
                    </button>
                  </p>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </div>

      <Dialog open={isCheckRepliesOpen} onOpenChange={setIsCheckRepliesOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-800">Your Replies</DialogTitle>
            <DialogDescription>
              {activeReplyEmail
                ? `Showing admin replies for ${activeReplyEmail}`
                : 'Loading your messages...'}
            </DialogDescription>
          </DialogHeader>

          {isChecking ? (
            <div className="mt-4 p-4 text-center text-sm text-gray-600 bg-gray-50 rounded-lg">
              Loading replies...
            </div>
          ) : checkMessages.length > 0 ? (
            <div className="mt-4 space-y-3">
              {checkMessages.map((msg) => (
                <div key={msg.id} className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm">{msg.subject}</h3>
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                      ✓ Replied
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{msg.createdAt?.split('T')[0]}</p>
                  <p className="text-xs text-gray-700">{msg.message}</p>

                  {msg.adminReply && (
                    <div className="mt-3 bg-green-50 border border-green-200 p-3 rounded-lg">
                      <p className="text-xs font-semibold text-green-800 mb-1">Admin Reply</p>
                      <p className="text-xs text-green-800">{msg.adminReply}</p>
                      {msg.adminReplyBy && <p className="text-xs text-green-900 mt-1">by {msg.adminReplyBy}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-lg">
              No replies yet for this email. We usually respond within 24 hours.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

