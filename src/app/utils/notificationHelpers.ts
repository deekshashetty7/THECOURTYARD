import { toast } from 'sonner';

/**
 * Display a success toast notification
 */
export const showSuccessToast = (title: string, description?: string) => {
  toast.success(title, {
    description,
    duration: 4000,
  });
};

/**
 * Display an error toast notification
 */
export const showErrorToast = (title: string, description?: string) => {
  toast.error(title, {
    description,
    duration: 5000,
  });
};

/**
 * Display an info toast notification
 */
export const showInfoToast = (title: string, description?: string) => {
  toast.info(title, {
    description,
    duration: 4000,
  });
};

/**
 * Display a warning toast notification
 */
export const showWarningToast = (title: string, description?: string) => {
  toast.warning(title, {
    description,
    duration: 4000,
  });
};

/**
 * Display a promise toast notification (for async operations)
 */
export const showPromiseToast = <T,>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string;
    error: string;
  }
) => {
  return toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
  });
};
