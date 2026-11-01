import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfig } from '../../lib/config/useConfig';
import { notificationService } from '@/features/notifications/services/notificationService';
import type { ContactMessageStatus } from '@/features/notifications/types';
import { 
  Mail, 
  Calendar, 
  User, 
  Shield, 
  ArrowRight, 
  X, 
  Palette, 
  Plus, 
  Trash2,
  AlertCircle,
  Info,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface UnifiedMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  ipAddress?: string | null;
  sentChannels?: string;
  type?: string;
  statusId?: string | null;
  statusName?: string | null;
  statusColor?: string | null;
  replyMessage?: string | null;
}

interface ContactDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  message: UnifiedMessage;
  onUpdate: () => void;
}

const PRESET_COLORS = [
  '#ef4444', // Red / Destructive
  '#f59e0b', // Amber / Warning
  '#3b82f6', // Blue / Info
  '#10b981', // Emerald / Success
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#6b7280'  // Gray
];

export const ContactDetailDialog: React.FC<ContactDetailDialogProps> = ({ isOpen, onClose, message, onUpdate }) => {
  const { t } = useTranslation();
  const config = useConfig();
  const isEmailEnabled = config.email_enabled === 'true';
  const isContactType = (message.type || 'CONTACT').toUpperCase() === 'CONTACT';

  // Available statuses list
  const [statuses, setStatuses] = useState<ContactMessageStatus[]>([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Status Creation States
  const [newStatusName, setNewStatusName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[2]);
  const [creatingStatus, setCreatingStatus] = useState(false);

  // SMTP Reply States
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Fetch available statuses
  const fetchStatuses = async () => {
    try {
      const res = await notificationService.getStatuses();
      setStatuses(res.data);
    } catch (err) {
      console.error('Failed to load contact message statuses', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatuses();
      setReplyText('');
      setReplySuccess(false);
      setReplyError(null);
      setNewStatusName('');
      setShowStatusDropdown(false);
    }
  }, [isOpen, message.id]);

  // Assign a status to the inquiry
  const handleAssignStatus = async (statusId: string | null) => {
    try {
      await notificationService.updateStatus(message.id, statusId);
      setShowStatusDropdown(false);
      onUpdate();
    } catch (err) {
      console.error('Failed to assign status to message', err);
    }
  };

  // Create a new status and assign it
  const handleCreateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusName.trim()) return;
    setCreatingStatus(true);
    try {
      const res = await notificationService.createStatus(newStatusName.trim(), selectedColor);
      setNewStatusName('');
      // Refresh statuses list
      await fetchStatuses();
      // Auto assign the newly created status
      await handleAssignStatus(res.data.id);
    } catch (err) {
      console.error('Failed to create status', err);
    } finally {
      setCreatingStatus(false);
    }
  };

  // Delete status
  const handleDeleteStatus = async (statusId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t('admin.contactDetail.confirmDeleteStatus', 'Are you sure you want to delete this status? Messages with this status will be reset.'))) return;
    try {
      await notificationService.deleteStatus(statusId);
      await fetchStatuses();
      // If the deleted status was the active one, trigger update
      if (message.statusId === statusId) {
        onUpdate();
      }
    } catch (err) {
      console.error('Failed to delete status', err);
    }
  };

  // Submit SMTP email response
  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    setReplyError(null);
    try {
      await notificationService.replyToMessage(message.id, replyText.trim());
      setReplySuccess(true);
      setReplyText('');
      onUpdate();
      // Auto dismiss modal after short delay
      setTimeout(onClose, 1500);
    } catch (err: any) {
      console.error('SMTP reply error', err);
      setReplyError(err.response?.data?.message || t('admin.contactDetail.replyError', 'Failed to dispatch email. Please check server SMTP configuration.'));
    } finally {
      setSendingReply(false);
    }
  };

  // Helper to render type badge
  const renderTypeBadge = (typeStr?: string) => {
    const type = (typeStr || 'CONTACT').toUpperCase();
    if (type === 'CONTACT') {
      return (
        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/25 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
          {t('admin.contactDetail.contact', 'Contact')}
        </Badge>
      );
    }
    if (type === 'ORDER') {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
          {t('admin.contactDetail.order', 'Order')}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
        {type}
      </Badge>
    );
  };

  // Helper to render channels
  const renderChannelBadges = (channelsStr?: string) => {
    if (!channelsStr || channelsStr.trim() === '') {
      return (
        <Badge variant="outline" className="bg-muted/40 text-muted-foreground border-border px-2 py-0.5 text-[11px] font-semibold">
          {t('admin.contactDetail.none', 'None')}
        </Badge>
      );
    }
    const channels = channelsStr.split(',').map((s) => s.trim().toUpperCase());
    return (
      <div className="flex flex-wrap gap-1 mt-0.5">
        {channels.map((ch) => (
          <Badge key={ch} variant="outline" className="bg-primary/5 text-foreground/80 border-border px-2 py-0.5 text-[11px] font-bold">
            {ch}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[620px] w-[calc(100%-2rem)] !flex !flex-col max-h-[92vh] !gap-0 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-0 overflow-hidden z-[70] animate-in zoom-in-95 duration-200">
        
        <DialogHeader className="p-6 pb-4 border-b border-border/40 space-y-2.5 shrink-0 bg-gradient-to-br from-card to-primary/[0.02]">
          <div className="flex items-center gap-2.5 pr-8">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-sm shrink-0">
              <MessageSquare size={15} strokeWidth={2.5} />
            </div>
            <DialogTitle className="text-lg font-black leading-tight text-foreground truncate">
              {message.subject}
            </DialogTitle>
          </div>
          
          <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
            <div className="flex items-center gap-2">
              {/* Dynamic Creator Status Badge */}
              {message.statusName ? (
                <span 
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-sm"
                  style={{ 
                    backgroundColor: message.statusColor ? `${message.statusColor}15` : undefined, 
                    color: message.statusColor || undefined,
                    borderColor: message.statusColor ? `${message.statusColor}35` : undefined
                  }}
                >
                  {message.statusName}
                </span>
              ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25 px-2.5 py-0.5 rounded-full font-bold text-[11px] uppercase tracking-wider animate-pulse">
                  {t('admin.contactDetail.awaitingStatus', 'Awaiting Status')}
                </Badge>
              )}
              {renderTypeBadge(message.type)}
            </div>
            
            {message.ipAddress && (
              <span className="text-[11px] bg-muted/60 border text-muted-foreground px-2 py-0.5 rounded-md flex items-center gap-1 select-none font-semibold">
                <Shield size={10} />
                IP: {message.ipAddress}
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Center Body Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-border/40 pb-4 text-xs font-semibold">
            <div className="space-y-0.5">
              <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider block">{t('admin.contactDetail.from', 'From')}</span>
              <span className="text-foreground flex items-center gap-1.5 font-bold">
                <User size={13} className="text-primary/70" />
                {message.name}
              </span>
            </div>
            
            <div className="space-y-0.5">
              <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider block">{t('admin.contactDetail.dateReceived', 'Date Received')}</span>
              <span className="text-foreground flex items-center gap-1.5 font-bold">
                <Calendar size={13} className="text-primary/70" />
                {new Date(message.createdAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
            
            <div className="sm:col-span-2 space-y-0.5">
              <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider block">{t('admin.contactDetail.email', 'Email Address')}</span>
              <a
                href={`mailto:${message.email}`}
                className="text-primary hover:underline flex items-center gap-1.5 font-bold break-all flex-wrap"
              >
                <Mail size={13} />
                {message.email}
              </a>
            </div>

            <div className="sm:col-span-2 space-y-0.5 pt-2 border-t border-border/30">
              <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider block">{t('admin.contactDetail.deliveryChannels', 'Delivery Routing Channels')}</span>
              {renderChannelBadges(message.sentChannels)}
            </div>
          </div>

          {/* Core Inquiry Message */}
          <div className="space-y-1">
            <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">{t('admin.contactDetail.inquiryBody', 'Inquiry Body')}</span>
            <p className="text-sm font-semibold text-foreground bg-muted/40 p-4 rounded-xl border border-border/30 whitespace-pre-wrap leading-relaxed select-text">
              {message.message}
            </p>
          </div>

          {/* Advanced Status Management Dropdown */}
          <div className="pt-4 border-t border-border/40 space-y-2 relative">
            <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider block">{t('admin.contactDetail.manageStatus', 'Manage Status')}</span>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Button
                  variant="outline"
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="w-full justify-between rounded-xl h-9 border-border/60 text-xs font-bold px-3 shadow-sm bg-background/50 hover:bg-muted"
                >
                  <span className="flex items-center gap-2">
                    {message.statusName ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: message.statusColor || '#ccc' }} />
                        <span>{t('admin.contactDetail.status', 'Status')}: <strong>{message.statusName}</strong></span>
                      </>
                    ) : (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Status: <strong className="text-amber-700 dark:text-amber-400">Awaiting Status</strong></span>
                      </>
                    )}
                  </span>
                  <Palette size={14} className="text-muted-foreground" />
                </Button>

                {/* Dropdown Overlay card */}
                {showStatusDropdown && (
                  <div className="absolute left-0 right-0 bottom-full mb-2 z-[80] bg-card border border-border rounded-2xl shadow-2xl p-4 space-y-4 max-h-[300px] overflow-y-auto animate-in slide-in-from-bottom-3 duration-250">
                    <div className="flex justify-between items-center text-[11px] font-black text-muted-foreground uppercase pb-1.5 border-b border-border/40">
                      <span>{t('admin.contactDetail.availableStatuses', 'Available Statuses')}</span>
                      <Button variant="ghost" size="icon-xs" onClick={() => setShowStatusDropdown(false)} className="h-5 w-5 rounded-full">
                        <X size={12} />
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      {/* Option to clear status */}
                      <button
                        onClick={() => handleAssignStatus(null)}
                        className="w-full flex items-center justify-between text-left text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-amber-700 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20"
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          {t('admin.contactDetail.clearStatus', 'Awaiting Status (Clear)')}
                        </span>
                        {message.statusId === null && '✓'}
                      </button>

                      {statuses.map((st) => (
                        <div
                          key={st.id}
                          onClick={() => handleAssignStatus(st.id)}
                          className="w-full flex items-center justify-between text-left text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer border border-border/30 hover:border-border/60"
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                            <span style={{ color: st.color }}>{st.name}</span>
                          </span>
                          <div className="flex items-center gap-1">
                            {message.statusId === st.id && <span className="text-[11px] text-muted-foreground font-black mr-1">✓</span>}
                            <button
                              onClick={(e) => handleDeleteStatus(st.id, e)}
                              className="text-muted-foreground hover:text-danger p-0.5 rounded transition-colors shrink-0"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Status creation mini subform */}
                    <form onSubmit={handleCreateStatus} className="pt-3 border-t border-border/40 space-y-2">
                      <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider block">{t('admin.contactDetail.createStatus', 'Create status')}</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newStatusName}
                          onChange={(e) => setNewStatusName(e.target.value)}
                          placeholder={t('admin.contactDetail.placeholderNewStatus', "e.g. In Progress")}
                          className="flex-1 text-xs px-2.5 h-8 rounded-lg bg-muted border border-border/80 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="submit"
                          disabled={creatingStatus || !newStatusName.trim()}
                          className="h-8 w-8 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/95 disabled:opacity-50 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      {/* Color Picker presets */}
                      <div className="flex items-center justify-between gap-1 pt-1.5">
                        <div className="flex gap-1.5">
                          {PRESET_COLORS.map((col) => (
                            <button
                              key={col}
                              type="button"
                              onClick={() => setSelectedColor(col)}
                              className={cn(
                                'w-4 h-4 rounded-full border transition-all scale-100 hover:scale-110 shrink-0',
                                selectedColor === col ? 'ring-2 ring-primary border-background' : 'border-transparent'
                              )}
                              style={{ backgroundColor: col }}
                            />
                          ))}
                        </div>
                        {/* Native color picker */}
                        <div className="relative w-5 h-5 rounded-full overflow-hidden border border-border shrink-0">
                          <input 
                            type="color" 
                            value={selectedColor} 
                            onChange={(e) => setSelectedColor(e.target.value)} 
                            className="absolute -inset-1 cursor-pointer w-7 h-7"
                          />
                        </div>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Email Reply Section */}
          {isContactType && (
            <div className="pt-4 border-t border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {t('admin.contactDetail.replyMessage', 'Reply message')}
                </span>
                {isEmailEnabled && !message.replyMessage && (
                  <Badge variant="outline" className="text-[10px] py-0 px-2 font-bold tracking-wide uppercase border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400">
                    {t('admin.contactDetail.smtpEnabled', 'SMTP Enabled')}
                  </Badge>
                )}
                {!isEmailEnabled && !message.replyMessage && (
                  <Badge variant="outline" className="text-[10px] py-0 px-2 font-bold tracking-wide uppercase border-warning/20 bg-warning/5 text-warning">
                    {t('admin.contactDetail.smtpDisabledTitle', 'SMTP Disabled')}
                  </Badge>
                )}
              </div>

              {message.replyMessage ? (
                <div className="space-y-3 animate-in fade-in duration-200">
                  {/* Alert box informing reply already exists */}
                  <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs font-semibold leading-relaxed text-foreground flex flex-col gap-2">
                    <span className="flex items-center gap-1.5 text-primary font-bold text-[13px]">
                      <Info size={15} /> {t('admin.contactDetail.conversationTransferred', 'Conversation Transferred')}
                    </span>
                    <p className="text-muted-foreground">
                      {t('admin.contactDetail.replyAlreadySent', 'A reply has already been sent for this inquiry. To prevent multiple SMTP duplicates, no further messages can be dispatched from this screen.')}
                    </p>
                    <p className="font-bold text-foreground bg-primary/10 p-2.5 rounded-lg border border-primary/15">
                      {t('admin.contactDetail.goToEmail', '👉 Please go to your sent email message thread to continue the conversation with the contacter')} ({message.email}).
                    </p>
                  </div>
                  {/* Stored admin reply body */}
                  <div className="space-y-1">
                    <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider block">{t('admin.contactDetail.sentReplyBody', 'Sent Reply Body')}</span>
                    <p className="text-xs font-semibold text-muted-foreground bg-muted p-3.5 rounded-xl border border-border/30 whitespace-pre-wrap leading-relaxed">
                      {message.replyMessage}
                    </p>
                  </div>
                </div>
              ) : isEmailEnabled ? (
                <div className="space-y-2">
                  {replySuccess ? (
                    <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold animate-in fade-in duration-200">
                      {t('admin.contactDetail.replySuccess', '✓ Email reply sent successfully and inquiry marked as read!')}
                    </div>
                  ) : (
                    <>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={t('admin.contactDetail.typeResponse', "Type your email response here...")}
                        disabled={sendingReply}
                        className="w-full h-24 p-3 text-xs rounded-xl bg-muted/60 border border-border/60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 resize-none font-medium text-foreground placeholder:text-muted-foreground/60 animate-in fade-in"
                      />
                      {replyError && (
                        <div className="text-[11px] font-bold text-danger flex items-center gap-1 animate-in fade-in">
                          <AlertCircle size={12} /> {replyError}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold leading-relaxed">
                  {t('admin.contactDetail.smtpDisabledDesc', "SMTP email configuration is currently disabled. You can still send a response using your device's native mail client via the action button below.")}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer with Actions */}
        {isContactType && !message.replyMessage && (
          <div className="!mx-0 !mb-0 !flex !flex-row !items-center !justify-end border-t border-border/40 !p-4 !px-6 bg-muted/20 shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-9 rounded-xl font-bold text-xs hover:bg-muted border border-transparent hover:border-border/30 px-4"
            >
              Cancel
            </Button>
            {isEmailEnabled ? (
              <Button 
                size="sm" 
                onClick={handleSendReply}
                disabled={sendingReply || replySuccess || !replyText.trim()}
                className="rounded-xl font-bold h-9 shadow-sm gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 px-4"
              >
                {sendingReply ? t('admin.contactDetail.sendingReply', 'Sending reply...') : t('admin.contactDetail.sendSmtpReply', 'Send SMTP Reply')} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button 
                size="sm" 
                className="rounded-xl font-bold h-9 shadow-sm gap-1.5 transition-all active:scale-95 px-4"
                onClick={() => {
                  window.location.href = `mailto:${message.email}?subject=RE: ${encodeURIComponent(message.subject)}`;
                }}
              >
                {t('admin.contactDetail.replyViaEmailClient', 'Reply via Email Client')} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
