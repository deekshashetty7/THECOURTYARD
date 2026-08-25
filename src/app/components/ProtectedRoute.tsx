import { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'user' | 'admin';
  requireEmailVerification?: boolean;
}

/**
 * ProtectedRoute component that enforces authentication and email verification requirements
 * 
 * Features:
 * - Redirects to login if not authenticated
 * - Redirects unverified user accounts back to login when verification is required
 * - Enforces role-based access (admin vs user)
 * - Handles loading states gracefully
 */
export const ProtectedRoute = ({
  children,
  requiredRole = 'user',
  requireEmailVerification: forceEmailVerification,
}: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  // Email verification is required for user accounts unless a route explicitly disables it.
  const emailVerificationRequired = forceEmailVerification !== undefined
    ? forceEmailVerification
    : true;

  // Still loading - show spinner
  if (loading) {
    return <LoadingSpinner />;
  }

  // Not authenticated - redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access
  if (requiredRole === 'admin' && user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole === 'user' && user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Check email verification for users (not admins)
  if (emailVerificationRequired && requiredRole === 'user' && !user.emailVerified) {
    return <Navigate to="/login" replace />;
  }

  // All checks passed - render protected content
  return <>{children}</>;
};
