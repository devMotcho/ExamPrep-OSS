import React from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const PublicRoute: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const activeLocale = locale || 'pt';

  return isAuthenticated ? <Navigate to={`/${activeLocale}/dashboard`} replace /> : <Outlet />;
};
