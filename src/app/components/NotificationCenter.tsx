import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, CheckCheck, Trash2, Info, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';

const PANEL_WIDTH = 384;
const PANEL_MAX_HEIGHT = 520;

export const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotifications();

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setPanelStyle({});
      return;
    }

    const computePosition = () => {
      const button = buttonRef.current;
      if (!button) {
        setPanelStyle({
          position: 'fixed',
          top: 80,
          right: 16,
          zIndex: 10050,
          width: Math.min(PANEL_WIDTH, window.innerWidth - 16),
        });
        return;
      }

      const rect = button.getBoundingClientRect();
      const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
      const isMobile = window.innerWidth < 1024;

      if (isMobile) {
        setPanelStyle({
          position: 'fixed',
          top: Math.max(72, rect.bottom + 8),
          left: '50%',
          transform: 'translateX(-50%)',
          width,
          maxHeight: `min(${PANEL_MAX_HEIGHT}px, calc(100vh - ${Math.max(72, rect.bottom + 8)}px - 16px))`,
          zIndex: 10050,
        });
        return;
      }

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openAbove = spaceBelow < 280 && spaceAbove > spaceBelow;

      let top = openAbove ? undefined : rect.bottom + 8;
      let bottom = openAbove ? window.innerHeight - rect.top + 8 : undefined;

      let left = rect.right - width;
      if (left < 12) {
        left = Math.min(rect.left, window.innerWidth - width - 12);
      }
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12));

      setPanelStyle({
        position: 'fixed',
        top,
        bottom,
        left,
        width,
        maxHeight: openAbove
          ? `${Math.min(PANEL_MAX_HEIGHT, spaceAbove - 16)}px`
          : `${Math.min(PANEL_MAX_HEIGHT, spaceBelow - 16)}px`,
        zIndex: 10050,
      });
    };

    computePosition();
    window.addEventListener('resize', computePosition);
    window.addEventListener('scroll', computePosition, true);
    return () => {
      window.removeEventListener('resize', computePosition);
      window.removeEventListener('scroll', computePosition, true);
    };
  }, [isOpen]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-800" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen((value) => !value)}
        className="relative rounded-lg p-2 transition-colors hover:bg-gray-100"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="h-6 w-6 text-gray-700" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              <motion.button
                type="button"
                aria-label="Close notifications"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10040] bg-black/20 backdrop-blur-[1px]"
                onClick={() => setIsOpen(false)}
              />

              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                style={panelStyle}
                className="z-[10050] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
              >
                <div className="shrink-0 bg-gradient-to-r from-green-900 to-green-800 p-4 text-white">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Notifications</h3>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="rounded-lg p-1 transition-colors hover:bg-white/20"
                      aria-label="Close notifications panel"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  {notifications.length > 0 && (
                    <div className="flex gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1 text-xs transition-colors hover:bg-white/30"
                        >
                          <CheckCheck className="h-3 w-3" />
                          Mark all read
                        </button>
                      )}
                      <button
                        onClick={clearAll}
                        className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1 text-xs transition-colors hover:bg-white/30"
                      >
                        <Trash2 className="h-3 w-3" />
                        Clear all
                      </button>
                    </div>
                  )}
                </div>

                <div className="min-h-[180px] flex-1 overflow-y-auto bg-white">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Bell className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                      <p className="text-sm font-medium text-gray-700">No notifications yet</p>
                      <p className="mt-1 text-xs text-gray-500">We&apos;ll notify you when something happens</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {notifications.map((notification) => (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 12 }}
                          className={`p-4 transition-colors hover:bg-gray-50 ${!notification.read ? 'bg-green-50/40' : 'bg-white'}`}
                        >
                          <div className="flex gap-3">
                            <div className="mt-1 shrink-0">{getIcon(notification.type)}</div>

                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <h4 className="truncate text-sm font-semibold text-gray-800">{notification.title}</h4>
                                {!notification.read && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-900" />}
                              </div>
                              <p className="mb-2 line-clamp-3 text-sm text-gray-600">{notification.message}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">
                                  {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                                </span>
                                <div className="flex gap-2">
                                  {!notification.read && (
                                    <button
                                      onClick={() => markAsRead(notification.id)}
                                      className="text-xs font-medium text-green-900 hover:text-green-950"
                                    >
                                      <Check className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => removeNotification(notification.id)}
                                    className="text-xs text-gray-400 hover:text-red-500"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              {notification.action?.label && typeof notification.action.onClick === 'function' && (
                                <button
                                  onClick={() => {
                                    notification.action?.onClick?.();
                                    markAsRead(notification.id);
                                    setIsOpen(false);
                                  }}
                                  className="mt-2 rounded-lg bg-green-900 px-3 py-1 text-xs text-white transition-colors hover:bg-green-950"
                                >
                                  {notification.action.label}
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
