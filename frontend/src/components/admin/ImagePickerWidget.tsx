import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { galleryApi } from '@/features/gallery/api';
import type { GalleryImage } from '@/features/gallery/types';
import { Image as ImageIcon, Upload, Loader2, Search, Check, Link, X, Folder, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfig } from '@/lib/config/useConfig';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/context/ToastContext';
import { galleryErrorMessage } from '@/features/gallery/errors';
 
interface ImagePickerWidgetProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  folder?: string;
}
 
export const ImagePickerWidget: React.FC<ImagePickerWidgetProps> = ({
  value,
  onChange,
  label,
  placeholder,
  folder,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const defaultPlaceholder = placeholder || t('admin.imagePicker.placeholder', 'Enter image URL or select from library');
  const config = useConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  
  // Tab control: 'gallery' | 'upload' | 'url'
  const [activeTab, setActiveTab] = useState<'gallery' | 'upload' | 'url'>('gallery');
  
  // Uploading state
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
 
  // Check if S3 Gallery is actually configured
  const isS3Enabled = config.gallery_enabled === 'true';
 
  const fetchImages = async () => {
    if (!isS3Enabled) return;
    try {
      setLoading(true);
      const data = await galleryApi.fetchImages();
      setImages(data);
      setError('');
    } catch (err: any) {
      if (err.response?.status === 403) {
      } else {
        setError(t('admin.imagePicker.errorFetch', 'Failed to fetch image assets.'));
      }
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    if (isOpen) {
      fetchImages();
      // Reset tab based on S3 state
      setActiveTab(isS3Enabled ? 'gallery' : 'url');
      setCurrentFolder(null); // Reset folder when opening
    }
  }, [isOpen]);
 
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
 
    try {
      setUploading(true);
      const data = await galleryApi.uploadImage(file, folder);
      // Add new image to list
      setImages([data, ...images]);
      // Select newly uploaded S3 image URL
      onChange(data.url);
      setIsOpen(false);
    } catch (err) {
      toast({ type: 'error', message: galleryErrorMessage(err, t, 'upload') });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
 
  const handleSelectImage = (url: string) => {
    onChange(url);
    setIsOpen(false);
  };
 
  const filteredImages = images.filter((img) =>
    img.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );
 
  const getDisplayValue = (url: string) => {
    if (!url) return '';
    const isAwsUrl = url.includes('amazonaws.com') || url.includes('s3.');
    if (isAwsUrl) {
      try {
        const decoded = decodeURIComponent(url);
        const parts = decoded.split('/');
        return parts[parts.length - 1];
      } catch {
        return url;
      }
    }
    return url;
  };
 
  const isAwsUrl = value.includes('amazonaws.com') || value.includes('s3.');
  const displayValue = getDisplayValue(value);
 
  return (
    <div className="space-y-1.5 w-full">
      {label && <span className="text-xs text-muted-foreground font-semibold">{label}</span>}
      
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Preview block */}
        <div className="relative w-20 h-20 rounded-xl bg-card border border-border/60 overflow-hidden shrink-0 flex items-center justify-center shadow-inner group bg-gradient-to-br from-card to-muted/20">
          {value ? (
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          )}
          {value && (
            <button
              onClick={() => onChange('')}
              className="absolute top-1 right-1 p-1 bg-background/80 hover:bg-destructive hover:text-destructive-foreground rounded-full text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              title={t('admin.imagePicker.clearImage', 'Clear Image')}
              type="button"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
 
        {/* Input & Button bar */}
        <div className="flex-1 flex flex-col gap-2 justify-center">
          <div className="flex gap-2">
            <Input
              type="text"
              value={displayValue}
              readOnly={isAwsUrl}
              onChange={(e) => !isAwsUrl && onChange(e.target.value)}
              placeholder={defaultPlaceholder}
              className={cn(
                "flex-1 bg-background rounded-xl text-xs h-10",
                isAwsUrl && "bg-muted/45 text-muted-foreground cursor-not-allowed select-all"
              )}
            />
            <Button
              type="button"
              onClick={() => setIsOpen(true)}
              className="rounded-xl h-10 px-4 font-bold text-xs shrink-0 shadow-md shadow-primary/5 hover:shadow-primary/10 transition-all gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              {t('admin.imagePicker.upload', 'Upload')}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
            {isAwsUrl 
              ? t('admin.imagePicker.awsUrlActive', 'Image from library is active. Click the clear (X) icon on the preview to reset or select another.')
              : t('admin.imagePicker.specifyUrl', 'Specify a custom URL or click the button to select/upload assets.')}
          </p>
        </div>
      </div>
 
      {/* Selector modal (No Animations) */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[700px] w-[calc(100%-2rem)] max-h-[85vh] !flex !flex-col !gap-0 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-0 overflow-hidden z-[70] animate-in zoom-in-95 duration-200">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 space-y-1.5 shrink-0 bg-gradient-to-br from-card to-primary/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-sm shrink-0">
                <ImageIcon size={15} strokeWidth={2.5} />
              </div>
              <DialogTitle className="text-base font-black leading-tight text-foreground">
                {t('admin.imagePicker.selectImage', 'Select Image Asset')}
              </DialogTitle>
            </div>
          </DialogHeader>
 
          <div className="flex-1 overflow-y-auto p-6 min-h-[300px] max-h-[50vh] bg-card/20">
            {/* Custom Tabs */}
            <div className="flex border-b border-border/40 bg-muted/10 p-1 rounded-xl mb-4 shrink-0 gap-1">
              {isS3Enabled && (
                <button
                  type="button"
                  onClick={() => setActiveTab('gallery')}
                  className={cn(
                    'flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
                    activeTab === 'gallery'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/20'
                  )}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  {t('admin.imagePicker.library', 'Library')}
                </button>
              )}
              {isS3Enabled && (
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={cn(
                    'flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
                    activeTab === 'upload'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/20'
                  )}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {t('admin.imagePicker.directUpload', 'Direct Upload')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('url')}
                className={cn(
                  'flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
                  activeTab === 'url'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/20'
                  )}
              >
                <Link className="w-3.5 h-3.5" />
                {t('admin.imagePicker.customUrl', 'Custom URL')}
              </button>
            </div>
            
            {/* Tab contents (fixed heights, scrollable inside modal) */}
            
            {/* TAB A: S3 LIBRARY GALLERY */}
            {activeTab === 'gallery' && isS3Enabled && (
              <div className="space-y-4">
                {/* Search & Back navigation */}
                <div className="flex gap-2 items-center shrink-0">
                  {currentFolder && !searchTerm && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentFolder(null)}
                      className="h-9 rounded-xl px-3 text-xs font-bold gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </Button>
                  )}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      type="text"
                      placeholder={t('admin.imagePicker.searchPlaceholder', "Search assets by name...")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 bg-muted/20 border-border/60 rounded-xl text-xs h-9"
                    />
                  </div>
                </div>
 
                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                      <Skeleton key={i} className="aspect-square rounded-xl bg-muted/40 w-full" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="text-center py-12 border border-dashed border-border/60 rounded-2xl bg-muted/5">
                    <p className="text-xs text-destructive font-medium">{error}</p>
                  </div>
                ) : (
                  <>
                    {/* Render search results if searching */}
                    {searchTerm ? (
                      filteredImages.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-border/60 rounded-2xl bg-muted/5">
                          <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                          <p className="text-xs text-muted-foreground font-semibold">{t('admin.imagePicker.noAssets', 'No assets found')}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                          {filteredImages.map((img) => {
                            const isSelected = value === img.url;
                            return (
                              <div
                                key={img.id}
                                onClick={() => handleSelectImage(img.url)}
                                className={cn(
                                  'group relative aspect-square rounded-xl overflow-hidden border border-border/50 bg-muted/10 cursor-pointer shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 transition-all duration-200',
                                  isSelected && 'ring-2 ring-primary ring-offset-2 border-primary/50'
                                )}
                                title={img.filename}
                              >
                                <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                                {isSelected && (
                                  <div className="absolute top-2 right-2 p-1 bg-primary text-primary-foreground rounded-full shadow-md z-10">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-2 pt-6 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200 opacity-0 group-hover:opacity-100">
                                  <p className="text-[11px] font-bold text-white truncate leading-none">{img.filename}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      /* Render folder structure */
                      (() => {
                        const folders = Array.from(new Set(images.map(img => img.folder).filter(Boolean))) as string[];
                        
                        if (currentFolder === null) {
                          // Root level: show folders and root images
                          const rootImages = images.filter(img => !img.folder);
                          
                          if (folders.length === 0 && rootImages.length === 0) {
                            return (
                              <div className="text-center py-12 border border-dashed border-border/60 rounded-2xl bg-muted/5">
                                <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                                <p className="text-xs text-muted-foreground font-semibold">{t('admin.imagePicker.noAssets', 'No assets found')}</p>
                              </div>
                            );
                          }
                          
                          return (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-in fade-in duration-200">
                              {/* Folders */}
                              {folders.map(fName => {
                                const count = images.filter(img => img.folder === fName).length;
                                return (
                                  <div
                                    key={fName}
                                    onClick={() => setCurrentFolder(fName)}
                                    className="flex flex-col items-center justify-center aspect-square rounded-xl border border-border/50 bg-muted/5 hover:bg-muted/10 hover:border-primary/40 cursor-pointer transition-all duration-200 p-4 text-center group"
                                  >
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-sm group-hover:scale-110 transition-transform">
                                      <Folder className="w-6 h-6" />
                                    </div>
                                    <span className="text-xs font-bold text-foreground truncate w-full mt-3" title={fName}>
                                      {fName}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground mt-0.5">
                                      {count} {count === 1 ? 'image' : 'images'}
                                    </span>
                                  </div>
                                );
                              })}
                              
                              {/* Root Images */}
                              {rootImages.map(img => {
                                const isSelected = value === img.url;
                                return (
                                  <div
                                    key={img.id}
                                    onClick={() => handleSelectImage(img.url)}
                                    className={cn(
                                      'group relative aspect-square rounded-xl overflow-hidden border border-border/50 bg-muted/10 cursor-pointer shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 transition-all duration-200',
                                      isSelected && 'ring-2 ring-primary ring-offset-2 border-primary/50'
                                    )}
                                    title={img.filename}
                                  >
                                    <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                                    {isSelected && (
                                      <div className="absolute top-2 right-2 p-1 bg-primary text-primary-foreground rounded-full shadow-md z-10">
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-2 pt-6 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200 opacity-0 group-hover:opacity-100">
                                      <p className="text-[11px] font-bold text-white truncate leading-none">{img.filename}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        } else {
                          // Inside a folder: show folder images
                          const folderImages = images.filter(img => img.folder === currentFolder);
                          
                          return (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-in fade-in duration-200">
                              {folderImages.map(img => {
                                const isSelected = value === img.url;
                                return (
                                  <div
                                    key={img.id}
                                    onClick={() => handleSelectImage(img.url)}
                                    className={cn(
                                      'group relative aspect-square rounded-xl overflow-hidden border border-border/50 bg-muted/10 cursor-pointer shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 transition-all duration-200',
                                      isSelected && 'ring-2 ring-primary ring-offset-2 border-primary/50'
                                    )}
                                    title={img.filename}
                                  >
                                    <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                                    {isSelected && (
                                      <div className="absolute top-2 right-2 p-1 bg-primary text-primary-foreground rounded-full shadow-md z-10">
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-2 pt-6 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200 opacity-0 group-hover:opacity-100">
                                      <p className="text-[11px] font-bold text-white truncate leading-none">{img.filename}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                      })()
                    )}
                  </>
                )}
              </div>
            )}

            {/* TAB B: DIRECT UPLOAD */}
            {activeTab === 'upload' && isS3Enabled && (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
                
                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={cn(
                    'w-full max-w-md aspect-video border-2 border-dashed border-border/60 hover:border-primary/40 bg-muted/5 rounded-2xl flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-muted/10 transition-all duration-300',
                    uploading && 'pointer-events-none opacity-60'
                  )}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-xs font-bold text-foreground">{t('admin.imagePicker.uploading', 'Uploading image...')}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{t('admin.imagePicker.clickToSelect', 'Click to select files')}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{t('admin.imagePicker.supports', 'Supports PNG, JPG, GIF up to 5MB.')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB C: CUSTOM MANUAL URL */}
            {(activeTab === 'url' || !isS3Enabled) && (
              <div className="space-y-6 max-w-md mx-auto py-4">
                <div className="space-y-2 border border-border/50 bg-card/45 backdrop-blur-sm p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Link className="w-4 h-4 text-primary" />
                    <h4 className="text-xs font-bold text-foreground">{t('admin.imagePicker.provideDirectUrl', 'Provide Direct URL')}</h4>
                  </div>
                  <Input
                    type="text"
                    placeholder="https://example.com/branding-asset.png"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="bg-background rounded-xl text-xs h-10"
                  />
                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="rounded-xl h-9 px-4 text-xs font-bold"
                    >
                      {t('admin.imagePicker.savePath', 'Save Path')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </div>
          
          <div className="!mx-0 !mb-0 !flex !flex-row !items-center !justify-end border-t border-border/40 !p-4 !px-6 bg-muted/20 shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="h-9 rounded-xl font-bold text-xs hover:bg-muted border border-transparent hover:border-border/30 px-4"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};
