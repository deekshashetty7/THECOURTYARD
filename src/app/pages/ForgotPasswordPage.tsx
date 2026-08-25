import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowLeft, Mail } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { showErrorToast, showSuccessToast } from '../utils/notificationHelpers';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const role = useMemo<'user' | 'admin'>(() => {
    return location.pathname.startsWith('/admin') ? 'admin' : 'user';
  }, [location.pathname]);

  const title = role === 'admin' ? 'Admin Password Recovery' : 'Forgot Password';
  const subtitle = role === 'admin'
    ? 'We will send a secure reset link to your admin email.'
    : 'We will send a reset link to your registered email.';
  const backPath = '/login';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Email is required');
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError('Enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(normalizedEmail, role);
      setNotice('Password reset link sent. Please check your inbox and spam folder.');
      showSuccessToast('Reset link sent');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to send reset link';
      setError(message);
      showErrorToast('Reset request failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate(backPath)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Login
        </button>

        <GlassCard className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{title}</h1>
            <p className="text-gray-600">{subtitle}</p>
          </div>

          {notice && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Email"
              type="email"
              placeholder="your.email@example.com"
              icon={<Mail className="w-5 h-5" />}
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) {
                  setError('');
                }
              }}
              error={error}
            />

            <Button type="submit" variant="primary" className="w-full" loading={loading}>
              Send Reset Link
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Remember your password?{' '}
            <Link to={backPath} className="text-[#10b981] hover:text-[#059669] font-medium">
              Go to login
            </Link>
          </p>
        </GlassCard>
      </div>
    </div>
  );
};
