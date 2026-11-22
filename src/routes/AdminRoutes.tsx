import { Navigate, Route, Routes } from 'react-router-dom'
import { RedirectIfAuthed, RequireAuth } from '../auth/AuthProvider'
import { ForgotPassword, Login, page, ResetPassword } from './lazyPage'

const AdminLayout = page(() => import('../pages/admin/AdminLayout'), 'AdminLayout')
const adminPages = () => import('../pages/admin/AdminPages')
const AdminAudit = page(adminPages, 'AdminAudit')
const AdminContent = page(adminPages, 'AdminContent')
const AdminMedia = page(adminPages, 'AdminMedia')
const AdminFeedback = page(adminPages, 'AdminFeedback')
const carePages = () => import('../pages/admin/AdminCare')
const AdminMpesa = page(() => import('../pages/admin/AdminMpesa'), 'AdminMpesa')
const AdminCallbacks = page(carePages, 'AdminCallbacks')
const AdminKnowledge = page(carePages, 'AdminKnowledge')
const AdminFinance = page(adminPages, 'AdminFinance')
const AdminOrderDetail = page(adminPages, 'AdminOrderDetail')
const AdminOrders = page(adminPages, 'AdminOrders')
const AdminOverview = page(adminPages, 'AdminOverview')
const AdminPayments = page(adminPages, 'AdminPayments')
const AdminPeople = page(adminPages, 'AdminPeople')
const AdminRefunds = page(adminPages, 'AdminRefunds')
const AdminSettings = page(adminPages, 'AdminSettings')
const AdminVendors = page(adminPages, 'AdminVendors')

/**
 * Platform staff only: admin.yourdomain.com, its own Vercel project behind Cloudflare Access
 * (admin.md). This build contains only the administrator UI and the sign-in pages.
 */
export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<RedirectIfAuthed to="/" />}>
        <Route path="login" element={<main className="min-h-screen bg-canvas"><Login /></main>} />
        <Route path="forgot-password" element={<main className="min-h-screen bg-canvas"><ForgotPassword /></main>} />
      </Route>
      <Route path="reset-password" element={<main className="min-h-screen bg-canvas"><ResetPassword /></main>} />
      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="refunds" element={<AdminRefunds />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="finance" element={<AdminFinance />} />
          <Route path="vendors" element={<AdminVendors />} />
          <Route path="people" element={<AdminPeople />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="images" element={<AdminMedia />} />
          <Route path="mpesa" element={<AdminMpesa />} />
          <Route path="callbacks" element={<AdminCallbacks />} />
          <Route path="answers" element={<AdminKnowledge />} />
          <Route path="feedback" element={<AdminFeedback />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
