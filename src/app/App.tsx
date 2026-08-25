import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { BookingProvider } from './context/BookingContext';
import { LandingPageProvider } from './context/LandingPageContext';
import { NotificationProvider } from './context/NotificationContext';
import { Toaster } from 'sonner';

function App() {
  return (
    <AuthProvider>
      <BookingProvider>
        <LandingPageProvider>
          <NotificationProvider>
            <RouterProvider router={router} />
            <Toaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                style: {
                  fontFamily: 'Poppins',
                },
              }}
            />
          </NotificationProvider>
        </LandingPageProvider>
      </BookingProvider>
    </AuthProvider>
  );
}

export default App;