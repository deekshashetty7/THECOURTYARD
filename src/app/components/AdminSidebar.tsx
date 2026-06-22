import { Link, useLocation, useNavigate } from 'react-router';
import {
  LogOut,
  Users,
  LayoutDashboard,
  Settings,
  Calendar,
  MessageSquare,
  Mail,
  ChevronRight,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';
import courtyardLogo from '../../assets/courtyard-logo.png';

type NavItem = {
  label: string;
  path: string;
  icon: ReactNode;
};

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Bookings', path: '/admin/bookings', icon: <Calendar className="h-5 w-5" /> },
  { label: 'Users', path: '/admin/users', icon: <Users className="h-5 w-5" /> },
  { label: 'Settings', path: '/admin/settings', icon: <Settings className="h-5 w-5" /> },
  { label: 'Reviews', path: '/admin/reviews', icon: <MessageSquare className="h-5 w-5" /> },
  { label: 'Messages', path: '/admin/messages', icon: <Mail className="h-5 w-5" /> },
  { label: 'Revenue', path: '/admin/revenue', icon: <DollarSign className="h-5 w-5" /> },
];

export const AdminSidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActivePath = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItemClass = (active: boolean) =>
    `group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
      active
        ? 'border-emerald-300/70 bg-white text-[#5D5E1F] shadow-[0_10px_30px_rgba(128,128,0,0.12)]'
        : 'border-white/40 bg-white/50 text-gray-700 hover:border-emerald-100 hover:bg-white/90 hover:shadow-sm'
    }`;

  const iconWrapClass = (active: boolean) =>
    `flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
      active
        ? 'bg-gradient-to-br from-green-900 to-[#808000] text-white shadow-sm'
        : 'bg-emerald-50/80 text-gray-500 group-hover:bg-emerald-100 group-hover:text-[#808000]'
    }`;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-72 flex-col border-r border-emerald-100/80 bg-gradient-to-b from-[#eef6e8] via-[#f8fbf4] to-[#edf3e8] shadow-[4px_0_32px_rgba(45,74,34,0.08)] lg:flex">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(128,128,0,0.12),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_40%)]" />

      <div className="relative flex h-full flex-col px-4 py-5">
        <Link to="/admin/dashboard" className="mb-6 flex items-center gap-3 rounded-2xl border border-white/70 bg-white/70 p-3 shadow-sm backdrop-blur-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-lime-50 ring-1 ring-emerald-100">
            <img src={courtyardLogo} alt="TheCourtyard logo" className="h-7 w-7 object-contain" />
          </div>
          <div className="min-w-0">
            <div className="bg-gradient-to-r from-green-900 to-green-800 bg-clip-text text-xl font-bold text-transparent">
              thecourtyard
            </div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500">Admin Portal</p>
          </div>
        </Link>

        <nav className="flex-1 space-y-2 overflow-y-auto pr-1">
          {adminNavItems.map((item) => {
            const active = isActivePath(item.path);

            return (
              <Link key={item.path} to={item.path} className={navItemClass(active)}>
                <div className={iconWrapClass(active)}>{item.icon}</div>
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronRight
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    active ? 'text-[#808000] translate-x-0.5' : 'text-gray-300 group-hover:text-[#808000] group-hover:translate-x-0.5'
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="relative mt-4 rounded-2xl border border-white/70 bg-white/75 p-3 shadow-sm backdrop-blur-sm">
          <div className="mb-3 min-w-0">
            <p className="truncate text-sm font-semibold text-gray-800">{user?.name}</p>
            <p className="text-xs capitalize text-gray-500">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
};
