import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AppHeader from './components/AppHeader'
import BottomNav from './components/BottomNav'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import PatientForm from './pages/PatientForm'
import PatientDetail from './pages/PatientDetail'
import TreatmentForm from './pages/TreatmentForm'
import TreatmentList from './pages/TreatmentList'
import SOS from './pages/SOS'
import More from './pages/More'
import Analytics from './pages/Analytics'
import DoseHistory from './pages/DoseHistory'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import { useAuth } from './hooks/useAuth'
import { useRealtime } from './hooks/useRealtime'

export default function App() {
  const { user, loading } = useAuth()
  const location = useLocation()
  useRealtime()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-slate-500">Carregando…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  const hideNav = location.pathname.startsWith('/entrar')

  return (
    <>
    <AppHeader />
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pacientes" element={<Patients />} />
        <Route path="/pacientes/novo" element={<PatientForm />} />
        <Route path="/pacientes/:id" element={<PatientDetail />} />
        <Route path="/pacientes/:id/editar" element={<PatientForm />} />
        <Route path="/tratamento/novo" element={<TreatmentForm />} />
        <Route path="/tratamento/:id" element={<TreatmentForm />} />
        <Route path="/tratamentos" element={<TreatmentList />} />
        <Route path="/sos" element={<SOS />} />
        <Route path="/mais" element={<More />} />
        <Route path="/historico" element={<DoseHistory />} />
        <Route path="/relatorios-analise" element={<Analytics />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/ajustes" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </div>
    </>
  )
}
