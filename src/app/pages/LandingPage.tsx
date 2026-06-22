import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { Calendar, CreditCard, Clock, Shield, CheckCircle, ArrowRight, Zap, Users, Award, Star } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { useLandingPage } from '../context/LandingPageContext';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

const iconMap: Record<string, any> = {
  Calendar,
  CreditCard,
  Clock,
  Shield,
  Zap,
  Users,
  Award,
  Star,
};

export const LandingPage = () => {
  const navigate = useNavigate();
  const { content } = useLandingPage();
  const [currentSlide, setCurrentSlide] = useState(0);
  const heroWords = content.heroTitle.trim().split(/\s+/).filter(Boolean);

  const heroSlides = useMemo(() => {
    if (content.gallery.length > 0) {
      return content.gallery.map((image) => ({
        id: image.id,
        src: image.url,
        caption: image.caption,
      }));
    }

    return [
      {
        id: 'hero-default-1',
        src: '/img1.jpg',
        caption: 'Professional court lighting',
      },
      {
        id: 'hero-default-2',
        src: '/im2.jpg',
        caption: 'Premium playing surface',
      },
      {
        id: 'hero-default-3',
        src: '/img3.webp',
        caption: 'Ready for competitive play',
      },
      {
        id: 'hero-default-4',
        src: '/img4.webp',
        caption: 'Weekend training sessions',
      },
      {
        id: 'hero-default-5',
        src: '/img5.jpg',
        caption: 'High energy match nights',
      },
    ];
  }, [content.gallery, content.heroImage]);

  useEffect(() => {
    if (currentSlide >= heroSlides.length) {
      setCurrentSlide(0);
    }
  }, [currentSlide, heroSlides.length]);

  useEffect(() => {
    if (heroSlides.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 3500);

    return () => window.clearInterval(intervalId);
  }, [heroSlides.length]);

  const getIcon = (iconName: string) => {
    return iconMap[iconName] || Calendar;
  };

  return (
    <div className="min-h-screen bg-[var(--courtyard-offwhite)]">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 md:py-20">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-stone-200 rounded-full mix-blend-multiply filter blur-xl opacity-25 animate-blob"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-zinc-200 rounded-full mix-blend-multiply filter blur-xl opacity-25 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-neutral-200 rounded-full mix-blend-multiply filter blur-xl opacity-25 animate-blob animation-delay-4000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-green-200 mb-6">
                <Zap className="w-4 h-4 text-green-900" />
                <span className="text-sm font-medium text-gray-700">Fast & Easy Booking</span>
              </div>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                whileHover={{ scale: 1.01 }}
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 leading-tight"
              >
                Book Your{' '}
                <motion.span
                  className="bg-gradient-to-r from-green-900 to-green-800 bg-clip-text text-transparent inline-block"
                  animate={{ scale: [1, 1.03, 1], rotate: [0, 1, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, repeatType: 'loop', ease: 'easeInOut' }}
                >
                  Perfect
                </motion.span>{' '}
                Court
              </motion.h1>

              <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                Premium court booking system with real-time availability, flexible subscriptions, and seamless payment integration. Your game, your schedule, your way.
              </p>

              <div className="flex flex-wrap gap-4">
                <Button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-gradient-to-r from-green-900 to-green-800 text-white rounded-xl hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold"
                >
                  Login
                  <ArrowRight className="w-5 h-5 ml-2 inline" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/user/register')}
                  className="px-8 py-4 bg-white/60 backdrop-blur-sm border-2 border-green-200 rounded-xl hover:bg-white hover:shadow-lg transition-all duration-300 font-semibold"
                >
                  Signup
                </Button>
              </div>

              {/* Quick Stats (static from hero block) */}
              <div className="grid grid-cols-3 gap-4 mt-12">
                {[
                  { id: 'stat-players', value: '10+', label: 'Happy Players' },
                  { id: 'stat-courts', value: '3', label: 'Premium Courts' },
                  { id: 'stat-hours', value: '18hrs', label: 'Daily Availability' },
                ].map((stat, index) => (
                  <motion.div
                    key={stat.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                  >
                    <div className="text-center">
                      <p className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-900 to-green-800 bg-clip-text text-transparent">
                        {stat.value}
                      </p>
                      <p className="text-xs md:text-sm text-gray-600 mt-1">{stat.label}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right Content - Hero Image */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="relative">
                {/* Decorative Elements */}
                <div className="absolute -top-6 -left-6 w-24 h-24 bg-emerald-400 rounded-2xl opacity-50 blur-lg"></div>
                <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-cyan-400 rounded-2xl opacity-50 blur-lg"></div>

                {/* Main Image Card */}
                <GlassCard className="p-4 hover:shadow-2xl transition-shadow duration-500">
                  <div className="rounded-2xl overflow-hidden relative h-64 md:h-96">
                    {heroSlides[currentSlide] && (
                      <motion.div
                        key={heroSlides[currentSlide].id}
                        initial={{ opacity: 0, scale: 1.02 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.7, ease: 'easeInOut' }}
                        className="absolute inset-0"
                      >
                        <ImageWithFallback
                          src={heroSlides[currentSlide].src}
                          alt={heroSlides[currentSlide].caption || 'Sports Court'}
                          className="w-full h-full object-cover"
                          loading={currentSlide === 0 ? 'eager' : 'lazy'}
                          fetchPriority={currentSlide === 0 ? 'high' : 'low'}
                        />
                      </motion.div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-sm px-3 py-2 shadow-lg">
                      {heroSlides.map((slide, index) => (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() => setCurrentSlide(index)}
                          className={`h-2 rounded-full transition-all duration-300 ${
                          index === currentSlide ? 'w-8 bg-green-900' : 'w-2 bg-gray-300 hover:bg-gray-400'
                          }`}
                          aria-label={`Show slide ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>

                </GlassCard>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-20 bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need in One Platform
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Powerful features designed to make court booking effortless
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                id: 'f-1',
                Icon: Calendar,
                title: 'Real-Time Booking',
                desc: 'Instantly book courts with live availability updates across all locations.',
              },
              {
                id: 'f-2',
                Icon: CreditCard,
                title: 'Flexible Subscriptions',
                desc: 'Monthly plans with fixed time slots designed for regular players.',
              },
              {
                id: 'f-3',
                Icon: Clock,
                title: '5 AM to 11 PM',
                desc: 'Extended hours across 3 premium courts to fit your schedule.',
              },
              {
                id: 'f-4',
                Icon: Shield,
                title: 'Secure Payments',
                desc: 'Safe and secure payment processing with instant confirmation.',
              },
            ].map((feature, index) => {
              const IconComponent = feature.Icon;
              return (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <GlassCard className="p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group">
                    <div className="w-14 h-14 bg-gradient-to-br from-green-900 to-green-800 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <IconComponent className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{feature.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 lg:order-1"
            >
              <GlassCard className="p-4 hover:shadow-2xl transition-shadow duration-500">
                <div className="rounded-2xl overflow-hidden">
                  <ImageWithFallback
                    src="/img6.jpg"
                    alt="About thecourtyard"
                    className="w-full h-64 md:h-96 object-cover"
                    loading="lazy"
                  />
                </div>
              </GlassCard>
            </motion.div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="order-1 lg:order-2"
            >
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-white/70 px-4 py-2 mb-5 shadow-sm"
              >
                <motion.span
                  className="h-2.5 w-2.5 rounded-full bg-green-800"
                  animate={{ scale: [1, 1.35, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
                <span className="text-sm font-semibold text-green-900 tracking-wide">Premium Experience</span>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.7, delay: 0.05 }}
                className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 leading-tight"
              >
                Why Choose{' '}
                <motion.span
                  className="relative inline-block text-green-900"
                  whileHover={{ scale: 1.03 }}
                >
                  thecourtyard?
                  <motion.span
                    className="absolute left-0 right-0 -bottom-1 h-3 rounded-full bg-green-200/70 -z-10"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    style={{ originX: 0 }}
                  />
                </motion.span>
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.7, delay: 0.12 }}
                className="text-lg text-gray-600 mb-6 leading-relaxed max-w-3xl"
              >
                We provide state-of-the-art sports facilities with a seamless booking experience.
                Our modern courts are equipped with professional-grade surfaces, lighting, and
                amenities. Whether you're a casual player or a serious athlete, thecourtyard
                offers the perfect environment for your game.
              </motion.p>

              <div className="space-y-4">
                {[
                  'Professional-grade court surfaces',
                  'Modern lighting and facilities',
                  'Easy online booking system',
                  'Flexible payment options',
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + index * 0.1, duration: 0.5 }}
                    whileHover={{ x: 4 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-900" />
                    </div>
                    <span className="text-gray-700">{item}</span>
                  </motion.div>
                ))}
              </div>

              <Button
                onClick={() => navigate('/user/booking')}
                className="mt-8 px-8 py-4 bg-gradient-to-r from-green-900 to-green-800 text-white rounded-xl hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold"
              >
                Start Booking Now
                <ArrowRight className="w-5 h-5 ml-2 inline" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-14 md:py-20 bg-gradient-to-r from-green-950 via-green-900 to-green-800">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 lg:gap-12">
            {[
              { id: 'stat-players', value: '10+', label: 'Happy Players' },
              { id: 'stat-courts', value: '3', label: 'Premium Courts' },
              { id: 'stat-hours', value: '18hrs', label: 'Daily Availability' },
              { id: 'stat-support', value: '24/7', label: 'Support Available' },
            ].map((stat, index) => (
              <motion.div
                key={stat.id}
                initial={{ opacity: 0, y: 18, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.55, ease: 'easeOut' }}
                className="text-center text-white"
              >
                <p className="text-4xl md:text-5xl font-bold mb-2 tracking-tight">{stat.value}</p>
                <p className="text-green-50/90 text-sm md:text-base">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Our Premium Courts
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Experience the best in sports facilities
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              { id: 'gallery-1', src: '/img1.jpg', alt: 'The Courtyard exterior' },
              { id: 'gallery-2', src: '/img3.webp', alt: 'Pickleball promotion board' },
              { id: 'gallery-3', src: '/img5.jpg', alt: 'Players on court' },
              { id: 'gallery-4', src: '/img4.webp', alt: 'Indoor court view' },
              { id: 'gallery-5', src: '/img6.jpg', alt: 'Community at the court' },
              { id: 'gallery-6', src: '/im2.jpg', alt: 'Court celebration moment' },
            ].map((image, index) => (
              <motion.div
                key={image.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.5 }}
              >
                <GlassCard className="p-4 hover:shadow-2xl transition-all duration-300 group overflow-hidden bg-white/90">
                  <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-gray-100">
                    <ImageWithFallback
                      src={image.src}
                      alt={image.alt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <GlassCard className="p-8 md:p-12 text-center bg-gradient-to-br from-green-50 to-green-50 border-2 border-green-200">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Ready to Book Your Court?
              </h2>
              <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                Join hundreds of players who trust thecourtyard for their sports needs
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-gradient-to-r from-green-900 to-green-800 text-white rounded-xl hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold text-lg"
                >
                  Book Your First Court
                  <ArrowRight className="w-5 h-5 ml-2 inline" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-white border-2 border-green-900 text-green-900 rounded-xl hover:bg-green-50 hover:shadow-lg transition-all duration-300 font-semibold text-lg"
                >
                  View Subscriptions
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="text-2xl font-bold bg-gradient-to-r from-green-900 to-green-800 bg-clip-text text-transparent mb-4">
            thecourtyard
          </div>
          <p className="text-gray-400 text-sm">
            © 2026 thecourtyard. All rights reserved. Your game, your schedule, your way.
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};


