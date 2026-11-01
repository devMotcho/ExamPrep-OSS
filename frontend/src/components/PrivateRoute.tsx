import React from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ProfessionalLoader } from './ui/ProfessionalLoader';

export const PrivateRoute: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const activeLocale = locale || 'pt';

  if (loading) {
    return <ProfessionalLoader />;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to={`/${activeLocale}/login`} replace />;
};
