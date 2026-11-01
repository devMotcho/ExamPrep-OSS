import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { examprepApi, type StudyArea } from '@/api/examprep';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Plus, BookOpen, User, Calendar, LogIn, Compass, Library, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Pagination } from '@/components/ui/Pagination';
import { paginate } from '@/lib/pagination';

const AREAS_PER_PAGE = 12;

export const StudyAreasList: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { locale = 'en' } = useParams<{ locale: string }>();
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [activeMenu, setActiveMenu] = useState<'my' | 'explore' | 'starred'>(
    tabParam === 'starred' ? 'starred' : (tabParam === 'my' ? 'my' : 'explore')
  );
  const [studyAreas, setStudyAreas] = useState<StudyArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isStarring, setIsStarring] = useState<string | null>(null);
  const [pageByMenu, setPageByMenu] = useState({ menu: '', page: 1 });

  useEffect(() => {
    if (tabParam === 'starred') {
      setActiveMenu('starred');
    } else if (tabParam === 'my') {
      setActiveMenu('my');
    } else if (tabParam === 'explore') {
      setActiveMenu('explore');
    }
  }, [tabParam]);

  const fetchStudyAreas = useCallback(async () => {
    try {
      setLoading(true);
      if (activeMenu === 'my' && isAuthenticated) {
        const data = await examprepApi.listMyStudyAreas();
        setStudyAreas(data.filter((area) => user && area.createdById === String(user.id)));
      } else if (activeMenu === 'starred' && isAuthenticated) {
        const data = await examprepApi.listMyStudyAreas();
        setStudyAreas(data.filter((area) => area.starred));
      } else {
        const data = await examprepApi.listStudyAreas();
        setStudyAreas(data);
      }
    } catch {
      toast({ type: 'error', message: t('studyAreas.loadFailed', 'Could not load the study areas.') });
    } finally {
      setLoading(false);
    }
  }, [activeMenu, isAuthenticated, user, toast, t]);

  useEffect(() => {
    fetchStudyAreas();
  }, [fetchStudyAreas]);

  const handleStarToggle = async (e: React.MouseEvent, area: StudyArea) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate(`/${locale}/login`);
      return;
    }
    setIsStarring(area.id);
    try {
      if (area.starred) {
        await examprepApi.unstarStudyArea(area.id);
        toast({ type: 'success', message: t('studyAreas.unstarredToast', 'Removed from starred.') });
      } else {
        await examprepApi.starStudyArea(area.id);
        toast({ type: 'success', message: t('studyAreas.starredToast', 'Added to starred.') });
      }
      fetchStudyAreas(); // Refresh list to update state
      window.dispatchEvent(new Event('study-areas-updated'));
    } catch {
      toast({ type: 'error', message: t('studyAreas.starFailed', 'Could not update starred.') });
    } finally {
      setIsStarring(null);
    }
  };

  const filteredAreas = studyAreas.filter(
    (area) =>
      area.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      area.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayAreas = [...filteredAreas];
  if (activeMenu === 'explore') {
    displayAreas.sort((a, b) => {
      const scoreA = (a.starCount || 0) * 10 + (a.questionCount || 0);
      const scoreB = (b.starCount || 0) * 10 + (b.questionCount || 0);
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  const pagedAreas = paginate(displayAreas, pageByMenu.menu === activeMenu ? pageByMenu.page : 1, AREAS_PER_PAGE);

  return (
    <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/65 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-border/50 shadow-sm bg-gradient-to-br from-card to-primary/[0.01]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            {activeMenu === 'my' ? t('studyAreas.titleMy', 'My Study Areas') : activeMenu === 'starred' ? t('studyAreas.titleStarred', 'Starred Study Areas') : t('studyAreas.libraryTitle', 'Public library')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activeMenu === 'my'
              ? t('studyAreas.descMy', 'Study environments you have created to practice and collaborate.')
              : activeMenu === 'starred'
              ? t('studyAreas.descStarred', 'Study environments you have starred for quick access.')
              : t('studyAreas.libraryDesc', 'Ready-to-use question sets from other students. Open one and start practising, with nothing to create.')}
          </p>
        </div>
        {isAuthenticated ? (
          <Button
            onClick={() => navigate(`/${locale}/study-areas/new`)}
            className="bg-primary text-primary-foreground font-semibold rounded-xl gap-2 h-10 shadow-sm self-start sm:self-center"
          >
            <Plus className="h-4 w-4" /> {t('studyAreas.createButton', 'Create Study Area')}
          </Button>
        ) : (
          <Button
            onClick={() => navigate(`/${locale}/login`)}
            variant="outline"
            className="rounded-xl border-primary/20 hover:bg-primary/5 text-primary gap-2 h-10 self-start sm:self-center"
          >
            <LogIn className="h-4 w-4" /> {t('studyAreas.loginButton', 'Log In to Create')}
          </Button>
        )}
      </div>

      {/* Menu Tabs & Search on same row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-1 p-1 bg-muted/60 rounded-xl w-full md:w-auto md:max-w-[520px] shadow-inner shrink-0 overflow-x-auto scrollbar-none">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setActiveMenu('explore');
              setSearchParams({ tab: 'explore' });
            }}
            aria-pressed={activeMenu === 'explore'}
            className={`flex-1 md:flex-none shrink-0 px-2 sm:px-3 gap-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
              activeMenu === 'explore'
                ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary hover:text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <Compass className="h-4 w-4 shrink-0" />
            <span>{t('studyAreas.tabLibraryShort', 'Library')}</span>
          </Button>
          {isAuthenticated && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveMenu('my');
                setSearchParams({ tab: 'my' });
              }}
              aria-pressed={activeMenu === 'my'}
              className={`flex-1 md:flex-none shrink-0 px-2 sm:px-3 gap-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                activeMenu === 'my'
                  ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary hover:text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <Library className="h-4 w-4 shrink-0" />
              <span>{t('studyAreas.tabMyShort', 'My areas')}</span>
            </Button>
          )}
          {isAuthenticated && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveMenu('starred');
                setSearchParams({ tab: 'starred' });
              }}
              aria-pressed={activeMenu === 'starred'}
              className={`flex-1 md:flex-none shrink-0 px-2 sm:px-3 gap-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                activeMenu === 'starred'
                  ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary hover:text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <Star className="h-4 w-4 shrink-0" />
              <span>{t('studyAreas.tabStarred', 'Starred')}</span>
            </Button>
          )}
        </div>

        {/* Filter and Search */}
        {!((activeMenu === 'my' || activeMenu === 'starred') && !isAuthenticated) && (
          <div className="flex items-center gap-2 w-full md:max-w-md bg-card/65 backdrop-blur border border-border/50 px-2 py-1 md:p-2 rounded-2xl shadow-sm">
            <Search className="text-muted-foreground h-5 w-5 ml-2" aria-hidden="true" />
            <Input
              type="text"
              placeholder={t('studyAreas.searchPlaceholder', 'Search study areas by title or description...')}
              aria-label={t('studyAreas.searchPlaceholder', 'Search study areas by title or description...')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPageByMenu({ menu: activeMenu, page: 1 });
              }}
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-1 py-0 h-8 w-full"
            />
          </div>
        )}
      </div>

      {(activeMenu === 'my' || activeMenu === 'starred') && !isAuthenticated ? (
        <Card className="rounded-2xl border border-dashed border-border/80 bg-card/30 p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
          <div className="p-4 rounded-full bg-primary/10 text-primary">
            <LogIn className="h-8 w-8" />
          </div>
          <div className="space-y-1 max-w-md">
            <CardTitle className="text-lg font-bold">
              {t('studyAreas.loginRequired', 'View your study environments')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('studyAreas.loginDesc', 'Please log in to manage your created study areas and access your starred favorites.')}
            </CardDescription>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate(`/${locale}/login`)}
              className="rounded-xl font-semibold bg-primary text-primary-foreground"
            >
              {t('nav.login', 'Log In')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setActiveMenu('explore');
                setSearchParams({ tab: 'explore' });
              }}
              className="rounded-xl font-semibold border-border/60 hover:bg-muted"
            >
              {t('studyAreas.tabLibrary', 'Public library')}
            </Button>
          </div>
        </Card>
      ) : (
        <>


          {activeMenu === 'my' && !loading && displayAreas.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-primary/20 bg-primary/5">
              <p className="text-sm text-foreground">
                {t('studyAreas.libraryCallout', 'Short on time? The public library has question sets ready to practise.')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveMenu('explore');
                  setSearchParams({ tab: 'explore' });
                }}
                className="rounded-xl font-semibold shrink-0 gap-1.5"
              >
                <Compass className="h-4 w-4" /> {t('studyAreas.browseLibrary', 'Browse the public library')}
              </Button>
            </div>
          )}

          {/* Grid List */}
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-48 bg-muted/65 border border-border/40 rounded-2xl animate-pulse" />
              ))}
            </div>
      ) : displayAreas.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-border/80 bg-card/30 p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="p-4 rounded-full bg-primary/10 text-primary">
            <BookOpen className="h-8 w-8" />
          </div>
          <div className="space-y-1 max-w-md">
            <CardTitle className="text-lg font-bold">
              {!searchQuery && activeMenu === 'my'
                ? t('studyAreas.emptyMyTitle', 'Start with questions that already exist')
                : t('studyAreas.emptyExplore', 'No study areas found.')}
            </CardTitle>
            <CardDescription className="text-xs">
              {searchQuery
                ? t('studyAreas.emptySubExplore', "Try adjusting your search query or check back later.")
                : activeMenu === 'my'
                ? t('studyAreas.emptyMyDesc', "You haven't created any study areas yet. Practise right away with the public library, or create your own and add questions.")
                : activeMenu === 'starred'
                ? t('studyAreas.emptyStarred', "You haven't starred any study areas yet.") + " " + t('studyAreas.emptySubStarred', "Explore public study areas and star your favorites.")
                : t('studyAreas.emptySubExplore', "Try adjusting your search query or check back later.")}
            </CardDescription>
          </div>
          {isAuthenticated && !searchQuery && (
            <div className="flex flex-wrap justify-center gap-3">
              {activeMenu !== 'explore' && (
                <Button
                  onClick={() => {
                    setActiveMenu('explore');
                    setSearchParams({ tab: 'explore' });
                  }}
                  className="rounded-xl font-semibold bg-primary"
                >
                  {t('studyAreas.browseLibrary', 'Browse the public library')}
                </Button>
              )}
              {activeMenu !== 'starred' && (
                <Button
                  variant={activeMenu === 'explore' ? 'default' : 'outline'}
                  onClick={() => navigate(`/${locale}/study-areas/new`)}
                  className="rounded-xl font-semibold"
                >
                  {t('studyAreas.createButton', 'Create Study Area')}
                </Button>
              )}
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pagedAreas.pageItems.map((area) => (
            <Card
              key={area.id}
              className="group rounded-2xl border border-border/50 hover:border-primary/25 bg-card/65 backdrop-blur shadow-sm hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden relative has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring"
            >
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {isAuthenticated && user && (area.createdById === String(user.id) || user.role === 'ROLE_ADMIN' || user.role === 'ROLE_DEV') && (
                    <Badge variant="secondary" className="bg-primary/5 text-primary text-[11px] font-black uppercase px-2 h-5 rounded-md">
                      {area.visibility === 'PRIVATE' ? t('studyAreaForm.private', 'Private') : t('studyAreaForm.public', 'Public')}
                    </Badge>
                  )}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      onClick={(e) => handleStarToggle(e, area)}
                      disabled={isStarring === area.id}
                      variant="outline"
                      size="sm"
                      aria-pressed={!!area.starred}
                      aria-label={t('studyAreas.starAria', 'Star {{title}}, {{count}} stars', { title: area.title, count: area.starCount || 0 })}
                      className={`relative z-10 h-6 min-w-11 px-2 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all duration-300 ${
                        area.starred
                          ? 'border-yellow-500/35 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Star className={`h-3 w-3 ${area.starred ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                      <span>{area.starCount}</span>
                    </Button>
                    <Badge variant="outline" className="border-border text-muted-foreground text-[11px] font-bold px-2 h-6 rounded-md">
                      {area.questionCount} {area.questionCount === 1 ? t('studyAreaDetail.question_one', 'Question') : t('studyAreaDetail.question_other', 'Questions')}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-lg font-black tracking-tight text-foreground group-hover:text-primary transition-colors mt-2 line-clamp-1">
                  <Link to={`/${locale}/study-areas/${area.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                    {area.title}
                  </Link>
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs leading-relaxed mt-1 line-clamp-2 min-h-[32px]">
                  {area.description || t('studyAreaDetail.noDescription', 'No description provided for this study area.')}
                </CardDescription>
              </CardHeader>

              <CardContent className="px-5 pb-5 pt-0 flex-1 flex flex-col justify-end">
                <div className="flex flex-col gap-1.5 py-3 border-t border-border/30 text-xs text-muted-foreground mt-3">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span>{t('studyAreaDetail.createdBy', 'Created by:')} <span className="font-semibold text-foreground/80">{area.createdBy}</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(area.createdAt).toLocaleDateString(locale)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Pagination
          currentPage={pagedAreas.currentPage}
          totalPages={pagedAreas.totalPages}
          onPageChange={(next) => {
            setPageByMenu({ menu: activeMenu, page: next });
            window.scrollTo({ top: 0 });
          }}
        />
        </div>
      )}
      </>
      )}
    </div>
  );
};
