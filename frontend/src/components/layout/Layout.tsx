import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../lib/config/useConfig';
import { useLocale } from '../../hooks/useLocale';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Image as ImageIcon,
  BookOpen,
  LogOut,
  Settings,
  Star,
  ChevronsUpDown,
  Bell,
  UserRound,
} from 'lucide-react';
import { examprepApi, type StudyArea } from '@/api/examprep';
import { PublicFooter } from '../public/PublicFooter';
import { notificationService } from '@/features/notifications/services/notificationService';
import { PublicNavbar } from '../public/PublicNavbar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Key, Newspaper, PenLine } from 'lucide-react';
import { useBlogPosts } from '@/components/blog/FeatureGuideLink';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { OfflineState } from '@/components/pwa/OfflineState';
import { useOnline } from '@/lib/online';

// ── Nav config ─────────────────────────────────────────────────────────────────
interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  devOnly?: boolean;
  authOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',     to: '/dashboard',           icon: <LayoutDashboard size={18} />, authOnly: true },
  { label: 'Study Areas',   to: '/study-areas',         icon: <BookOpen size={18} />,        authOnly: false },
  { label: 'Users',         to: '/admin/users',         icon: <Users size={18} />,           adminOnly: true, authOnly: true },
  { label: 'Settings',      to: '/admin/settings',      icon: <Settings size={18} />,        devOnly: true,   authOnly: true },
  { label: 'Gallery',       to: '/gallery',             icon: <ImageIcon size={18} />,         authOnly: true },
  { label: 'Blog',          to: '/blog',                icon: <Newspaper size={18} />,       authOnly: true },
  { label: 'Articles',      to: '/admin/blog',          icon: <PenLine size={18} />,         devOnly: true,   authOnly: true },
];

// ── Sidebar ────────────────────────────────────────────────────────────────────
interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  visibleItems: NavItem[];
}

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile, visibleItems }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const { t } = useTranslation();
  
  const [starredAreas, setStarredAreas] = useState<StudyArea[]>([]);
  const [totalStarredCount, setTotalStarredCount] = useState<number>(0);

  const fetchStarred = useCallback(async () => {
    if (isAuthenticated) {
      try {
        const data = await examprepApi.listMyStudyAreas();
        const starred = data.filter((area) => area.starred);
        setTotalStarredCount(starred.length);
        setStarredAreas(starred.slice(0, 5));
      } catch (err) {
        console.error('Failed to fetch starred areas:', err);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchStarred();
    window.addEventListener('study-areas-updated', fetchStarred);
    return () => {
      window.removeEventListener('study-areas-updated', fetchStarred);
    };
  }, [fetchStarred]);

  const Inner = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" aria-label={t('nav.mainNavigation', 'Main navigation')}>
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t('nav.menu', 'Menu')}
          </p>
        </div>
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={`/${locale}${item.to}`}
            onClick={onCloseMobile}
            title={t(`nav.${item.label.toLowerCase()}`, item.label)}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 h-11 md:h-9 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="truncate">{t(`nav.${item.label.toLowerCase()}`, item.label)}</span>
          </NavLink>
        ))}

        {isAuthenticated && starredAreas.length > 0 && (
          <div className="pt-3 mt-3 border-t border-border/40">
            <button
              onClick={() => navigate(`/${locale}/study-areas?tab=starred`)}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted/40 rounded-lg transition-colors text-left"
            >
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                {t('nav.starredAreas', 'Starred Areas')}
              </p>
              <span className="bg-primary/10 text-primary text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {totalStarredCount}
              </span>
            </button>
            <div className="space-y-0.5">
              {starredAreas.map((area) => (
                <NavLink
                  key={area.id}
                  to={`/${locale}/study-areas/${area.id}`}
                  onClick={onCloseMobile}
                  title={area.title}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-2.5 rounded-lg px-3 h-11 md:h-8 text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  <Star size={11} className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="truncate">{area.title}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-transparent animate-in fade-in duration-200"
        />
      )}

      {/* Desktop & Mobile sidebar drawer */}
      <aside
        className={cn(
          'fixed top-[calc(var(--sat)+76px)] sm:top-[calc(var(--sat)+88px)] bottom-[calc(var(--bottom-bar-h,0px)+0.75rem)] md:bottom-4 z-50 flex flex-col w-64 bg-card border border-border/50 shadow-2xl rounded-2xl transition-all duration-200 ease-out',
          'left-3 sm:left-4 xl:left-[max(1rem,calc(50vw-40rem))]',
          mobileOpen ? 'translate-x-0 opacity-100' : '-translate-x-[300px] opacity-0 pointer-events-none invisible',
        )}
      >
        {Inner}
      </aside>
    </>
  );
};


// ── User Profile Dropdown ────────────────────────────────────────────────────────

export const UserProfileDropdown: React.FC<{ rightOpen?: boolean; onCloseRight?: () => void; onToggleRight?: () => void }> = ({ rightOpen, onCloseRight, onToggleRight }) => {
  const { role, isAuthenticated, user, logout } = useAuth();
  const config = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useLocale();
  const { t } = useTranslation();

  const isNotificationsPage = location.pathname === '/admin/notifications';
  const isAdmin = role === 'ROLE_ADMIN' || role === 'ROLE_DEV';
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    if (isAuthenticated && isAdmin) {
      try {
        const res = await notificationService.getAll();
        const count = res.data.filter((m) => !m.read).length;
        setUnreadCount(count);
      } catch (err) {
        console.error('Failed to fetch unread notifications count:', err);
      }
    }
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    Promise.resolve().then(() => fetchUnreadCount());
    const interval = setInterval(fetchUnreadCount, 30000);

    const handleUpdate = () => {
      fetchUnreadCount();
    };

    window.addEventListener('notifications-updated', handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('notifications-updated', handleUpdate);
    };
  }, [fetchUnreadCount]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate(`/${locale}/login`);
  }, [logout, navigate, locale]);

  const initials = user?.name
    ? user.name
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : role === 'ROLE_DEV' ? 'DV' : role === 'ROLE_ADMIN' ? 'AD' : 'US';
  const displayName = user?.name || (role === 'ROLE_DEV' ? t('users.roles.dev', 'Developer') : role === 'ROLE_ADMIN' ? t('users.roles.admin', 'Administrator') : t('users.roles.user', 'User'));
  const displayEmail = user?.email || t('nav.loggedIn', 'Logged in');
  const roleLabel = role === 'ROLE_DEV' ? t('users.roles.dev', 'Developer') : role === 'ROLE_ADMIN' ? t('users.roles.admin', 'Admin') : t('users.roles.user', 'User');

  return (
    <>
      <button
        onClick={onToggleRight}
        className="flex items-center gap-2.5 rounded-lg p-1.5 min-h-11 min-w-11 justify-center transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-transparent bg-muted/30 hover:bg-muted/60 hover:shadow-sm border-border/30 hover:border-border/50"
        aria-label={t('nav.accountMenu', 'Account menu')} aria-expanded={!!rightOpen}
      >
        <div className="relative shrink-0">
          <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-foreground text-[11px] font-bold shadow-inner">
            {initials}
          </div>
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-background ring-1 ring-emerald-500/20 animate-pulse" />
          {isAdmin && unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-danger border border-background ring-1 ring-danger/20 animate-pulse" />
          )}
        </div>
        
        <div className="hidden sm:block min-w-0 flex-1 max-w-[120px]">
          <p className="text-xs font-bold text-foreground truncate leading-snug">{displayName}</p>
          <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
            <span className="text-[10px] px-1 py-0.5 rounded-sm bg-primary/10 text-foreground font-bold uppercase tracking-wider leading-none shrink-0">
              {roleLabel}
            </span>
          </div>
        </div>
        <ChevronsUpDown size={14} className="text-muted-foreground shrink-0 mr-0.5 hidden sm:block" />
      </button>

      {/* Drawer inside Portal to escape navbar transforms */}
      {createPortal(
        <>
          {/* Backdrop for right sidebar */}
          {rightOpen && (
            <div
              onClick={onCloseRight}
              className="fixed inset-0 z-40 bg-transparent animate-in fade-in duration-200"
            />
          )}

          {/* Right Sidebar Drawer */}
          <aside
            className={cn(
              'fixed top-[calc(var(--sat)+76px)] sm:top-[calc(var(--sat)+88px)] bottom-[calc(var(--bottom-bar-h,0px)+0.75rem)] md:bottom-4 z-50 flex flex-col w-64 bg-card border border-border/50 shadow-2xl rounded-2xl transition-all duration-200 ease-out',
              'right-3 sm:right-4 xl:right-[max(1rem,calc(50vw-40rem))]',
              rightOpen ? 'translate-x-0 opacity-100' : 'translate-x-[300px] opacity-0 pointer-events-none invisible',
            )}
          >
            <div className="flex flex-col h-full overflow-hidden">
              <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
            <div className="px-3 py-2 mb-2 flex flex-col gap-0.5 border-b border-border/40 pb-3">
              <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{displayEmail}</p>
              <div className="flex mt-2 justify-between items-center gap-2">
                {config.dark_mode_enabled !== 'false' ? (
                  <div className="flex-1 max-w-[120px]">
                    <ThemeToggle variant="sidebar-expanded" />
                  </div>
                ) : <div />}
                <LanguageSwitcher />
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  if (onCloseRight) onCloseRight();
                  navigate(`/${locale}/admin/notifications`);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group',
                  isNotificationsPage
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-2">
                  <Bell size={15} className={cn('shrink-0 transition-colors', isNotificationsPage ? 'text-primary-foreground' : 'text-muted-foreground')} />
                  <span>{t('nav.notifications', 'Notifications')}</span>
                </div>
                {unreadCount > 0 && (
                  <span className={cn(
                    'border text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 transition-colors',
                    isNotificationsPage
                      ? 'bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30'
                      : 'bg-danger/10 text-danger border border-danger/30'
                  )}>
                    {unreadCount}
                  </span>
                )}
              </button>
            )}



            {role !== 'ROLE_DEV' && (
              <div className="pt-2 mt-2 border-t border-border/40">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-3 py-2">
                  {t('nav.accountSettings', 'Account Settings')}
                </p>
                <button
                  onClick={() => {
                    if (onCloseRight) onCloseRight();
                    setIsChangePasswordOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-muted-foreground hover:bg-muted hover:text-foreground group"
                >
                  <Key size={15} className="shrink-0 transition-colors text-muted-foreground" />
                  <span>{t('nav.changePassword', 'Change Password')}</span>
                </button>
              </div>
            )}

            <div className="pt-2 mt-2 border-t border-border/40">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-muted-foreground hover:bg-muted hover:text-foreground group"
              >
                <LogOut size={15} className="shrink-0 transition-colors text-muted-foreground" />
                <span>{t('nav.logout', 'Log Out')}</span>
              </button>
            </div>
          </nav>
        </div>
      </aside>
      </>,
      document.body
      )}

      <ChangePasswordDialog
        isOpen={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
      />
    </>
  );
};


// ── Bottom navigation (phones) ─────────────────────────────────────────────────
const BOTTOM_NAV_HEIGHT = 'calc(3.5rem + var(--sab))';

const BottomNav: React.FC<{ accountOpen: boolean; onToggleAccount: () => void }> = ({ accountOpen, onToggleAccount }) => {
  const { locale } = useLocale();
  const { t } = useTranslation();

  // Lets fixed elements (cookie notice, prompts, drawers) sit above the bar, on phones only.
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const apply = () => document.documentElement.style.setProperty('--bottom-bar-h', media.matches ? BOTTOM_NAV_HEIGHT : '0px');
    apply();
    media.addEventListener('change', apply);
    return () => {
      media.removeEventListener('change', apply);
      document.documentElement.style.removeProperty('--bottom-bar-h');
    };
  }, []);

  const itemClass = 'flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 h-14 text-[11px] font-semibold transition-colors';
  const links = [
    { to: `/${locale}/dashboard`, label: t('nav.dashboard', 'Dashboard'), icon: <LayoutDashboard size={20} aria-hidden="true" /> },
    { to: `/${locale}/study-areas`, label: t('nav.areasShort', 'Areas'), icon: <BookOpen size={20} aria-hidden="true" /> },
  ];

  return (
    <nav
      aria-label={t('nav.mainNavigation', 'Main navigation')}
      className="md:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card pb-[var(--sab)]"
    >
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => cn(itemClass, isActive && !accountOpen ? 'text-primary' : 'text-muted-foreground')}
        >
          {link.icon}
          <span className="truncate">{link.label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onToggleAccount}
        aria-expanded={accountOpen}
        className={cn(itemClass, accountOpen ? 'text-primary' : 'text-muted-foreground')}
      >
        <UserRound size={20} aria-hidden="true" />
        <span className="truncate">{t('nav.account', 'Account')}</span>
      </button>
    </nav>
  );
};

// ── Layout (root) ──────────────────────────────────────────────────────────────
export const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { role, isAuthenticated } = useAuth();
  const isAdmin = role === 'ROLE_ADMIN' || role === 'ROLE_DEV';
  const location = useLocation();
  // Exams run without navigation; ExamFlowPage provides its own exit control.
  const isFocusedExam = /^\/[^/]+\/exam\/[^/]+\/?$/.test(location.pathname);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
    setRightOpen(false);
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  // Handle overlapping sidebars on mobile (< 768px)
  useEffect(() => {
    if (window.innerWidth < 768 && mobileOpen) {
      setRightOpen(false);
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (window.innerWidth < 768 && rightOpen) {
      setMobileOpen(false);
    }
  }, [rightOpen]);

  const config = useConfig();

  // Calculate visible sidebar items dynamically
  const hasBlogPosts = useBlogPosts().length > 0;
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.authOnly && !isAuthenticated) return false;
    if (item.devOnly && !isAdmin) return false;
    if (item.adminOnly && !isAdmin) return false;
    if (item.to === '/gallery' && config?.gallery_enabled !== 'true') return false;
    if (item.to === '/blog' && !hasBlogPosts) return false;
    return true;
  });

  const hasSidebar = isAuthenticated && visibleItems.length > 0;

  // A page already on screen stays readable after the connection drops;
  // anything opened while offline has no data to show, so it gets the offline screen.
  const online = useOnline();
  const loadedOnlineKey = useRef<string | null>(null);
  if (online) loadedOnlineKey.current = location.key;
  const showOfflineScreen = !online && loadedOnlineKey.current !== location.key;

  if (isFocusedExam) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <main className="flex-1 w-full min-w-0">
          <Suspense fallback={<PageSkeleton variant="exam" />}>
            {children || <Outlet />}
          </Suspense>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      <PublicNavbar 
        isSticky={true} 
        onMenuToggle={hasSidebar ? () => setMobileOpen(prev => !prev) : undefined}
        isSidebarOpen={mobileOpen}
        userProfileNode={isAuthenticated ? <UserProfileDropdown rightOpen={rightOpen} onCloseRight={() => setRightOpen(false)} onToggleRight={() => setRightOpen(prev => !prev)} /> : undefined}
      />

      {/* Clips without becoming a scroll container, which would stop sticky children from sticking. */}
      <div className="flex flex-1 overflow-clip relative max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4 pb-8 md:pb-20">
        {hasSidebar && (
          <Sidebar
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
            visibleItems={visibleItems}
          />
        )}

        <main className="flex-1 w-full max-w-full min-w-0">
          {showOfflineScreen ? (
            <OfflineState />
          ) : (
            <>
              <Suspense fallback={<PageSkeleton />}>
                {children || <Outlet />}
              </Suspense>
            </>
          )}
        </main>
      </div>

      <div className={cn('mt-auto', isAuthenticated && 'pb-[calc(3.5rem+var(--sab))] md:pb-0')}>
        <PublicFooter />
      </div>

      {!showOfflineScreen && <OfflineBanner />}

      {isAuthenticated && (
        <BottomNav
          accountOpen={rightOpen}
          onToggleAccount={() => setRightOpen((prev) => !prev)}
        />
      )}
    </div>
  );
};
