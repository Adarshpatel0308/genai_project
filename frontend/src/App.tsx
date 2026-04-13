import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import DiseaseScannerPage from './pages/DiseaseScannerPage'
import KrishiGPTPage from './pages/KrishiGPTPage'
import WeatherPage from './pages/WeatherPage'
import SoilCropPage from './pages/SoilCropPage'
import MarketPage from './pages/MarketPage'
import FarmCalcPage from './pages/FarmCalcPage'
import ForumPage from './pages/ForumPage'
import AdminPage from './pages/AdminPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#0f1629', color: '#e2e8f0', border: '1px solid #1e3a5f' },
          success: { iconTheme: { primary: '#3b82f6', secondary: '#0a0f1e' } },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="disease" element={<DiseaseScannerPage />} />
          <Route path="chatbot" element={<KrishiGPTPage />} />
          <Route path="weather" element={<WeatherPage />} />
          <Route path="soil" element={<SoilCropPage />} />
          <Route path="market" element={<MarketPage />} />
          <Route path="farm" element={<FarmCalcPage />} />
          <Route path="forum" element={<ForumPage />} />
          <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
