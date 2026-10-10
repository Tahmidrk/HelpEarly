import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import SplashScreen from './components/SplashScreen';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import BrowseHelpers from './pages/BrowseHelpers';
import HelperProfile from './pages/HelperProfile';
import Booking from './pages/Booking';
import UserDashboard from './pages/UserDashboard';
import HelperDashboard from './pages/HelperDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Chat from './pages/Chat';
import JobListings from './pages/JobListings';
import JobDetail from './pages/JobDetail';
import PostJob from './pages/PostJob';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import AIChatbot from './components/AIChatbot';
import EmergencyNotificationListener from './components/EmergencyNotificationListener';
import Notifications from './pages/Notifications';
import Emergency from './pages/Emergency';
import ComplaintPanel from './components/ComplaintPanel';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { user, activeRole } = useAuth();
  return (
    <>
      <SplashScreen />
      <EmergencyNotificationListener />
      <Navbar />
      <Routes key={`routes:${user?.id || 'guest'}:${activeRole}`}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/helpers" element={<BrowseHelpers />} />
        <Route path="/helpers/:id" element={<HelperProfile />} />
        <Route path="/users/:id" element={<UserProfile />} />
        <Route path="/jobs" element={<JobListings />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/book/:helperId" element={
          <ProtectedRoute roles={['household']}><Booking /></ProtectedRoute>
        } />
        <Route path="/jobs/post" element={
          <ProtectedRoute roles={['household']}><PostJob /></ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute roles={['household']}><UserDashboard /></ProtectedRoute>
        } />
        <Route path="/helper/dashboard" element={
          <ProtectedRoute roles={['helper']}><HelperDashboard /></ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/chat" element={
          <ProtectedRoute><Chat /></ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute><Profile /></ProtectedRoute>
        } />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/emergency" element={<ProtectedRoute roles={['household', 'helper']}><Emergency /></ProtectedRoute>} />
        <Route path="/complaints" element={<ProtectedRoute roles={['household', 'helper']}><div className="page"><div className="container"><div className="page-header"><h1>My complaints</h1></div><ComplaintPanel /></div></div></ProtectedRoute>} />
      </Routes>
      <AIChatbot key={`ai:${user?.id || 'guest'}:${activeRole}`} />
      <Footer />
    </>
  );
}
