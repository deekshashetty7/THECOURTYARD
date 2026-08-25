import { Link, useLocation, useNavigate } from 'react-router';
import {
  LogOut,
  User,
  Calendar,
  CreditCard,
  Phone,
  Home,
  Menu,
  X,
  History,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import courtyardLogo from '../../assets/courtyard-logo.png';

const userNavItems = [
  { label: 'Home', path: '/user/home', icon: Home },
  { label: 'Book Court', path: '/user/booking', icon: Calendar },
  { label: 'Subscription', path: '/user/subscription', icon: CreditCard },
  { label: 'History', path: '/user/history', icon: History },
  { label: 'Contact', path: '/user/contact', icon: Phone },
  { label: 'Profile', path: '/user/profile', icon: User },
];

export const UserMobileNav = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setOpen(false);
  };

  return (
    <div className="lg:hidden">
      <header className="sticky top-0 z-40 border-b border-emerald-100/70 bg-white/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <Link to="/user/home" className="flex items-center gap-2">
            <img src={courtyardLogo} alt="TheCourtyard logo" className="h-9 w-9 object-contain" />
            <span className="text-lg font-bold text-green-900">thecourtyard</span>
          </Link>
          <button
            onClick={() => setOpen((value) => !value)}
            className="rounded-xl p-2 hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] lg:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute left-0 top-0 flex h-full w-[min(88vw,20rem)] flex-col border-r border-emerald-100 bg-gradient-to-b from-[#eef6e8] via-[#f8fbf4] to-[#edf3e8] p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/70">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto">
              {userNavItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium ${
                      active
                        ? 'border-emerald-300/70 bg-white text-[#5D5E1F] shadow-sm'
                        : 'border-white/50 bg-white/60 text-gray-700'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 rounded-2xl border border-white/70 bg-white/80 p-3">
              <p className="mb-3 text-sm font-semibold text-gray-800">{user?.name}</p>
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
