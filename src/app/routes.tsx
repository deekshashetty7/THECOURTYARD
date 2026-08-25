import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { LandingPage } from "./pages/LandingPage";
import { UnifiedLogin } from "./pages/UnifiedLogin";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { UserRegister } from "./pages/user/UserRegister";
import { OTPRegistration } from "./pages/user/OTPRegistration";
import { UserHome } from "./pages/user/UserHome";
import { UserPhotos } from "./pages/user/UserPhotos";
import { BookingPage } from "./pages/user/BookingPage";
import { PaymentPage } from "./pages/user/PaymentPage";
import { BookingConfirmation } from "./pages/user/BookingConfirmation";
import { UserBookingHistory } from "./pages/user/UserBookingHistory";
import { SubscriptionPage } from "./pages/user/SubscriptionPage";
import { ProfilePage } from "./pages/user/ProfilePage";
import { ContactPage } from "./pages/ContactPage";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminBookings } from "./pages/admin/AdminBookings";
import { AdminRevenuePage } from "./pages/admin/AdminRevenuePage";
import { AdminSettings } from "./pages/admin/AdminSettings";
import { AdminGalleryPage } from "./pages/admin/AdminGalleryPage";
import { AdminPhotosPage } from "./pages/admin/AdminPhotosPage";
import { AdminReviews } from "./pages/admin/AdminReviews";
import { AdminMessages } from "./pages/admin/AdminMessages";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { NotFound } from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminPageLayout } from "./components/AdminPageLayout";
import { UserPageLayout } from "./components/UserPageLayout";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    // Router configuration
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: "login",
        element: <UnifiedLogin />,
      },
      {
        path: "signup",
        element: <OTPRegistration />,
      },
      {
        path: "verify-email",
        element: <VerifyEmailPage />,
      },
      {
        path: "user/login",
        element: <UnifiedLogin />,
      },
      {
        path: "user/forgot-password",
        element: <ForgotPasswordPage />,
      },
      {
        path: "user/reset-password",
        element: <ResetPasswordPage />,
      },
      {
        path: "user/register",
        element: <OTPRegistration />,
      },
      {
        path: "user",
        element: <ProtectedRoute requiredRole="user" requireEmailVerification={true}><UserPageLayout /></ProtectedRoute>,
        children: [
          {
            path: "home",
            element: <UserHome />,
          },
          {
            path: "photos",
            element: <UserPhotos />,
          },
          {
            path: "booking",
            element: <BookingPage />,
          },
          {
            path: "payment",
            element: <PaymentPage />,
          },
          {
            path: "booking-confirmation",
            element: <BookingConfirmation />,
          },
          {
            path: "history",
            element: <UserBookingHistory />,
          },
          {
            path: "subscription",
            element: <SubscriptionPage />,
          },
          {
            path: "profile",
            element: <ProfilePage />,
          },
          {
            path: "contact",
            element: <ContactPage />,
          },
        ],
      },
      {
        path: "contact",
        element: <ContactPage />,
      },
      {
        path: "admin",
        element: <ProtectedRoute requiredRole="admin"><AdminPageLayout /></ProtectedRoute>,
        children: [
          {
            index: true,
            element: <Navigate to="/admin/dashboard" replace />,
          },
          {
            path: "dashboard",
            element: <AdminDashboard />,
          },
          {
            path: "users",
            element: <AdminUsers />,
          },
          {
            path: "bookings",
            element: <AdminBookings />,
          },
          {
            path: "revenue",
            element: <AdminRevenuePage />,
          },
          {
            path: "settings",
            element: <AdminSettings />,
          },
          {
            path: "reviews",
            element: <AdminReviews />,
          },
          {
            path: "messages",
            element: <AdminMessages />,
          },
          {
            path: "settings/gallery",
            element: <AdminGalleryPage />,
          },
          {
            path: "photos",
            element: <AdminPhotosPage />,
          },
        ],
      },
      {
        path: "admin/login",
        element: <Navigate to="/login" replace />,
      },
      {
        path: "admin/forgot-password",
        element: <ForgotPasswordPage />,
      },
      {
        path: "admin/reset-password",
        element: <ResetPasswordPage />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);
