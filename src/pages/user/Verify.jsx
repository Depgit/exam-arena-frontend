import { Navigate, useNavigate } from 'react-router-dom'
import VerifyEmail from '../../components/auth/VerifyEmail'
import { useAuth } from '../../context/AuthContext'

export default function Verify() {
  const { needsVerification } = useAuth()
  const navigate = useNavigate()
  if (!needsVerification) return <Navigate to="/app/dashboard" replace />
  return (
    <div className="page">
      <VerifyEmail onVerified={() => navigate('/app/dashboard', { replace: true })} />
    </div>
  )
}
