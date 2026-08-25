import { NotificationCenter } from './NotificationCenter';
import { useAuth } from '../context/AuthContext';

export const UserTopBar = () => {
  const { user } = useAuth();

  return (
    <>
      <div className="sticky top-0 z-30 hidden border-b border-gray-200/80 bg-white/90 px-6 py-3 backdrop-blur-md lg:block">
        <div className="flex items-center justify-end gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-800">{user?.name}</p>
            <p className="text-xs capitalize text-gray-500">{user?.role}</p>
          </div>
          <NotificationCenter />
        </div>
      </div>

      <div className="sticky top-[57px] z-30 flex items-center justify-end border-b border-gray-200/80 bg-gray-50/95 px-4 py-2 backdrop-blur-md lg:hidden">
        <NotificationCenter />
      </div>
    </>
  );
};
