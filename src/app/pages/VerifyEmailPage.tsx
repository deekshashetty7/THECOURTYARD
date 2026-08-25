import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { Navbar } from '../components/Navbar';
import { CheckCircle2 } from 'lucide-react';

export const VerifyEmailPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login', { replace: true });
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-50">
      <Navbar />
      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-900" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-3">No Verification Needed</h1>
          <p className="text-gray-600 mb-6">
            Email verification is disabled. You can log in to your account now.
          </p>
          <Button
            onClick={() => navigate('/login', { replace: true })}
            variant="primary"
            className="w-full"
          >
            Go to Login
          </Button>
        </div>
      </div>
    </div>
  );
};


