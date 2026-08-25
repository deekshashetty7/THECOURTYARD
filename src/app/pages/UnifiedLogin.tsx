import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Mail, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { showErrorToast, showInfoToast, showSuccessToast } from '../utils/notificationHelpers';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const mapLoginError = (message: string) => {
  if (/timed out|timeout/i.test(message)) {
    return 'Login is taking too long. Please check your internet and try again.';
  }

  // Specific password / email messages
  if (/invalid password|wrong password/i.test(message)) {
    return 'Invalid password.';
  }

  if (/no user found|user not found|no account found|unknown email/i.test(message)) {
    return 'No account found with this email.';
  }

  if (/invalid login credentials|invalid credentials|invalid email or password/i.test(message)) {
    return 'Invalid email or password.';
  }

  if (/admin access required|registered for admin access|user is not a user/i.test(message)) {
    return 'Invalid email or password.';
  }

  if (/rate limit|too many requests/i.test(message)) {
    return 'Too many attempts. Please wait a minute and try again.';
  }

  return message || 'Unable to sign in. Please try again.';
};

export const UnifiedLogin = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/user/home');
      }
    }
  }, [user, navigate]);

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
      const signedInUser = await login(normalizedEmail, formData.password, 'any');
      navigate(signedInUser.role === 'admin' ? '/admin/dashboard' : '/user/home', { replace: true });
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-start justify-center px-3 py-6 sm:px-4 md:items-center">
      <div className="w-full max-w-sm sm:max-w-md">
        <button
          onClick={() => navigate('/')}
          className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 sm:mb-6 sm:text-base"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </button>

        <GlassCard className="w-full p-5 shadow-xl sm:p-6 md:p-8">
          <div className="mb-6 text-center sm:mb-8">
            <h1 className="text-2xl font-bold text-gray-800 sm:text-3xl mb-2">Welcome Back!</h1>
            <p className="text-sm text-gray-600 sm:text-base">Login to your account</p>
          </div>

          {notice && (
            <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5 sm:space-y-6">
            <Input
              label="Email"
              type="email"
              placeholder="your@email.com"
              icon={<Mail className="w-5 h-5" />}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={errors.email}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pl-12 pr-12 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.password ? 'border-red-500 focus:ring-red-500' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link
                to="/user/register"
                className="text-green-900 hover:text-green-950 font-semibold"
              >
                Sign up
              </Link>
            </p>
            <p className="text-gray-600">
              <Link
                to="/user/forgot-password"
                className="text-green-900 hover:text-green-950 font-semibold"
              >
                Forgot password?
              </Link>
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};


