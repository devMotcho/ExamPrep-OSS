import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { PrivateRoute } from './components/PrivateRoute';
import { PublicRoute } from './components/PublicRoute';
import { AdminRoute } from './components/AdminRoute';
import { DevRoute } from './components/DevRoute';
import { authService } from '@/features/auth';
import { DEFAULT_LOCALE, getDetectedLocale, SUPPORTED_LOCALES } from './hooks/useLocale';
import { SEO } from './components/public/SEO';
import { CookieConsent } from './components/public/CookieConsent';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { PageSkeleton } from './components/ui/PageSkeleton';
import { OfflineBanner } from './components/pwa/OfflineBanner';
import { UpdatePrompt } from './components/pwa/UpdatePrompt';
import { CONSENT_CHANGED_EVENT, consentedDeviceId } from './lib/telemetryConsent';
import { initSentry } from './lib/config/sentry';

initSentry();

const TelemetryTracker: React.FC = () => {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      window.sessionStorage.removeItem('page-force-refreshed');
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const reportVisit = async () => {
      const deviceId = consentedDeviceId();
      if (!deviceId) return;
      try {
        await authService.logVisit(deviceId);
      } catch (err) {
        console.error("Telemetry ping failed:", err);
      }
    };

    reportVisit();
    window.addEventListener(CONSENT_CHANGED_EVENT, reportVisit);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, reportVisit);
  }, [isAuthenticated]);

  return null;
};

// Helper to automatically retry and reload page once if a code-split chunk fails after deployment
function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | T>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed =
      window.sessionStorage.getItem('page-force-refreshed') === 'true';

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-force-refreshed', 'false');
      return 'default' in component ? component : { default: component };
    } catch (error: any) {
      const msg = (error?.message || error || '').toString().toLowerCase();
      const isChunkError =
        msg.includes('dynamically imported module') ||
        msg.includes('disallowed mime type') ||
        msg.includes('loading chunk') ||
        msg.includes('failed to fetch') ||
        msg.includes('importing a module script failed') ||
        msg.includes('text/html');

      if (isChunkError && navigator.onLine && !pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem('page-force-refreshed', 'true');
        const url = new URL(window.location.href);
        url.searchParams.set('v', Date.now().toString());
        window.location.replace(url.toString());
        return new Promise(() => {});
      }
      throw error;
    }
  });
}

// Code-split all page-level components
const Layout   = lazyWithRetry(() => import('./components/layout/Layout').then((m) => ({ default: m.Layout })));
const Home     = lazyWithRetry(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const BlogList = lazyWithRetry(() => import('./pages/blog/BlogList').then((m) => ({ default: m.BlogList })));
const BlogPost = lazyWithRetry(() => import('./pages/blog/BlogPost').then((m) => ({ default: m.BlogPost })));
const BlogManage = lazyWithRetry(() => import('./pages/blog/BlogManage').then((m) => ({ default: m.BlogManage })));
const BlogEditor = lazyWithRetry(() => import('./pages/blog/BlogEditor').then((m) => ({ default: m.BlogEditor })));
const Login    = lazyWithRetry(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Register = lazyWithRetry(() => import('./pages/Register').then((m) => ({ default: m.Register })));
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const ReadinessReport = lazyWithRetry(() => import('./pages/ReadinessReport').then((m) => ({ default: m.ReadinessReport })));
const MarkedQuestions = lazyWithRetry(() => import('./pages/MarkedQuestions').then((m) => ({ default: m.MarkedQuestions })));
const Gallery   = lazyWithRetry(() => import('./pages/Gallery').then((m) => ({ default: m.Gallery })));
const Contact   = lazyWithRetry(() => import('./pages/Contact').then((m) => ({ default: m.Contact })));
const Settings  = lazyWithRetry(() => import('./pages/admin/Settings').then((m) => ({ default: m.Settings })));
const Users     = lazyWithRetry(() => import('./pages/admin/Users').then((m) => ({ default: m.Users })));
const Notifications = lazyWithRetry(() => import('./pages/admin/Notifications').then((m) => ({ default: m.Notifications })));
const NotFound       = lazyWithRetry(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));

const StudyAreasList = lazyWithRetry(() => import('./pages/StudyAreasList').then((m) => ({ default: m.StudyAreasList })));
const StudyAreaNew = lazyWithRetry(() => import('./pages/StudyAreaNew').then((m) => ({ default: m.StudyAreaNew })));
const StudyAreaDetail = lazyWithRetry(() => import('./pages/StudyAreaDetail').then((m) => ({ default: m.StudyAreaDetail })));
const StudyAreaEdit = lazyWithRetry(() => import('./pages/StudyAreaEdit').then((m) => ({ default: m.StudyAreaEdit })));
const ExamFlowPage = lazyWithRetry(() => import('./pages/ExamFlowPage').then((m) => ({ default: m.ExamFlowPage })));
const ResultScreenPage = lazyWithRetry(() => import('./pages/ResultScreenPage').then((m) => ({ default: m.ResultScreenPage })));

const PageLoader = () => <div className="min-h-screen px-4"><PageSkeleton /></div>;

const RootRedirect: React.FC = () => {
  const detectedLocale = getDetectedLocale();
  return <Navigate to={`/${detectedLocale}`} replace />;
};

const LocaleWrapper: React.FC = () => {
  const { locale } = useParams<{ locale: string }>();
  const location = useLocation();

  useEffect(() => {
    if (locale) {
      document.documentElement.setAttribute('lang', locale);
    }
  }, [locale]);

  if (!SUPPORTED_LOCALES.includes(locale as any)) {
    const detectedLocale = getDetectedLocale();
    const path = location.pathname === '/' ? '' : location.pathname;
    return <Navigate to={`/${detectedLocale}${path}${location.search}${location.hash}`} replace />;
  }
  return <Outlet />;
};

const HomeRoute: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const activeLocale = locale || DEFAULT_LOCALE;
  return isAuthenticated ? <Navigate to={`/${activeLocale}/dashboard`} replace /> : <><Home /><OfflineBanner /></>;
};

const App: React.FC = () => (
  <GlobalErrorBoundary>
    <ToastProvider>
      <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true }}>
        <SEO />
        <TelemetryTracker />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Dynamic Root Redirection */}
            <Route path="/" element={<RootRedirect />} />

            {/* Locale-Prefixed Parent Route */}
            <Route path="/:locale" element={<LocaleWrapper />}>
              {/* Public Root / Landing Page */}
              <Route index element={<HomeRoute />} />

              {/* Public pages wrapped in standard global Layout */}
              <Route element={<Layout />}>
                <Route path="contact" element={<Contact />} />
                <Route path="blog" element={<BlogList />} />
                <Route path="blog/:slug" element={<BlogPost />} />
                <Route path="study-areas" element={<StudyAreasList />} />
                <Route path="study-areas/:id" element={<StudyAreaDetail />} />
              </Route>

              {/* Public Auth */}
              <Route element={<PublicRoute />}>
                <Route element={<Layout />}>
                  <Route path="login"    element={<Login />} />
                  <Route path="register" element={<Register />} />
                  <Route path="forgot-password" element={<ForgotPassword />} />
                </Route>
              </Route>

              {/* Protected */}
              <Route element={<PrivateRoute />}>
                <Route element={<Layout />}>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="gallery" element={<Gallery />} />
                  <Route path="study-areas/new" element={<StudyAreaNew />} />
                  <Route path="study-areas/:id/edit" element={<StudyAreaEdit />} />
                  <Route path="study-areas/:id/readiness" element={<ReadinessReport />} />
                  <Route path="marked" element={<MarkedQuestions />} />
                  <Route path="exam/:sessionId" element={<ExamFlowPage />} />
                  <Route path="exam/:sessionId/result" element={<ResultScreenPage />} />
                </Route>
              </Route>

              {/* Dev Only — Admin Settings */}
              <Route element={<DevRoute />}>
                <Route element={<Layout />}>
                  <Route path="admin/settings" element={<Settings />} />
                  <Route path="admin/blog" element={<BlogManage />} />
                  <Route path="admin/blog/new" element={<BlogEditor />} />
                  <Route path="admin/blog/:id" element={<BlogEditor />} />
                </Route>
              </Route>

              {/* Admin/Dev */}
              <Route element={<AdminRoute />}>
                <Route element={<Layout />}>
                  <Route path="admin/users"    element={<Users />} />
                  <Route path="admin/notifications" element={<Notifications />} />
                </Route>
              </Route>

              {/* Fallback within locale */}
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* General Fallback Redirects */}
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </Suspense>
        <CookieConsent />
        <UpdatePrompt />
      </BrowserRouter>
    </AuthProvider>
  </ToastProvider>
  </GlobalErrorBoundary>
);

export default App;
