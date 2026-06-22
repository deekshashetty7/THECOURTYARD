import { useNavigate } from 'react-router';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';

export const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <h1 className="text-9xl font-bold bg-gradient-to-r from-green-900 to-green-800 bg-clip-text text-transparent">
            404
          </h1>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Page Not Found</h2>
          <p className="text-gray-600">
            Oops! The page you're looking for doesn't exist. It might have been moved or deleted.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </Button>
          <Button variant="primary" onClick={() => navigate('/')}>
            <Home className="w-5 h-5" />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
};


