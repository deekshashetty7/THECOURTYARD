import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Mail, Lock, User, Phone, AlertCircle, CheckCircle, Loader, ArrowLeft } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../../components/ui/input-otp';
import { getAPI_BASE_URL } from '../../lib/apiConfig';
import { setAuthTokens } from '../../lib/authToken';

const AUTH_STORAGE_KEY = 'tcy.auth.user.v1';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s()-]{10,16}$/;
const OTP_COOLDOWN_SEC = 30;

interface FormErrors {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const OTPRegistration = () => {
  const navigate = useNavigate();
  const [registrationId, setRegistrationId] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [formError, setFormError] = useState('');

  const [emailOTP, setEmailOTP] = useState('');
  const [emailOTPError, setEmailOTPError] = useState('');
  const [emailSendError, setEmailSendError] = useState('');
  const [emailOTPLoading, setEmailOTPLoading] = useState(false);
  const [emailSendLoading, setEmailSendLoading] = useState(false);
  const [emailSendCooldown, setEmailSendCooldown] = useState(0);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  const [success, setSuccess] = useState(false);
  const [emailDevHint, setEmailDevHint] = useState('');
  const [emailSendSuccess, setEmailSendSuccess] = useState('');

  const isEmailValid = EMAIL_PATTERN.test(formData.email.trim().toLowerCase());

  const validatePassword = (password: string): string => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must include at least one number';
    return '';
  };

  const validateRegistrationFields = (): boolean => {
    setFormError('');
    setFormErrors({ name: '', phone: '', email: '', password: '', confirmPassword: '' });

    const normalizedName = formData.name.trim().replace(/\s+/g, ' ');
    const normalizedPhone = formData.phone.trim();
    const normalizedEmail = formData.email.trim().toLowerCase();
    const passwordError = validatePassword(formData.password);

    let hasError = false;
    const newErrors: FormErrors = { name: '', phone: '', email: '', password: '', confirmPassword: '' };

    if (!normalizedName || normalizedName.length < 2) {
      newErrors.name = 'Enter your full name';
      hasError = true;
    }
    if (!normalizedPhone || !PHONE_PATTERN.test(normalizedPhone)) {
      newErrors.phone = 'Enter a valid phone number';
      hasError = true;
    }
    if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
      newErrors.email = 'Enter a valid email address';
      hasError = true;
    }
    if (!formData.password || passwordError) {
      newErrors.password = passwordError || 'Password is required';
      hasError = true;
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      hasError = true;
    }

    if (hasError) {
      setFormErrors(newErrors);
      setFormError('Please complete all fields before sending OTP.');
      return false;
    }
    return true;
  };

  const startCooldown = (setter: React.Dispatch<React.SetStateAction<number>>) => {
    setter(OTP_COOLDOWN_SEC);
    const interval = setInterval(() => {
      setter((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const applyEmailOtpDeliveryResult = (data: { emailSent?: boolean }) => {
    setEmailDevHint('');
    if (data.emailSent) {
      setEmailSendSuccess('OTP sent to your email. Check your inbox and spam folder.');
    }
  };

  const handleSendEmailOTP = async () => {
    if (emailSendCooldown > 0 || emailVerified) return;
    if (!validateRegistrationFields()) return;

    setEmailSendLoading(true);
    setEmailOTPError('');
    setEmailSendError('');
    setEmailSendSuccess('');
    setFormError('');
    setEmailDevHint('');
    try {
      const normalizedName = formData.name.trim().replace(/\s+/g, ' ');
      const normalizedPhone = formData.phone.trim();
      const normalizedEmail = formData.email.trim().toLowerCase();

      let data: Record<string, unknown> = {};

      if (!registrationId) {
        const response = await fetch(`${getAPI_BASE_URL()}/auth/register-start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: normalizedName,
            email: normalizedEmail,
            phone: normalizedPhone,
            password: formData.password,
          }),
        });
        data = await response.json();
        if (!response.ok) {
          const apiMessage = (data as { error?: { message?: string }; message?: string }).error?.message || (data as { message?: string }).message || 'Failed to send email OTP';
          if (response.status === 409) {
            if (/phone already registered/i.test(apiMessage)) {
              throw new Error('This phone number is already registered. Use a different phone number or log in instead.');
            }
            if (/email already registered/i.test(apiMessage)) {
              throw new Error('This email is already registered. Log in instead or use a different email.');
            }
            throw new Error(`${apiMessage}. Use different details or log in instead.`);
          }
          throw new Error(apiMessage);
        }
        setRegistrationId(String(data.registrationId || ''));
      } else {
        const response = await fetch(`${getAPI_BASE_URL()}/auth/resend-email-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationId }),
        });
        data = await response.json();
        if (!response.ok) {
          if (response.status === 404) {
            setRegistrationId('');
            throw new Error('Session expired. Click Send OTP again to get a fresh code.');
          }
          throw new Error((data as { error?: { message?: string }; message?: string }).error?.message || (data as { message?: string }).message || 'Failed to resend email OTP');
        }
      }

      applyEmailOtpDeliveryResult(data as { emailSent?: boolean });

      setRegistrationId(String(data.registrationId || registrationId));
      setEmailOtpSent(true);
      setEmailOTP('');
      startCooldown(setEmailSendCooldown);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send email OTP';
      setEmailSendError(message);
      setFormError(message);
    } finally {
      setEmailSendLoading(false);
    }
  };

  const handleEmailOTPVerify = async () => {
    setEmailOTPError('');
    if (emailOTP.length !== 6) {
      setEmailOTPError('Please enter a 6-digit OTP');
      return;
    }

    setEmailOTPLoading(true);
    try {
      const response = await fetch(`${getAPI_BASE_URL()}/auth/verify-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, otpCode: emailOTP }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || data.message || 'Failed to verify email OTP');
      }

      if (data.accessToken) {
        setAuthTokens(data.accessToken, data.refreshToken);
      }
      if (data.user) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
      }

      setEmailVerified(true);
      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/user/home';
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify email OTP';
      setEmailOTPError(message);
      if (message.toLowerCase().includes('expired') || message.toLowerCase().includes('invalid otp')) {
        setEmailSendCooldown(0);
        setEmailOTP('');
      }
    } finally {
      setEmailOTPLoading(false);
    }
  };

  const renderSendOTPButton = (
    onClick: () => void,
    loading: boolean,
    cooldown: number,
    visible: boolean,
    disabled?: boolean,
  ) => {
    if (!visible) return null;
    return (
      <Button
        type="button"
        size="sm"
        className="shrink-0 mt-0"
        onClick={onClick}
        loading={loading}
        disabled={disabled || cooldown > 0}
      >
        {cooldown > 0 ? `${cooldown}s` : 'Send OTP'}
      </Button>
    );
  };

  const renderFieldRow = ({
    label,
    icon,
    type,
    value,
    onChange,
    placeholder,
    error,
    disabled,
    sendButton,
    sendError,
    sendSuccess,
    devHint,
    otpSent,
    otp,
    setOtp,
    otpError,
    otpLoading,
    onVerify,
    verifyLabel,
    verified,
  }: {
    label: string;
    icon: React.ReactNode;
    type: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    error?: string;
    disabled?: boolean;
    sendButton: React.ReactNode;
    sendError?: string;
    sendSuccess?: string;
    devHint?: string;
    otpSent?: boolean;
    otp?: string;
    setOtp?: (v: string) => void;
    otpError?: string;
    otpLoading?: boolean;
    onVerify?: () => void;
    verifyLabel?: string;
    verified?: boolean;
  }) => (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-60 ${
              error ? 'border-red-500 focus:ring-red-500' : ''
            }`}
          />
        </div>
        {sendButton}
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      {sendError && <p className="mt-1 text-sm text-red-500">{sendError}</p>}
      {sendSuccess && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{sendSuccess}</span>
        </div>
      )}
      {devHint && (
        <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {devHint}
        </p>
      )}

      {verified && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span>Verified</span>
        </div>
      )}

      {otpSent && !verified && setOtp && (
        <div className="mt-3 space-y-3">
          <label className="block text-sm font-medium text-gray-700">OTP Code</label>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              pattern="[0-9]*"
              containerClassName="gap-2"
            >
              <InputOTPGroup className="gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="h-11 w-11 rounded-lg border border-gray-200 bg-gray-50 text-base font-semibold first:rounded-lg last:rounded-lg data-[active=true]:ring-2 data-[active=true]:ring-primary data-[active=true]:border-transparent"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {otpError && (
            <div className="text-center space-y-1">
              <p className="text-sm text-red-500">{otpError}</p>
              {otpError.toLowerCase().includes('expired') && (
                <p className="text-sm text-gray-600">Tap Send OTP above to receive a new code.</p>
              )}
              {otpError.toLowerCase().includes('invalid otp') && (
                <p className="text-sm text-gray-600">Use the code from your most recent email, then tap Send OTP if you need a new one.</p>
              )}
            </div>
          )}
          <Button
            type="button"
            className="w-full"
            size="sm"
            loading={otpLoading}
            disabled={!otp || otp.length !== 6}
            onClick={onVerify}
          >
            {verifyLabel}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 pt-20 pb-20 px-4">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </button>

        <GlassCard className="p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Create Account</h1>
          <p className="text-gray-600 mb-8">Join thecourtyard today!</p>

          {formError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{formError}</p>
            </div>
          )}

          {success ? (
            <div className="text-center py-10">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3">Welcome!</h2>
              <p className="text-gray-600 mb-8">Your account has been created successfully.</p>
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Loader className="w-5 h-5 animate-spin" />
                <p>Redirecting to home...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <Input
                label="Full Name *"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your full name"
                icon={<User className="w-5 h-5" />}
                error={formErrors.name}
                disabled={emailOtpSent}
              />

              <Input
                label="Password *"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Create a strong password"
                icon={<Lock className="w-5 h-5" />}
                error={formErrors.password}
                disabled={emailOtpSent}
              />

              <Input
                label="Confirm Password *"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Confirm your password"
                icon={<Lock className="w-5 h-5" />}
                error={formErrors.confirmPassword}
                disabled={emailOtpSent}
              />

              <Input
                label="Phone Number *"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
                icon={<Phone className="w-5 h-5" />}
                error={formErrors.phone}
                disabled={emailOtpSent}
              />

              {renderFieldRow({
                label: 'Email (Gmail) *',
                icon: <Mail className="w-5 h-5" />,
                type: 'email',
                value: formData.email,
                onChange: (v) => setFormData({ ...formData, email: v }),
                placeholder: 'you@gmail.com',
                error: formErrors.email,
                disabled: emailOtpSent || emailVerified,
                sendButton: renderSendOTPButton(
                  handleSendEmailOTP,
                  emailSendLoading,
                  emailSendCooldown,
                  isEmailValid,
                  emailVerified,
                ),
                sendError: emailSendError,
                sendSuccess: emailSendSuccess,
                devHint: emailDevHint,
                otpSent: emailOtpSent,
                otp: emailOTP,
                setOtp: setEmailOTP,
                otpError: emailOTPError,
                otpLoading: emailOTPLoading,
                onVerify: handleEmailOTPVerify,
                verifyLabel: 'Verify & Complete',
                verified: emailVerified,
              })}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};
