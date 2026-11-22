import { Navigate, Route, Routes } from 'react-router-dom'
import { RedirectIfAuthed, RequireAuth } from '../auth/AuthProvider'
import { SiteLayout } from '../components/SiteLayout'
import { Home } from '../pages/public/Home'
import { ForgotPassword, Login, page, ResetPassword, SignUp } from './lazyPage'

const Menu = page(() => import('../pages/public/Menu'), 'Menu')
const info = () => import('../pages/public/InfoPages')
const About = page(info, 'About')
const Deals = page(info, 'Deals')
const DealDetail = page(info, 'DealDetail')
const Contact = page(info, 'Contact')
const Privacy = page(info, 'Privacy')
const Terms = page(info, 'Terms')
const NotFoundPage = page(info, 'NotFoundPage')
const Receipt = page(() => import('../pages/public/Receipt'), 'Receipt')
const Cart = page(() => import('../pages/student/Cart'), 'Cart')
const Orders = page(() => import('../pages/student/Orders'), 'Orders')
const OrderDetail = page(() => import('../pages/student/OrderDetail'), 'OrderDetail')
const Account = page(() => import('../pages/student/Account'), 'Account')
const RiderDeliveries = page(() => import('../pages/rider/RiderDeliveries'), 'RiderDeliveries')
const VendorLayout = page(() => import('../pages/vendor/VendorLayout'), 'VendorLayout')
const VendorOrders = page(() => import('../pages/vendor/VendorOrders'), 'VendorOrders')
const VendorDashboard = page(() => import('../pages/vendor/VendorDashboard'), 'VendorDashboard')
const VendorMenu = page(() => import('../pages/vendor/VendorMenu'), 'VendorMenu')
const vendorPages = () => import('../pages/vendor/VendorPages')
const VendorOffers = page(vendorPages, 'VendorOffers')
const VendorReports = page(vendorPages, 'VendorReports')
const VendorSettings = page(vendorPages, 'VendorSettings')
const VendorStaff = page(vendorPages, 'VendorStaff')

/** Students, hotels and riders: campus.waren.digital. This build contains no administrator pages. */
export default function SiteRoutes() {
  return (
    <Routes>
      {/* The receipt opens from an SMS on its own, like a printed slip: no site header or footer. */}
      <Route path="r/:token" element={<Receipt />} />
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="menu" element={<Menu />} />
        <Route path="cart" element={<Cart />} />
        <Route path="about" element={<About />} />
        <Route path="deals" element={<Deals />} />
        <Route path="deals/:id" element={<DealDetail />} />
        <Route path="contact" element={<Contact />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="feedback" element={<Navigate to="/contact" replace />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route element={<RedirectIfAuthed to="/menu" />}>
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="account" element={<Account />} />
        </Route>
        <Route element={<RequireAuth roles={['rider', 'admin']} />}>
          <Route path="rider" element={<RiderDeliveries />} />
        </Route>
        <Route element={<RequireAuth vendor />}>
          <Route path="hotel" element={<VendorLayout />}>
            <Route index element={<VendorDashboard />} />
            <Route path="orders" element={<VendorOrders />} />
            <Route path="menu" element={<VendorMenu />} />
            <Route path="reports" element={<VendorReports />} />
            <Route path="settings" element={<VendorSettings />} />
            <Route path="staff" element={<VendorStaff />} />
            <Route path="offers" element={<VendorOffers />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
