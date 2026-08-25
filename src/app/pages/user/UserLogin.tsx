import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Mail, Lock, ArrowLeft } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import { showErrorToast, showInfoToast, showSuccessToast } from '../../utils/notificationHelpers';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const mapLoginError = (message: string) => {
  if (/timed out|timeout/i.test(message)) {
    return 'Login is taking too long. Please check your internet and try again.';
  }

  if (/invalid login credentials|invalid credentials|invalid email or password/i.test(message)) {
    return 'Invalid email or password.';
  }

  if (/rate limit|too many requests/i.test(message)) {
    return 'Too many attempts. Please wait a minute and try again.';
  }

  return message || 'Unable to sign in. Please try again.';
};

export const UserLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const storedNotice = window.sessionStorage.getItem('tcy.auth.notice');
    if (storedNotice) {
      setNotice(storedNotice);
      window.sessionStorage.removeItem('tcy.auth.notice');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({ email: '', password: '' });

    const normalizedEmail = formData.email.trim().toLowerCase();

    // Validation
    if (!normalizedEmail) {
      setErrors(prev => ({ ...prev, email: 'Email is required' }));
      setLoading(false);
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setErrors(prev => ({ ...prev, email: 'Enter a valid email address' }));
      setLoading(false);
      return;
    }

    if (!formData.password) {
      setErrors(prev => ({ ...prev, password: 'Password is required' }));
      setLoading(false);
      return;
    }

    try {
      await login(normalizedEmail, formData.password, 'user');
      navigate('/user/home');
      showSuccessToast('Login successful!');
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Unable to sign in';
      const message = mapLoginError(rawMessage);
      setErrors(prev => ({ ...prev, password: message }));
      showErrorToast('Login failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50 flex items-center justify-center p-4">
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
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back!</h1>
            <p className="text-gray-600">Login to book your favorite courts</p>
          </div>

          {notice && (
            <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Email"
              type="email"
              placeholder="your.email@example.com"
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
              placeholder="Enter your password"
              icon={<Lock className="w-5 h-5" />}
              value={formData.password}
              autoComplete="current-password"
              onChange={(e) => {
                setFormData(prev => ({ ...prev, password: e.target.value }));
                if (errors.password) {
                  setErrors(prev => ({ ...prev, password: '' }));
                }
              }}
              error={errors.password}
            />

            <div className="text-right">
              <Link to="/user/forgot-password" className="text-sm text-[#808000] hover:text-[#5D5E1F]">
                Forgot Password?
              </Link>
            </div>

            <Button type="submit" variant="primary" className="w-full" loading={loading}>
              Login
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/user/register" className="text-[#808000] hover:text-[#5D5E1F] font-medium">
              Register here
            </Link>
          </p>
        </GlassCard>
      </div>
    </div>
  );
};

