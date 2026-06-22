import { Outlet } from 'react-router';
import { AdminSidebar } from './AdminSidebar';
import { AdminMobileNav } from './AdminMobileNav';
import { AdminTopBar } from './AdminTopBar';

export const AdminPageLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      <AdminMobileNav />
      <main className="min-h-screen lg:ml-72">
        <AdminTopBar />
        <Outlet />
      </main>
    </div>
  );
};
