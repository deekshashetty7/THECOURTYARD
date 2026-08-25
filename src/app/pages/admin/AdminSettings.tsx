import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { DollarSign, Save, Image, MapPin, Phone, Mail, Star, Clock, Layout, Plus, Trash2, Eye, Settings as SettingsIcon, Palette, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useLandingPage } from '../../context/LandingPageContext';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { getAPI_BASE_URL } from '../../lib/apiConfig';
import { getAuthAccessToken } from '../../lib/authToken';
import { invalidateCachedJson } from '../../lib/responseCache';
import { Calendar, CreditCard, Shield, Zap, Users, Award } from 'lucide-react';
import { showErrorToast, showSuccessToast } from '../../utils/notificationHelpers';

const readFileAsDataUrl = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read selected file'));
    reader.readAsDataURL(file);
  });
};

const iconOptions = [
  { value: 'Calendar', label: 'Calendar', Icon: Calendar },
  { value: 'CreditCard', label: 'Credit Card', Icon: CreditCard },
  { value: 'Clock', label: 'Clock', Icon: Clock },
  { value: 'Shield', label: 'Shield', Icon: Shield },
  { value: 'Zap', label: 'Zap', Icon: Zap },
  { value: 'Users', label: 'Users', Icon: Users },
  { value: 'Award', label: 'Award', Icon: Award },
  { value: 'Star', label: 'Star', Icon: Star },
];

export const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'landing'>('general');
  const navigate = useNavigate();
  const { content, updateContent } = useLandingPage();
  const { appSettings, courtBlocks, createCourtBlock, deleteCourtBlock } = useBooking();
  const { user } = useAuth();
  const [landingFormData, setLandingFormData] = useState(content);
  const [showPreview, setShowPreview] = useState(false);
  const [blockDate, setBlockDate] = useState('');
  const [blockType, setBlockType] = useState<'day' | 'hour'>('day');
  const [blockTimeSlot, setBlockTimeSlot] = useState('');
  const [blockSelectedCourts, setBlockSelectedCourts] = useState<number[]>([]);
  const [blockReason, setBlockReason] = useState('');
  const [blocking, setBlocking] = useState(false);

  const [pricing, setPricing] = useState({
    weekdayPrice: appSettings.pricing.offPeak,
    weekendPrice: appSettings.pricing.peak,
    monthlySubscription: appSettings.pricing.subscription,
  });

  const [courtDetails, setCourtDetails] = useState({
    name: typeof appSettings.landing.venueName === 'string' ? appSettings.landing.venueName : '',
    address: typeof appSettings.landing.venueAddress === 'string' ? appSettings.landing.venueAddress : '',
    phone: typeof appSettings.landing.venuePhone === 'string' ? appSettings.landing.venuePhone : '',
    email: typeof appSettings.landing.venueEmail === 'string' ? appSettings.landing.venueEmail : '',
    operatingHours: typeof appSettings.landing.venueOperatingHoursText === 'string' ? appSettings.landing.venueOperatingHoursText : '',
    rating: typeof appSettings.landing.venueRating === 'number' ? appSettings.landing.venueRating : 0,
  });

  const [saved, setSaved] = useState(false);
  const [aboutImageUploading, setAboutImageUploading] = useState(false);

  useEffect(() => {
    setLandingFormData(content);
  }, [content]);

  useEffect(() => {
    setPricing({
      weekdayPrice: appSettings.pricing.offPeak,
      weekendPrice: appSettings.pricing.peak,
      monthlySubscription: appSettings.pricing.subscription,
    });

    setCourtDetails({
      name: typeof appSettings.landing.venueName === 'string' ? appSettings.landing.venueName : '',
      address: typeof appSettings.landing.venueAddress === 'string' ? appSettings.landing.venueAddress : '',
      phone: typeof appSettings.landing.venuePhone === 'string' ? appSettings.landing.venuePhone : '',
      email: typeof appSettings.landing.venueEmail === 'string' ? appSettings.landing.venueEmail : '',
      operatingHours: typeof appSettings.landing.venueOperatingHoursText === 'string' ? appSettings.landing.venueOperatingHoursText : '',
      rating: typeof appSettings.landing.venueRating === 'number' ? appSettings.landing.venueRating : 0,
    });
  }, [appSettings]);

  useEffect(() => {
    setBlockSelectedCourts(appSettings.courts.map((_, index) => index + 1));
  }, [appSettings.courts]);

  const courtOptions = useMemo(() => {
    return appSettings.courts.map((courtName, index) => ({
      value: index + 1,
      label: courtName || `Court ${index + 1}`,
    }));
  }, [appSettings.courts]);

  const timeOptions = useMemo(() => {
    return Array.from(
      { length: Math.max(0, appSettings.operatingHours.endHour - appSettings.operatingHours.startHour + 1) },
      (_, index) => {
        const hour24 = appSettings.operatingHours.startHour + index;
        const startHour12 = hour24 % 12 || 12;
        const startPeriod = hour24 >= 12 ? 'PM' : 'AM';
        const endHour24 = (hour24 + 1) % 24;
        const endHour12 = endHour24 % 12 || 12;
        const endPeriod = endHour24 >= 12 ? 'PM' : 'AM';

        return {
          value: `${startHour12}:00 ${startPeriod} - ${endHour12}:00 ${endPeriod}`,
          label: `${startHour12}:00 ${startPeriod} - ${endHour12}:00 ${endPeriod}`,
        };
      }
    );
  }, [appSettings.operatingHours.endHour, appSettings.operatingHours.startHour]);

  const saveSettings = async (payload: Record<string, unknown>) => {
    if (!user) {
      throw new Error('Please sign in again to save settings');
    }

    const token = await getAuthAccessToken();
    if (!token) {
      throw new Error('Please sign in again to save settings');
    }

    const response = await fetch(`${getAPI_BASE_URL()}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.error?.message || 'Unable to save settings');
    }

    // Invalidate settings cache so fresh data is fetched next time
    invalidateCachedJson('tcy.api.settings.v1');
    
    // Notify other components to refresh
    window.dispatchEvent(new CustomEvent('tcy:settings-updated'));
    try { window.localStorage.setItem('tcy:settings-updated', String(Date.now())); } catch {}
    
    return result;
  };

  const handleSavePricing = async () => {
    try {
      const response = await saveSettings({
        pricing: {
          offPeak: pricing.weekdayPrice,
          peak: pricing.weekendPrice,
          subscription: pricing.monthlySubscription,
        },
      });

      // Update local state with server response
      if (response?.settings?.pricing) {
        setPricing({
          weekdayPrice: response.settings.pricing.offPeak,
          weekendPrice: response.settings.pricing.peak,
          monthlySubscription: response.settings.pricing.subscription,
        });
      }

      setSaved(true);
      showSuccessToast('Pricing updated successfully!');
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save pricing';
      showErrorToast('Save failed', message);
      console.error('Failed to save pricing', error);
    }
  };

  const handleSaveDetails = async () => {
    try {
      const response = await saveSettings({
        landing: {
          venueName: courtDetails.name,
          venueAddress: courtDetails.address,
          venuePhone: courtDetails.phone,
          venueEmail: courtDetails.email,
          venueOperatingHoursText: courtDetails.operatingHours,
          venueRating: courtDetails.rating,
        },
      });

      // Update local state with server response
      if (response?.settings?.landing) {
        const landing = response.settings.landing;
        setCourtDetails({
          name: typeof landing.venueName === 'string' ? landing.venueName : '',
          address: typeof landing.venueAddress === 'string' ? landing.venueAddress : '',
          phone: typeof landing.venuePhone === 'string' ? landing.venuePhone : '',
          email: typeof landing.venueEmail === 'string' ? landing.venueEmail : '',
          operatingHours: typeof landing.venueOperatingHoursText === 'string' ? landing.venueOperatingHoursText : '',
          rating: typeof landing.venueRating === 'number' ? landing.venueRating : 0,
        });
      }

      setSaved(true);
      showSuccessToast('Court details updated successfully!');
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save court details';
      showErrorToast('Save failed', message);
      console.error('Failed to save court details', error);
    }
  };

  const handleCreateCourtBlock = async () => {
    if (!blockDate) {
      showErrorToast('Missing date', 'Please choose a date to block.');
      return;
    }

    if (!blockSelectedCourts.length) {
      showErrorToast('Missing courts', 'Please select at least one court.');
      return;
    }

    if (blockType === 'hour' && !blockTimeSlot) {
      showErrorToast('Missing time slot', 'Please select an hour to block.');
      return;
    }

    try {
      setBlocking(true);
      const block = await createCourtBlock({
        date: blockDate,
        blockType,
        courts: blockSelectedCourts,
        allCourts: blockSelectedCourts.length === appSettings.courts.length,
        timeSlot: blockType === 'hour' ? blockTimeSlot : null,
        reason: blockReason || null,
      });

      showSuccessToast('Court blocked', `${block.blockType === 'day' ? 'Full-day' : 'Hourly'} block created successfully.`);
      setBlockDate('');
      setBlockType('day');
      setBlockTimeSlot('');
      setBlockReason('');
      setBlockSelectedCourts(appSettings.courts.map((_, index) => index + 1));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create court block';
      showErrorToast('Error', message);
    } finally {
      setBlocking(false);
    }
  };

  // Landing page handlers
  const handleInputChange = (field: string, value: string) => {
    setLandingFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFeatureChange = (index: number, field: string, value: string) => {
    const newFeatures = [...landingFormData.features];
    newFeatures[index] = { ...newFeatures[index], [field]: value };
    setLandingFormData((prev) => ({ ...prev, features: newFeatures }));
  };

  const handleStatChange = (index: number, field: string, value: string) => {
    const newStats = [...landingFormData.stats];
    newStats[index] = { ...newStats[index], [field]: value };
    setLandingFormData((prev) => ({ ...prev, stats: newStats }));
  };

  const addFeature = () => {
    const newFeature = {
      id: Date.now().toString(),
      icon: 'Calendar',
      title: 'New Feature',
      description: 'Feature description',
    };
    setLandingFormData((prev) => ({ ...prev, features: [...prev.features, newFeature] }));
  };

  const removeFeature = (index: number) => {
    const newFeatures = landingFormData.features.filter((_, i) => i !== index);
    setLandingFormData((prev) => ({ ...prev, features: newFeatures }));
  };

  const addStat = () => {
    const newStat = {
      id: Date.now().toString(),
      value: '0',
      label: 'New Stat',
    };
    setLandingFormData((prev) => ({ ...prev, stats: [...prev.stats, newStat] }));
  };

  const removeStat = (index: number) => {
    const newStats = landingFormData.stats.filter((_, i) => i !== index);
    setLandingFormData((prev) => ({ ...prev, stats: newStats }));
  };

  const handleSaveLanding = async () => {
    await updateContent(landingFormData);
    showSuccessToast('Landing page updated successfully!');
  };

  const handleAboutImageUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    setAboutImageUploading(true);

    try {
      const token = await getAuthAccessToken();
      if (!token) {
        throw new Error('Please sign in again to upload images');
      }

      const image = await readFileAsDataUrl(file);
      const response = await fetch(`${getAPI_BASE_URL()}/admin/gallery/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image, fileName: file.name }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.upload?.secureUrl) {
        throw new Error(payload?.error?.message || 'Unable to upload image');
      }

      const uploadedUrl = payload.upload.secureUrl as string;
      await saveSettings({
        landing: {
          aboutImage: uploadedUrl,
        },
      });

      setLandingFormData((prev) => ({
        ...prev,
        aboutImage: uploadedUrl,
      }));
      showSuccessToast('About image uploaded and saved successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to upload image';
      showErrorToast('Upload failed', message);
    } finally {
      setAboutImageUploading(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General Settings', icon: SettingsIcon },
    { id: 'landing', label: 'Landing Page', icon: Palette },
  ];

  return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your court booking system</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'general' | 'landing')}
                className={`flex items-center gap-2 px-6 py-3 font-medium transition-all border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-green-900 text-green-900'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* General Settings Tab */}
        {activeTab === 'general' && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Pricing Settings */}
            <GlassCard className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-900" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Pricing Configuration</h2>
                  <p className="text-sm text-gray-600">Set pricing for different time slots</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weekday Price (Per Hour)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="number"
                      value={pricing.weekdayPrice}
                      onChange={(e) => setPricing({ ...pricing, weekdayPrice: Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#808000] focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Monday to Friday (5 AM - 5 PM)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weekend Price (Per Hour)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="number"
                      value={pricing.weekendPrice}
                      onChange={(e) => setPricing({ ...pricing, weekendPrice: Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#808000] focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Saturday and Sunday (All day)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Subscription
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="number"
                      value={pricing.monthlySubscription}
                      onChange={(e) => setPricing({ ...pricing, monthlySubscription: Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#808000] focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Monthly subscription for regular users</p>
                </div>

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleSavePricing}
                >
                  <Save className="w-5 h-5" />
                  {saved ? 'Saved!' : 'Save Pricing'}
                </Button>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Court Block Manager</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Block one court, multiple courts, or all three courts for a full day or a selected hour. No payment is collected for blocks.
                  </p>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                  Existing subscription holders on a blocked weekday get an automatic extension.
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Block date</label>
                  <input
                    type="date"
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:border-[#808000] focus:outline-none focus:ring-2 focus:ring-[#808000]/20"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Block type</label>
                    <select
                      value={blockType}
                      onChange={(e) => setBlockType(e.target.value === 'hour' ? 'hour' : 'day')}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:border-[#808000] focus:outline-none focus:ring-2 focus:ring-[#808000]/20"
                    >
                      <option value="day">Entire day</option>
                      <option value="hour">Specific hour</option>
                    </select>
                  </div>

                  {blockType === 'hour' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Hour</label>
                      <select
                        value={blockTimeSlot}
                        onChange={(e) => setBlockTimeSlot(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:border-[#808000] focus:outline-none focus:ring-2 focus:ring-[#808000]/20"
                      >
                        <option value="">Select hour</option>
                        {timeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 flex items-center">
                      Full-day blocks cover every operating hour.
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Courts</label>
                    <button
                      type="button"
                      onClick={() => setBlockSelectedCourts(appSettings.courts.map((_, index) => index + 1))}
                      className="text-xs font-medium text-[#808000] hover:text-[#5D5E1F]"
                    >
                      Select all
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {courtOptions.map((court) => (
                      <label key={court.value} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={blockSelectedCourts.includes(court.value)}
                          onChange={(e) => {
                            setBlockSelectedCourts((prev) => {
                              if (e.target.checked) {
                                return Array.from(new Set([...prev, court.value])).sort((a, b) => a - b);
                              }

                              return prev.filter((value) => value !== court.value);
                            });
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-[#808000] focus:ring-[#808000]"
                        />
                        <span>{court.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason / note</label>
                  <textarea
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    rows={3}
                    placeholder="Optional reason for the block"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:border-[#808000] focus:outline-none focus:ring-2 focus:ring-[#808000]/20"
                  />
                </div>

                <Button
                  onClick={handleCreateCourtBlock}
                  loading={blocking}
                  className="w-full md:w-auto"
                >
                  <Clock className="w-5 h-5" />
                  Block Court Schedule
                </Button>
              </div>
            </GlassCard>

            {/* Court Details */}
            <GlassCard className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Court Information</h2>
                  <p className="text-sm text-gray-600">Update court details</p>
                </div>
              </div>

              <div className="space-y-4">
                <Input
                  label="Court Name"
                  value={courtDetails.name}
                  onChange={(e) => setCourtDetails({ ...courtDetails, name: e.target.value })}
                  icon={<Star className="w-5 h-5" />}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <textarea
                    value={courtDetails.address}
                    onChange={(e) => setCourtDetails({ ...courtDetails, address: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#808000] focus:border-transparent min-h-[80px]"
                  />
                </div>

                <Input
                  label="Contact Phone"
                  value={courtDetails.phone}
                  onChange={(e) => setCourtDetails({ ...courtDetails, phone: e.target.value })}
                  icon={<Phone className="w-5 h-5" />}
                />

                <Input
                  label="Email"
                  type="email"
                  value={courtDetails.email}
                  onChange={(e) => setCourtDetails({ ...courtDetails, email: e.target.value })}
                  icon={<Mail className="w-5 h-5" />}
                />

                <Input
                  label="Operating Hours"
                  value={courtDetails.operatingHours}
                  onChange={(e) => setCourtDetails({ ...courtDetails, operatingHours: e.target.value })}
                  icon={<Clock className="w-5 h-5" />}
                />

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleSaveDetails}
                >
                  <Save className="w-5 h-5" />
                  {saved ? 'Saved!' : 'Save Details'}
                </Button>
              </div>
            </GlassCard>

            {/* Current Blocks */}
            <GlassCard className="p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Current Blocks</h2>
                <span className="text-xs font-medium text-gray-500">{courtBlocks.length} active</span>
              </div>

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {courtBlocks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                    No court blocks have been created yet.
                  </div>
                ) : (
                  courtBlocks.map((block) => (
                    <div key={block.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800">
                            {format(new Date(block.date), 'MMM d, yyyy')} · {block.blockType === 'day' ? 'Full day' : block.timeSlot}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {block.allCourts
                              ? 'All courts'
                              : block.courts.map((court) => courtOptions.find((item) => item.value === court)?.label || `Court ${court}`).join(', ')}
                          </p>
                          {block.reason && <p className="text-sm text-gray-600 mt-2">{block.reason}</p>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await deleteCourtBlock(block.id);
                              showSuccessToast('Block removed', 'Court block deleted successfully.');
                            } catch (error) {
                              const message = error instanceof Error ? error.message : 'Unable to delete court block';
                              showErrorToast('Error', message);
                            }
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>

            {/* Photos Management */}
            <GlassCard className="p-6 lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Image className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Photos</h2>
                  <p className="text-sm text-gray-600">Manage the photos displayed to users.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                  <div>
                    <p className="font-medium text-gray-800">Open photos manager</p>
                    <p className="text-sm text-gray-600">Add, edit, and delete photos on a dedicated page.</p>
                  </div>
                  <Button variant="primary" onClick={() => navigate('/admin/photos')}>
                    <Plus className="w-4 h-4" />
                    Manage Photos
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {landingFormData.gallery.map((image) => (
                    <div key={image.id} className="relative group">
                      <div className="aspect-video bg-gray-200 rounded-xl overflow-hidden">
                        <img
                          src={image.url}
                          alt={image.caption}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Landing Page Tab */}
        {activeTab === 'landing' && (
          <div className="space-y-6">
            {/* Header with Save Button */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Landing Page Editor</h2>
                <p className="text-gray-600">Customize the content shown to visitors</p>
              </div>
              <Button
                onClick={handleSaveLanding}
                className="bg-gradient-to-r from-green-900 to-green-800 text-white flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </div>

            <GlassCard className="p-6 border border-yellow-100 bg-white/80">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center shrink-0">
                    <Image className="w-6 h-6 text-green-900" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">User Photos</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Add or delete the photos that appear in the user gallery.
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Current photos: {landingFormData.gallery.length}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => navigate('/admin/photos')}
                  variant="primary"
                  className="whitespace-nowrap"
                >
                  Manage Photos
                </Button>
              </div>
            </GlassCard>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Hero Section */}
              <GlassCard className="p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Layout className="w-5 h-5 text-green-900" />
                  Hero Section
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hero Title</label>
                    <input
                      type="text"
                      value={landingFormData.heroTitle}
                      onChange={(e) => handleInputChange('heroTitle', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-700 focus:border-yellow-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hero Subtitle</label>
                    <input
                      type="text"
                      value={landingFormData.heroSubtitle}
                      onChange={(e) => handleInputChange('heroSubtitle', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-700 focus:border-yellow-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hero Description</label>
                    <textarea
                      value={landingFormData.heroDescription}
                      onChange={(e) => handleInputChange('heroDescription', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-700 focus:border-yellow-700"
                    />
                  </div>
                </div>
              </GlassCard>

              {/* Features Section */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Star className="w-5 h-5 text-green-900" />
                    Features
                  </h3>
                  <Button size="sm" onClick={addFeature} variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {landingFormData.features.map((feature, index) => (
                    <div key={feature.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <select
                          value={feature.icon}
                          onChange={(e) => handleFeatureChange(index, 'icon', e.target.value)}
                          className="text-sm px-3 py-1 border border-gray-300 rounded-lg"
                        >
                          {iconOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeFeature(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={feature.title}
                        onChange={(e) => handleFeatureChange(index, 'title', e.target.value)}
                        placeholder="Feature Title"
                        className="w-full px-3 py-2 mb-2 text-sm border border-gray-300 rounded-lg"
                      />
                      <textarea
                        value={feature.description}
                        onChange={(e) => handleFeatureChange(index, 'description', e.target.value)}
                        placeholder="Feature Description"
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Stats Section */}
              <GlassCard className="p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Award className="w-5 h-5 text-green-900" />
                    Statistics
                  </h3>
                  <Button size="sm" onClick={addStat} variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                  {landingFormData.stats.map((stat, index) => (
                    <div key={stat.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={() => removeStat(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={stat.value}
                        onChange={(e) => handleStatChange(index, 'value', e.target.value)}
                        placeholder="1000+"
                        className="w-full px-3 py-2 mb-2 text-sm border border-gray-300 rounded-lg font-bold text-center"
                      />
                      <input
                        type="text"
                        value={stat.label}
                        onChange={(e) => handleStatChange(index, 'label', e.target.value)}
                        placeholder="Stat Label"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-center"
                      />
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="p-6 lg:col-span-2">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Image className="w-5 h-5 text-green-900" />
                  About Section Image
                </h3>

                <div className="grid md:grid-cols-2 gap-6 items-start">
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-[4/3]">
                    {landingFormData.aboutImage ? (
                      <img
                        src={landingFormData.aboutImage}
                        alt="About section preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                        No image selected
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Upload an image for the landing page About section.
                    </p>
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 cursor-pointer text-sm font-medium text-gray-700">
                      <Upload className="w-4 h-4" />
                      {aboutImageUploading ? 'Uploading...' : 'Choose Image'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        disabled={aboutImageUploading}
                        onChange={(e) => {
                          void handleAboutImageUpload(e.target.files?.[0] || null);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <p className="text-xs text-gray-500">
                      Supported formats: PNG, JPG, JPEG, WEBP. Uploading will save this image immediately.
                    </p>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        )}
      </div>
  );
};


