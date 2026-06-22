import { Outlet } from 'react-router';
import { UserSidebar } from './UserSidebar';
import { UserMobileNav } from './UserMobileNav';
import { UserTopBar } from './UserTopBar';

export const UserPageLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <UserSidebar />
      <UserMobileNav />
      <main className="min-h-screen lg:ml-72">
        <UserTopBar />
        <Outlet />
      </main>
    </div>
  );
};
