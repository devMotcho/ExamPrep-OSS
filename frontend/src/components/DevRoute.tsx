import React from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ProfessionalLoader } from './ui/ProfessionalLoader';

export const DevRoute: React.FC = () => {
  const { isAuthenticated, role, loading } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const activeLocale = locale || 'pt';

  if (loading) {
    return <ProfessionalLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to={`/${activeLocale}/login`} replace />;
  }

  if (role !== 'ROLE_ADMIN' && role !== 'ROLE_DEV') {
    return <Navigate to={`/${activeLocale}/dashboard`} replace />;
  }

  return <Outlet />;
};
