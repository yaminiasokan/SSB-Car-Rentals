import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { Loader } from './components/ui';

import Home from './pages/Home';
import Cars from './pages/Cars';
import CarDetails from './pages/CarDetails';
import Booking from './pages/Booking';
import PayBooking from './pages/PayBooking';
import BookingConfirmation from './pages/BookingConfirmation';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Wishlist from './pages/Wishlist';
import Rewards from './pages/Rewards';
import Notifications from './pages/Notifications';
import TrackRental from './pages/TrackRental';
import Support from './pages/Support';
import About from './pages/About';
import Contact from './pages/Contact';
import Profile from './pages/Profile';
import Review from './pages/Review';
import AutoInspect from './pages/AutoInspect';
import DamageReports from './pages/DamageReports';
import DamageReportDetail from './pages/DamageReportDetail';
import NotFound from './pages/NotFound';

// The admin area (and the charting library) is loaded on demand.
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminVehicles = lazy(() => import('./pages/admin/AdminVehicles'));
const AdminBookings = lazy(() => import('./pages/admin/AdminBookings'));
const AdminDamageReports = lazy(() => import('./pages/admin/AdminDamageReports'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'));
const AdminSupport = lazy(() => import('./pages/admin/AdminSupport'));

const P = ({ children, roles }) => <ProtectedRoute roles={roles}>{children}</ProtectedRoute>;

export default function App() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="cars" element={<Cars />} />
          <Route path="cars/:id" element={<CarDetails />} />
          <Route path="book" element={<P><Booking /></P>} />
          <Route path="booking/confirmation/:id" element={<P><BookingConfirmation /></P>} />
          <Route path="payment/:id" element={<P><PayBooking /></P>} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password/:token" element={<ResetPassword />} />
          <Route path="dashboard" element={<P><Dashboard /></P>} />
          <Route path="bookings" element={<Navigate to="/dashboard?tab=bookings" replace />} />
          <Route path="wishlist" element={<P><Wishlist /></P>} />
          <Route path="rewards" element={<P><Rewards /></P>} />
          <Route path="notifications" element={<P><Notifications /></P>} />
          <Route path="track-rental" element={<P><TrackRental /></P>} />
          <Route path="profile" element={<P><Profile /></P>} />
          <Route path="review/:bookingId" element={<P><Review /></P>} />
          <Route path="auto-inspect" element={<P><AutoInspect /></P>} />
          <Route path="auto-inspect/:bookingId" element={<P><AutoInspect /></P>} />
          <Route path="damage-reports" element={<P><DamageReports /></P>} />
          <Route path="damage-reports/:id" element={<P><DamageReportDetail /></P>} />
          <Route path="support" element={<Support />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="/admin" element={<P roles={['admin']}><AdminLayout /></P>}>
          <Route index element={<AdminDashboard />} />
          <Route path="vehicles" element={<AdminVehicles />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="damage-reports" element={<AdminDamageReports />} />
          <Route path="damage-reports/:id" element={<DamageReportDetail admin />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="support" element={<AdminSupport />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
