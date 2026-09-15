import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import RobotDetail from './pages/RobotDetail';
import AddRobot from './pages/AddRobot';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import Cart from './pages/Cart';
import Account from './pages/Account';
import Listings from './pages/Listings';
import Watchlist from './pages/Watchlist';
import Compare from './pages/Compare';
import Admin, { AdminListingEdit, AdminUserEdit } from './pages/Admin';
import Kyc from './pages/Kyc';
import Manufacturer from './pages/Manufacturer';
import { NewsPage, PartnersPage, FinancingPage, ServicePage, WarrantyPage, SellLanding } from './pages/InfoPages';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/robots/:id" element={<RobotDetail />} />
        <Route path="/add" element={<AddRobot />} />
        <Route path="/add-robot" element={<Navigate to="/add" replace />} />
        <Route path="/sell" element={<SellLanding />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/partners" element={<PartnersPage />} />
        <Route path="/financing" element={<FinancingPage />} />
        <Route path="/service" element={<ServicePage />} />
        <Route path="/warranty" element={<WarrantyPage />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/account" element={<Account />} />
        <Route path="/listings" element={<Listings />} />
        <Route path="/kyc" element={<Kyc />} />
        <Route path="/mfr" element={<Manufacturer />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/admin/listings/:id" element={<AdminListingEdit />} />
        <Route path="/admin/users/:id" element={<AdminUserEdit />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
    </Routes>
  );
}
