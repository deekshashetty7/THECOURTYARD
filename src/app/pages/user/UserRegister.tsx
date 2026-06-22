import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Mail, Lock, User, Phone, ArrowLeft } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import { showErrorToast, showSuccessToast, showInfoToast } from '../../utils/notificationHelpers';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s()-]{10,16}$/;

const getPasswordError = (password: string) => {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter';
  }

  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter';
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number';
  }

  return '';
};

const mapRegisterError = (message: string) => {
  if (/rate limit|too many requests/i.test(message)) {
    return 'Too many attempts. Please wait a minute and try again.';
  }

  if (/already registered|user already registered|already exists/i.test(message)) {
    return 'This email is already registered. Please log in instead.';
  }

  if (/invalid email/i.test(message)) {
    return 'Please enter a valid email address.';
  }

  return message || 'Unable to create your account. Please try again.';
};

export const UserRegister = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({ name: '', phone: '', email: '', password: '', confirmPassword: '' });
    setFormError('');

    const normalizedName = formData.name.trim().replace(/\s+/g, ' ');
    const normalizedPhone = formData.phone.trim();
    const normalizedEmail = formData.email.trim().toLowerCase();
    const passwordError = getPasswordError(formData.password);

    // Validation
    let hasError = false;
    if (!normalizedName) {
      setErrors(prev => ({ ...prev, name: 'Name is required' }));
      hasError = true;
    } else if (normalizedName.length < 2) {
      setErrors(prev => ({ ...prev, name: 'Enter your full name' }));
      hasError = true;
    }

    if (!normalizedPhone) {
      setErrors(prev => ({ ...prev, phone: 'Phone number is required' }));
      hasError = true;
    } else if (!PHONE_PATTERN.test(normalizedPhone)) {
      setErrors(prev => ({ ...prev, phone: 'Enter a valid phone number' }));
      hasError = true;
    }

    if (!normalizedEmail) {
      setErrors(prev => ({ ...prev, email: 'Email is required' }));
      hasError = true;
    } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setErrors(prev => ({ ...prev, email: 'Enter a valid email address' }));
      hasError = true;
    }

    if (!formData.password) {
      setErrors(prev => ({ ...prev, password: 'Password is required' }));
      hasError = true;
    } else if (passwordError) {
      setErrors(prev => ({ ...prev, password: passwordError }));
      hasError = true;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      hasError = true;
    }

    if (hasError) {
      setLoading(false);
      return;
    }

    try {
      const result = await register(normalizedName, normalizedEmail, normalizedPhone, formData.password);
      showSuccessToast('Registration successful!');
      navigate('/user/home');
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Unable to register';
      const message = mapRegisterError(rawMessage);
      setFormError(message);
      showErrorToast('Registration failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </button>

        <GlassCard className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Create Account</h1>
            <p className="text-gray-600">Join thecourtyard today!</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <Input
              label="Full Name"
              type="text"
              placeholder="John Doe"
              icon={<User className="w-5 h-5" />}
              value={formData.name}
              autoComplete="name"
              onChange={(e) => {
                setFormData(prev => ({ ...prev, name: e.target.value }));
                if (errors.name) {
                  setErrors(prev => ({ ...prev, name: '' }));
                }
              }}
              error={errors.name}
            />

            <Input
              label="Phone Number"
              type="tel"
              placeholder="+91 98765 43210"
              icon={<Phone className="w-5 h-5" />}
              value={formData.phone}
              autoComplete="tel"
              onChange={(e) => {
                setFormData(prev => ({ ...prev, phone: e.target.value }));
                if (errors.phone) {
                  setErrors(prev => ({ ...prev, phone: '' }));
                }
              }}
              error={errors.phone}
            />

            <Input
              label="Email (Gmail)"
              type="email"
              placeholder="your.email@gmail.com"
              icon={<Mail className="w-5 h-5" />}
              value={formData.email}
              autoComplete="email"
              onChange={(e) => {
                setFormData(prev => ({ ...prev, email: e.target.value }));
                if (errors.email) {
                  setErrors(prev => ({ ...prev, email: '' }));
                }
              }}
              error={errors.email}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Create a strong password"
              icon={<Lock className="w-5 h-5" />}
              value={formData.password}
              autoComplete="new-password"
              onChange={(e) => {
                setFormData(prev => ({ ...prev, password: e.target.value }));
                if (errors.password) {
                  setErrors(prev => ({ ...prev, password: '' }));
                }
              }}
              error={errors.password}
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              icon={<Lock className="w-5 h-5" />}
              value={formData.confirmPassword}
              autoComplete="new-password"
              onChange={(e) => {
                setFormData(prev => ({ ...prev, confirmPassword: e.target.value }));
                if (errors.confirmPassword) {
                  setErrors(prev => ({ ...prev, confirmPassword: '' }));
                }
              }}
              error={errors.confirmPassword}
            />

            <Button type="submit" variant="primary" className="w-full" loading={loading}>
              Register
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/user/login" className="text-[#808000] hover:text-[#5D5E1F] font-medium">
              Login here
            </Link>
          </p>
        </GlassCard>
      </div>
    </div>
  );
};

