import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { Navbar } from '../components/Navbar';
import { Mail, ArrowRight } from 'lucide-react';

interface VerificationRequiredPageProps {
  email?: string;
}

export const VerificationRequiredPage = ({ email: initialEmail = '' }: VerificationRequiredPageProps) => {
  const navigate = useNavigate();
  const email = initialEmail;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-50">
      <Navbar />
      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-800 mb-3 text-center">Account Ready</h1>
          <p className="text-gray-600 text-center mb-6">
            Your account is ready to use. You can log in right away.
          </p>

          {email && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-1">Signed up with:</p>
                  <p className="text-sm text-blue-900 font-bold">{email}</p>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={() => navigate('/login')}
            variant="outline"
            className="w-full py-3 font-semibold rounded-xl border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <ArrowRight className="w-5 h-5 mr-2 inline" />
            Go to Login
          </Button>

          <p className="text-center text-xs text-gray-500 mt-6">
            You do not need an email verification link to sign in.
          </p>
        </div>
      </div>
    </div>
  );
};
