import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/context/ToastContext';
import { notificationService } from '@/features/notifications/services/notificationService';
import type { ContactMessage, ContactMessageStatus } from '@/features/notifications/types';
import { ContactDetailDialog } from '../../components/admin/ContactDetailDialog';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { Pagination } from '@/components/ui/Pagination';
import { useConfig } from '@/lib/config/useConfig';
import {
  Mail, ChevronDown, Check,
  Plus, X, Palette, Search, Inbox, Settings2, ChevronRight,
  Tag, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const PRESET_COLORS = [
  '#ef4444', '#f59e0b', '#3b82f6', '#10b981',
  '#8b5cf6', '#ec4899', '#6b7280', '#f97316', '#14b8a6',
];

export const Notifications: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const config = useConfig();
  const defaultPageSize = parseInt(config?.default_page_size || '10', 10);

  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [statuses, setStatuses] = useState<ContactMessageStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter state: IDs of statuses shown in their own tabs
  // __awaiting__ is pre-seeded so the Awaiting tab is valid on first render
  const [activeFilterIds, setActiveFilterIds] = useState<Set<string>>(new Set(['__awaiting__']));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Which tab is currently open
  const [activeTab, setActiveTab] = useState<string>('__awaiting__');

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Detail modal
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);

  // Delete states
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  // Status CRUD panel
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState(PRESET_COLORS[2]);
  const [creatingStatus, setCreatingStatus] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [msgRes, stRes] = await Promise.all([
        notificationService.getAll(),
        notificationService.getStatuses(),
      ]);
      setMessages(msgRes.data);
      setStatuses(stRes.data);
    } catch {
      toast({ type: 'error', message: 'Failed to load notifications.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Seed all statuses as active on first load
  useEffect(() => {
    if (statuses.length > 0) {
      setActiveFilterIds(prev => {
        const next = new Set(prev);
        // always include awaiting
        next.add('__awaiting__');
        statuses.forEach(s => next.add(s.id));
        return next;
      });
    }
  }, [statuses]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Filter toggles ────────────────────────────────────────────────
  const toggleFilter = (id: string) => {
    setActiveFilterIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (activeTab === id) {
          const first = id === '__awaiting__'
            ? (statuses.find(s => next.has(s.id))?.id ?? '__others__')
            : (next.has('__awaiting__') ? '__awaiting__' : (statuses.find(s => next.has(s.id))?.id ?? '__others__'));
          setActiveTab(first);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ── Dynamic tab list ──────────────────────────────────────────────
  const activeTabs = useMemo(() => {
    const tabs: Array<{ id: string; label: string; color?: string }> = [];
    if (activeFilterIds.has('__awaiting__')) {
      tabs.push({ id: '__awaiting__', label: t('notifications.awaiting', 'Awaiting'), color: '#f59e0b' });
    }
    statuses
      .filter(s => activeFilterIds.has(s.id))
      .forEach(s => tabs.push({ id: s.id, label: s.name, color: s.color }));
    tabs.push({ id: '__others__', label: t('notifications.others', 'Others') });
    return tabs;
  }, [activeFilterIds, statuses]);

  // Ensure activeTab stays valid
  useEffect(() => {
    if (!activeTabs.find(t => t.id === activeTab)) {
      setActiveTab(activeTabs[0]?.id ?? '__others__');
    }
  }, [activeTabs, activeTab]);

  // ── Filtered messages ─────────────────────────────────────────────
  const searchedMessages = useMemo(() =>
    messages.filter(m =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.message.toLowerCase().includes(searchTerm.toLowerCase())
    ), [messages, searchTerm]);

  const tabMessages = useMemo((): ContactMessage[] => {
    let filtered: ContactMessage[];
    if (activeTab === '__awaiting__') {
      filtered = searchedMessages.filter(m => m.status === null);
    } else if (activeTab === '__others__') {
      filtered = searchedMessages.filter(m => {
        if (m.status === null) return !activeFilterIds.has('__awaiting__');
        return !activeFilterIds.has(m.status.id);
      });
    } else {
      filtered = searchedMessages.filter(m => m.status?.id === activeTab);
    }
    return filtered.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [searchedMessages, activeTab, activeFilterIds]);

  const tabCount = useCallback((tabId: string): number => {
    if (tabId === '__awaiting__') return searchedMessages.filter(m => m.status === null).length;
    if (tabId === '__others__') {
      return searchedMessages.filter(m => {
        if (m.status === null) return !activeFilterIds.has('__awaiting__');
        return !activeFilterIds.has(m.status.id);
      }).length;
    }
    return searchedMessages.filter(m => m.status?.id === tabId).length;
  }, [searchedMessages, activeFilterIds]);

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, activeFilterIds]);

  const awaitingCount = useMemo(() => messages.filter(m => m.status === null).length, [messages]);
  const totalFilters = statuses.length + 1; // +1 for awaiting
  const activeFilterCount = activeFilterIds.size;

  // Pagination logic
  const totalPages = Math.ceil(tabMessages.length / defaultPageSize);
  const paginatedMessages = tabMessages.slice((currentPage - 1) * defaultPageSize, currentPage * defaultPageSize);

  // ── Actions ───────────────────────────────────────────────────────
  const handleViewDetails = useCallback(async (msg: ContactMessage) => {
    setSelectedMessage(msg);
    if (!msg.read) {
      try {
        await notificationService.markAsRead(msg.id, true);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
        window.dispatchEvent(new Event('notifications-updated'));
      } catch { /* non-critical */ }
    }
  }, []);

  const handleDialogUpdate = () => {
    fetchData();
  };

  const handleDelete = useCallback(async (id: string) => {
    try {
      await notificationService.remove(id);
      toast({ type: 'success', message: 'Message deleted.' });
      setMessages(prev => prev.filter(m => m.id !== id));
      window.dispatchEvent(new Event('notifications-updated'));
      if (selectedMessage?.id === id) setSelectedMessage(null);
      setDeleteMessage(null);
    } catch {
      toast({ type: 'error', message: 'Failed to delete message.' });
    }
  }, [toast, selectedMessage]);

  // ── Status CRUD ───────────────────────────────────────────────────
  const handleCreateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusName.trim()) return;
    setCreatingStatus(true);
    try {
      await notificationService.createStatus(newStatusName.trim(), newStatusColor);
      const name = newStatusName.trim();
      setNewStatusName('');
      setNewStatusColor(PRESET_COLORS[2]);
      await fetchData();
      toast({ type: 'success', message: `Status "${name}" created.` });
    } catch {
      toast({ type: 'error', message: 'Failed to create status.' });
    } finally {
      setCreatingStatus(false);
    }
  };

  const handleDeleteStatus = async (id: string) => {
    try {
      await notificationService.deleteStatus(id);
      setActiveFilterIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast({ type: 'success', message: 'Status deleted.' });
      await fetchData();
      setDeleteStatus(null);
    } catch {
      toast({ type: 'error', message: 'Failed to delete status.' });
    }
  };

  // ── Channel icons ─────────────────────────────────────────────────
  const renderChannelIcons = (channelsStr: string) => {
    if (!channelsStr?.trim()) return null;
    const channels = channelsStr.split(',').map(s => s.trim().toUpperCase());
    const icons: Record<string, React.ReactNode> = {
      EMAIL: <span title="Email"><Mail size={11} className="text-blue-400" /></span>,
    };
    return (
      <span className="flex items-center gap-1 ml-1">
        {channels.map(ch => (
          <span key={ch} className="inline-flex">{icons[ch] ?? null}</span>
        ))}
      </span>
    );
  };

  const dialogAdapter = useMemo(() => {
    if (!selectedMessage) return null;
    // Always resolve the LATEST version from the messages array so status
    // changes inside the dialog are reflected immediately without closing it.
    const fresh = messages.find(m => m.id === selectedMessage.id) ?? selectedMessage;
    return {
      id: fresh.id,
      name: fresh.name,
      email: fresh.email,
      subject: fresh.subject,
      message: fresh.message,
      createdAt: fresh.createdAt,
      isRead: fresh.read,
      ipAddress: fresh.ipAddress,
      sentChannels: fresh.sentChannels,
      type: fresh.type,
      statusId: fresh.status?.id,
      statusName: fresh.status?.name,
      statusColor: fresh.status?.color,
      replyMessage: fresh.replyMessage,
    };
  }, [selectedMessage, messages]);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-7xl space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/65 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-border/50 shadow-sm bg-gradient-to-br from-card to-primary/[0.01]">
        <div>
          <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{t('notifications.title', 'Platform Inbox')}</h1>
            {awaitingCount > 0 && (
              <Badge variant="outline" className="w-fit animate-pulse border-amber-500/35 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {awaitingCount} {t('notifications.awaiting', 'Awaiting')}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm font-medium mt-2 max-w-2xl leading-relaxed">
            {t('notifications.description', 'Review and respond to contact submissions, categorize message statuses, and dispatch SMTP replies. Currently tracking')} <span className="font-bold text-primary">{messages.length} {t('notifications.totalVolume', 'total volume')}</span>.
          </p>
        </div>
        <Button
          variant={showStatusPanel ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowStatusPanel(v => !v)}
          className="rounded-xl h-9 font-bold gap-2 text-xs shrink-0"
        >
          <Settings2 size={14} />
          {t('notifications.manageStatuses', 'Manage Statuses')}
        </Button>
      </div>

      {/* Status CRUD Panel */}
      {showStatusPanel && (
        <div className="bg-card/70 backdrop-blur-md border border-border/50 rounded-2xl p-5 shadow-md space-y-5 animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Palette size={14} className="text-primary" />
              <span className="text-xs font-black uppercase tracking-wider text-foreground">{t('notifications.statusTags', 'Status Labels')}</span>
            </div>
            <Button variant="ghost" size="icon-xs" onClick={() => setShowStatusPanel(false)} className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground">
              <X size={13} />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {statuses.length === 0 && (
              <p className="text-xs text-muted-foreground italic">{t('notifications.noStatuses', 'No statuses yet. Create one below.')}</p>
            )}
            {statuses.map(st => (
              <div
                key={st.id}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold"
                style={{ backgroundColor: `${st.color}12`, color: st.color, borderColor: `${st.color}35` }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                <span>{st.name}</span>
                <button
                  onClick={() => setDeleteStatus(st.id)}
                  className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded-full hover:bg-black/10 transition-all"
                  title="Delete status"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleCreateStatus} className="border-t border-border/40 pt-4 space-y-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{t('notifications.addStatus', 'Create New Status')}</span>
            <div className="flex gap-2 items-end">
              <Input
                value={newStatusName}
                onChange={e => setNewStatusName(e.target.value)}
                placeholder={t('notifications.newStatusName', "e.g. In Progress")}
                className="h-9 rounded-xl text-xs bg-background/50 border-border/60 font-medium"
              />
              <Button
                type="submit"
                size="sm"
                disabled={creatingStatus || !newStatusName.trim()}
                className="h-9 rounded-xl font-bold text-xs gap-1.5 shrink-0"
              >
                <Plus size={13} />
                {t('notifications.create', 'Create')}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground font-bold">Color:</span>
              <div className="flex gap-1.5">
                {PRESET_COLORS.map(col => (
                  <button
                    key={col} type="button"
                    onClick={() => setNewStatusColor(col)}
                    className={cn(
                      'w-5 h-5 rounded-full border-2 transition-all hover:scale-110',
                      newStatusColor === col ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
              <div className="relative w-5 h-5 rounded-full overflow-hidden border border-border shrink-0">
                <input
                  type="color" value={newStatusColor}
                  onChange={e => setNewStatusColor(e.target.value)}
                  className="absolute -inset-1 cursor-pointer w-7 h-7"
                />
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">{newStatusColor}</span>
            </div>
          </form>
        </div>
      )}

      {/* Main Inbox Card */}
      <Card className="bg-card/65 backdrop-blur-md border-border/50 shadow-md rounded-2xl overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-black tracking-tight">Notification Inbox</CardTitle>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('notifications.searchPlaceholder', "Search inbox...")}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="h-9 pl-8 w-44 rounded-xl border-border/60 text-xs font-medium bg-background/30"
                />
              </div>

              {/* Filter Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDropdownOpen(v => !v)}
                  className={cn(
                    'h-9 rounded-xl text-xs font-bold gap-2 border-border/60',
                    dropdownOpen && 'border-primary/50 bg-primary/5'
                  )}
                >
                  <Palette size={13} className="text-muted-foreground" />
                  {t('notifications.filterTags', 'Filters')}
                  {activeFilterCount < totalFilters && (
                    <span className="bg-primary text-primary-foreground text-[11px] font-black px-1.5 py-0.5 rounded-full leading-none">
                      {activeFilterCount}/{totalFilters}
                    </span>
                  )}
                  <ChevronDown size={12} className={cn('text-muted-foreground transition-transform duration-200', dropdownOpen && 'rotate-180')} />
                </Button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50 bg-card border border-border rounded-2xl shadow-2xl p-3 w-56 space-y-1 animate-in slide-in-from-top-2 duration-200">
                    <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground px-1 pb-2 border-b border-border/40">
                      Show in tabs
                    </p>

                    {/* Awaiting row */}
                    <button
                      onClick={() => toggleFilter('__awaiting__')}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-muted transition-colors text-xs font-bold"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="text-amber-700 dark:text-amber-400">{t('notifications.awaiting', 'Awaiting Action')}</span>
                      </span>
                      <span className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                        activeFilterIds.has('__awaiting__')
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border bg-background'
                      )}>
                        {activeFilterIds.has('__awaiting__') && <Check size={10} strokeWidth={3} />}
                      </span>
                    </button>

                    {statuses.map(st => (
                      <button
                        key={st.id}
                        onClick={() => toggleFilter(st.id)}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-muted transition-colors text-xs font-bold"
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                          <span style={{ color: st.color }}>{st.name}</span>
                        </span>
                        <span
                          className={cn(
                            'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                            activeFilterIds.has(st.id) ? 'text-white' : 'border-border bg-background'
                          )}
                          style={activeFilterIds.has(st.id) ? { backgroundColor: st.color, borderColor: st.color } : undefined}
                        >
                          {activeFilterIds.has(st.id) && <Check size={10} strokeWidth={3} />}
                        </span>
                      </button>
                    ))}

                    {statuses.length === 0 && (
                      <p className="text-[11px] text-muted-foreground text-center py-1 italic">No statuses created yet</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex flex-col">
          {/* Dynamic Tabs */}
          <div className="flex border-b border-border/40 overflow-x-auto overflow-y-hidden scrollbar-none px-6 gap-0">
            {activeTabs.map(tab => {
              const count = tabCount(tab.id);
              const isActive = activeTab === tab.id;
              const isAwaiting = tab.id === '__awaiting__';
              const isOthers = tab.id === '__others__';
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {isAwaiting && <span className={cn('w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0', count > 0 && 'animate-pulse')} />}
                  {!isAwaiting && !isOthers && tab.color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tab.color }} />}
                  {isOthers && <Inbox size={12} />}
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full transition-colors',
                      isActive
                        ? isOthers
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'font-semibold'
                        : 'bg-muted text-muted-foreground font-medium'
                    )}
                    style={isActive && !isOthers ? {
                      backgroundColor: isAwaiting ? '#f59e0b12' : `${tab.color}12`,
                      color: isAwaiting ? '#d97706' : tab.color
                    } : undefined}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Message Feed — Dashboard inbox style */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-xs font-bold animate-pulse">
              Loading notifications...
            </div>
          ) : tabMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Inbox size={32} className="opacity-30" />
              <p className="text-sm font-semibold">{t('notifications.noInquiries', 'No messages in this category')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[calc(100vh-22rem)] overflow-y-auto px-2 flex-1 pt-2">
              {paginatedMessages.map(msg => (
                <div
                  key={msg.id}
                  onClick={() => handleViewDetails(msg)}
                  className="flex flex-col lg:flex-row lg:items-center justify-between p-4 cursor-pointer group hover:bg-muted/30 rounded-xl transition-all duration-200 border border-border/20 hover:border-border/40 mx-1 gap-2 lg:gap-4"
                >
                  {/* Left: icon avatar + name/subject */}
                  <div className="flex items-center gap-3 min-w-0 w-full lg:w-auto">
                    {/* Mail icon avatar — same as dashboard */}
                    <div className="relative shrink-0">
                      <div className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center border transition-colors',
                        !msg.read
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                          : msg.status
                            ? 'border'
                            : 'bg-muted text-muted-foreground border-border/40'
                      )}
                        style={msg.status && msg.read ? {
                          backgroundColor: `${msg.status.color}15`,
                          color: msg.status.color,
                          borderColor: `${msg.status.color}30`,
                        } : undefined}
                      >
                        <Mail className="h-4 w-4" />
                      </div>
                      {!msg.read && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-background ring-1 ring-amber-500/20 animate-pulse" />
                      )}
                    </div>

                    {/* Name + subject + badges */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <p className={cn(
                          'text-sm truncate group-hover:text-primary transition-colors min-w-0',
                          !msg.read ? 'font-bold text-foreground' : 'font-semibold text-foreground/90'
                        )}>
                          {msg.name}
                        </p>

                        {/* Status badge — only SVG with distinct colors */}
                        {msg.status ? (
                          <div
                            title={msg.status.name}
                            className="inline-flex items-center justify-center p-1.5 rounded-xl border shrink-0 select-none shadow-sm transition-all"
                            style={{
                              backgroundColor: `${msg.status.color}10`,
                              color: msg.status.color,
                              borderColor: `${msg.status.color}25`,
                            }}
                          >
                            <Tag size={12} strokeWidth={2.5} />
                          </div>
                        ) : (
                          <div 
                            title="Awaiting Status"
                            className="inline-flex items-center justify-center p-1.5 rounded-xl border shrink-0 select-none shadow-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25 animate-pulse"
                          >
                            <Clock size={12} strokeWidth={2.5} />
                          </div>
                        )}

                        {/* Channel icons */}
                        {renderChannelIcons(msg.sentChannels)}
                      </div>

                      {/* Subject */}
                      <p className="text-xs text-muted-foreground truncate font-semibold mt-0.5 max-w-full lg:max-w-[450px]">
                        {msg.subject}
                      </p>
                    </div>
                  </div>

                  {/* Right: date + delete + chevron */}
                  <div className="flex flex-row items-center justify-between lg:justify-end gap-1.5 shrink-0 pl-0 lg:pl-3 w-full lg:w-auto border-t border-border/10 pt-2.5 lg:border-0 lg:pt-0">
                    <span className="text-[11px] text-muted-foreground font-bold">
                      {new Date(msg.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Delete — only visible on hover (on desktop) */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteMessage(msg.id); }}
                        className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-danger hover:bg-danger/10 transition-all border border-transparent hover:border-danger/25"
                        title="Delete"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>

                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors hidden lg:block" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="p-4 border-t border-border/30 mt-auto bg-background/5 rounded-b-2xl">
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={setCurrentPage} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      {dialogAdapter && (
        <ContactDetailDialog
          isOpen={!!selectedMessage}
          onClose={() => setSelectedMessage(null)}
          message={dialogAdapter}
          onUpdate={handleDialogUpdate}
        />
      )}

      <ConfirmDeleteDialog
        isOpen={!!deleteMessage}
        onOpenChange={(open) => !open && setDeleteMessage(null)}
        onConfirm={() => {
          if (deleteMessage) handleDelete(deleteMessage);
        }}
        title={t('notifications.deleteMessageTitle', 'Delete Message')}
        description={t('notifications.deleteMessageDesc', 'Are you sure you want to permanently delete this message?')}
      />

      <ConfirmDeleteDialog
        isOpen={!!deleteStatus}
        onOpenChange={(open) => !open && setDeleteStatus(null)}
        onConfirm={() => {
          if (deleteStatus) handleDeleteStatus(deleteStatus);
        }}
        title={t('notifications.deleteStatusTitle', 'Delete Status')}
        description={t('notifications.deleteStatusDesc', 'Are you sure you want to permanently delete this status? Messages with this status will be reset.')}
      />
    </div>
  );
};
