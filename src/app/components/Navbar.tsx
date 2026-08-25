import { Link, useNavigate, useLocation } from 'react-router';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './Button';
import { useState } from 'react';
import courtyardLogo from '../../assets/courtyard-logo.png';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  const isAdmin = user?.role === 'admin';
  const isVerifiedUser = user?.role === 'user' && user?.emailVerified === true;

  if (isAdmin || isVerifiedUser) {
    return null;
  }

  const isActivePath = (path: string) => location.pathname === path;

  const navLinkClass = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
      active
        ? 'bg-white text-[#5D5E1F] shadow-sm ring-1 ring-emerald-100'
        : 'text-gray-700 hover:bg-white/70 hover:text-[#808000]'
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-emerald-100/80 bg-gradient-to-r from-[#eef6e8] via-[#f8fbf4] to-[#edf3e8] shadow-[0_4px_24px_rgba(45,74,34,0.08)] backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(128,128,0,0.1),transparent_45%)]" />

      <div className="container relative mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/70 p-2 pr-4 shadow-sm backdrop-blur-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-lime-50 ring-1 ring-emerald-100">
              <img src={courtyardLogo} alt="TheCourtyard logo" className="h-6 w-6 object-contain" />
            </div>
            <div className="bg-gradient-to-r from-green-900 to-green-800 bg-clip-text text-xl font-bold text-transparent">
              thecourtyard
            </div>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <Link to="/" className={navLinkClass(isActivePath('/'))}>
              Home
            </Link>
            <Link to="/contact" className={navLinkClass(isActivePath('/contact'))}>
              Contact
            </Link>
            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Sign Up</Button>
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-xl border border-white/70 bg-white/70 p-2 shadow-sm md:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-emerald-100/70 pb-4 pt-3 md:hidden">
            <div className="flex flex-col gap-2">
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className={navLinkClass(isActivePath('/'))}>
                Home
              </Link>
              <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className={navLinkClass(isActivePath('/contact'))}>
                Contact
              </Link>
              {user ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">Login</Button>
                  </Link>
                  <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full">Sign Up</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
