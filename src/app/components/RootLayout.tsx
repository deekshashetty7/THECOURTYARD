import { Outlet } from 'react-router';

export const RootLayout = () => {
  return (
    <div className="font-['Poppins'] min-h-screen bg-white">
      <Outlet />
    </div>
  );
};