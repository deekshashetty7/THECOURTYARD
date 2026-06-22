import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Lock, LoaderCircle, Eye, EyeOff } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { showErrorToast, showSuccessToast } from '../utils/notificationHelpers';

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPasswordWithToken } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetToken = searchParams.get('token') || '';
  const loginPath = '/login';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!resetToken) {
      setError('This reset link is invalid or has expired. Please request a new one.');
      return;
    }

    if (!password) {
      setError('New password is required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordWithToken(resetToken, password);
      showSuccessToast('Password updated successfully');
      window.sessionStorage.setItem('tcy.auth.notice', 'Your password was updated. Please login with your new password.');
      navigate(loginPath, { replace: true });
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Unable to update password';
      setError(message);
      showErrorToast('Password reset failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate(loginPath)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Login
        </button>

        <GlassCard className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Reset Password</h1>
            <p className="text-gray-600">Set a new password for your account.</p>
          </div>

          {!resetToken ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Open the reset link from your email to choose a new password.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative">
                <Input
                  label="New Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  icon={<Lock className="w-5 h-5" />}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) {
                      setError('');
                    }
                  }}
                  error={error}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-[38px] text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="relative">
                <Input
                  label="Confirm Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  icon={<Lock className="w-5 h-5" />}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-[38px] text-gray-500 hover:text-gray-700"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <Button type="submit" variant="primary" className="w-full" loading={loading}>
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                    Updating...
                  </span>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-600">
            Remember your password?{' '}
            <Link to={loginPath} className="text-[#10b981] hover:text-[#059669] font-medium">
              Go to login
            </Link>
          </p>
        </GlassCard>
      </div>
    </div>
  );
};
