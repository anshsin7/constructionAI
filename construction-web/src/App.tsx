import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { OverviewPage } from './pages/OverviewPage'
import { OrdersPage } from './pages/OrdersPage'
import { SiteDetailPage } from './pages/SiteDetailPage'
import { UploadPage } from './pages/UploadPage'
import { InsightsPage } from './pages/InsightsPage'
import { CatalogPage } from './pages/CatalogPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/sites/:id" element={<SiteDetailPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
