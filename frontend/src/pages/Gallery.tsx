import React, { useState, useEffect, useRef } from 'react';
import { useGallery } from '../features/gallery/hooks/useGallery';
import type { GalleryImage } from '../features/gallery/types';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Trash2, Edit3, Image as ImageIcon, Loader2, X, Upload, Folder, ChevronLeft } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/context/ToastContext';
import { galleryErrorMessage } from '@/features/gallery/errors';

export const Gallery: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { 
    images, loading, error, uploading, 
    fetchImages, uploadImage, deleteImage, renameImage 
  } = useGallery();
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) fetchImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox Pop-up state
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  // Edit/Rename state
  const [editImage, setEditImage] = useState<GalleryImage | null>(null);
  const [newFilename, setNewFilename] = useState('');

  // Delete state
  const [imageToDelete, setImageToDelete] = useState<GalleryImage | null>(null);



  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadImage(file, currentFolder || undefined);
    } catch (err) {
      toast({ type: 'error', message: galleryErrorMessage(err, t, 'upload') });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (img: GalleryImage) => {
    try {
      await deleteImage(img.id);
      if (selectedImage?.id === img.id) {
        setSelectedImage(null);
      }
      setImageToDelete(null);
    } catch (err) {
      toast({ type: 'error', message: galleryErrorMessage(err, t, 'delete') });
    }
  };



  const handleRenameSubmit = async () => {
    if (!editImage || !newFilename.trim()) return;
    try {
      const updated = await renameImage(editImage.id, newFilename.trim());
      if (selectedImage && selectedImage.id === editImage.id) {
        setSelectedImage(updated);
      }
      setEditImage(null);
    } catch (err) {
      toast({ type: 'error', message: galleryErrorMessage(err, t, 'rename') });
    }
  };

  if (error) {
    return (
      <div className="container mx-auto py-20 px-4 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
          <ImageIcon className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{error}</h1>
        <p className="text-muted-foreground">{t('gallery.errorCheckConfig', 'Please check your configuration settings.')}</p>
      </div>
    );
  }

  const filteredImages = images;

  return (
    <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-7xl">

      {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/65 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-border/50 shadow-sm bg-gradient-to-br from-card to-primary/[0.01] mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {currentFolder ? `${t('gallery.titleAdmin', 'Image Gallery')} / ${currentFolder}` : t('gallery.titleAdmin', 'Image Gallery')}
            </h1>
            <p className="text-muted-foreground text-sm font-medium mt-1 leading-relaxed max-w-2xl">
              {t('gallery.descriptionAdmin', 'Manage your digital assets. Upload, rename, and control visibility. Currently tracking')} <span className="font-bold text-primary">{images.length} {t('gallery.totalImages', 'total images')}</span>.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {currentFolder && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentFolder(null)}
                className="rounded-xl h-10 px-4 font-bold text-xs gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                {t('gallery.backToRoot', 'Back to Root')}
              </Button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            <Button
              onClick={handleUploadClick}
              disabled={uploading}
              className="rounded-xl h-10 px-5 shadow-md shadow-primary/10 hover:shadow-primary/20 transition-all font-bold gap-2 text-primary-foreground"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {t('gallery.upload', 'Upload')}
            </Button>
          </div>
        </div>


      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl w-full bg-muted/50" />
          ))}
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="text-center py-20 bg-muted/10 rounded-3xl border border-dashed border-border/50">
          <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold text-foreground">{t('gallery.noImagesFound', 'No images found')}</h2>
          <p className="text-muted-foreground mt-2">
            {isAuthenticated
              ? t('gallery.uploadPrompt', "Upload some images to get started.")
              : t('gallery.emptyPublicGallery', "The gallery is currently empty.")}
          </p>
        </div>
      ) : (
        (() => {
          const folders = Array.from(new Set(images.map(img => img.folder).filter(Boolean))) as string[];
          
          if (currentFolder === null) {
            // Root level: show folders and root images
            const rootImages = images.filter(img => !img.folder);
            
            if (folders.length === 0 && rootImages.length === 0) {
              return (
                <div className="text-center py-20 bg-muted/10 rounded-3xl border border-dashed border-border/50">
                  <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-xl font-bold text-foreground">{t('gallery.noImagesFound', 'No images found')}</h2>
                  <p className="text-muted-foreground mt-2">
                    {isAuthenticated
                      ? t('gallery.uploadPrompt', "Upload some images to get started.")
                      : t('gallery.emptyPublicGallery', "The gallery is currently empty.")}
                  </p>
                </div>
              );
            }
            
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {/* Folders */}
                {folders.map(fName => {
                  const count = images.filter(img => img.folder === fName).length;
                  return (
                    <button
                      key={fName}
                      type="button"
                      onClick={() => setCurrentFolder(fName)}
                      className="flex flex-col items-center justify-center aspect-square rounded-3xl border border-border/45 bg-card/40 hover:bg-card/65 hover:border-primary/30 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 p-6 text-center group"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-info/10 text-info flex items-center justify-center border border-info/20 shadow-sm group-hover:scale-110 transition-transform">
                        <Folder className="w-8 h-8" />
                      </div>
                      <span className="text-sm font-bold text-foreground truncate w-full mt-4" title={fName}>
                        {fName}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1 font-medium">
                        {t('gallery.imageCount', '{{count}} images', { count })}
                      </span>
                    </button>
                  );
                })}
                
                {/* Root Images */}
                {rootImages.map((img) => (
                  <div
                    key={img.id}
                    className="group relative flex flex-col bg-card/40 backdrop-blur-sm border border-border/40 rounded-3xl overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                  >
                    <div
                      className="relative aspect-square overflow-hidden bg-muted/20 group/img"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedImage(img)}
                        aria-label={t('landing.gallery.openImage', 'Open image {{name}}', { name: img.filename })}
                        className="block w-full h-full cursor-zoom-in"
                      >
                      <img
                        src={img.url}
                        alt={img.filename}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105"
                        loading="lazy"
                      />
                      <span className="absolute inset-0 bg-foreground/10 opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                        <span className="p-3 bg-background/80 backdrop-blur rounded-full text-foreground shadow-md transform scale-90 group-hover/img:scale-100 transition-all duration-300">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </span>
                      </span>
                      </button>
                      {isAuthenticated && (
                        <div className="absolute top-3 right-3 flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditImage(img); setNewFilename(img.filename); }}
                            className="h-8 w-8 rounded-xl bg-warning/10 text-warning hover:bg-warning hover:text-warning-foreground border border-warning/25 hover:border-warning/30 transition-all active:scale-95 flex items-center justify-center shadow-sm"
                            title={t('gallery.rename', 'Rename')}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setImageToDelete(img); }}
                            className="h-8 w-8 rounded-xl hover:bg-danger hover:text-danger-foreground transition-all active:scale-95 bg-danger/10 text-danger border border-danger/25 hover:border-danger/30 flex items-center justify-center shadow-sm"
                            title={t('gallery.delete', 'Delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex flex-col gap-1 border-t border-border/10 bg-gradient-to-b from-transparent to-card/50">
                      <h2 className="font-semibold text-sm truncate" title={img.filename}>
                        {img.filename}
                      </h2>
                    </div>
                  </div>
                ))}
              </div>
            );
          } else {
            // Inside a folder: show folder images
            const folderImages = images.filter(img => img.folder === currentFolder);
            
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {folderImages.map((img) => (
                  <div
                    key={img.id}
                    className="group relative flex flex-col bg-card/40 backdrop-blur-sm border border-border/40 rounded-3xl overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                  >
                    <div
                      className="relative aspect-square overflow-hidden bg-muted/20 group/img"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedImage(img)}
                        aria-label={t('landing.gallery.openImage', 'Open image {{name}}', { name: img.filename })}
                        className="block w-full h-full cursor-zoom-in"
                      >
                      <img
                        src={img.url}
                        alt={img.filename}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105"
                        loading="lazy"
                      />
                      <span className="absolute inset-0 bg-foreground/10 opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                        <span className="p-3 bg-background/80 backdrop-blur rounded-full text-foreground shadow-md transform scale-90 group-hover/img:scale-100 transition-all duration-300">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </span>
                      </span>
                      </button>
                      {isAuthenticated && (
                        <div className="absolute top-3 right-3 flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditImage(img); setNewFilename(img.filename); }}
                            className="h-8 w-8 rounded-xl bg-warning/10 text-warning hover:bg-warning hover:text-warning-foreground border border-warning/25 hover:border-warning/30 transition-all active:scale-95 flex items-center justify-center shadow-sm"
                            title={t('gallery.rename', 'Rename')}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setImageToDelete(img); }}
                            className="h-8 w-8 rounded-xl hover:bg-danger hover:text-danger-foreground transition-all active:scale-95 bg-danger/10 text-danger border border-danger/25 hover:border-danger/30 flex items-center justify-center shadow-sm"
                            title={t('gallery.delete', 'Delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex flex-col gap-1 border-t border-border/10 bg-gradient-to-b from-transparent to-card/50">
                      <h2 className="font-semibold text-sm truncate" title={img.filename}>
                        {img.filename}
                      </h2>
                    </div>
                  </div>
                ))}
              </div>
            );
          }
        })()
      )}

      {/* Rename Dialog */}
      <Dialog open={!!editImage} onOpenChange={(open) => !open && setEditImage(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('gallery.renameImage', 'Rename Image')}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filename">{t('gallery.filename', 'Filename')}</Label>
              <Input
                id="filename"
                value={newFilename}
                onChange={(e) => setNewFilename(e.target.value)}
                className="col-span-3 rounded-xl"
                onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setEditImage(null)}>{t('gallery.cancel', 'Cancel')}</Button>
            <Button onClick={handleRenameSubmit} className="rounded-xl font-bold bg-primary text-primary-foreground shadow-md hover:shadow-lg transition-all">{t('gallery.saveChanges', 'Save Changes')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox Pop-up (No animations) */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className={cn(
            "fixed inset-0 flex items-center justify-center bg-background/95 backdrop-blur-sm cursor-zoom-out",
            editImage ? "z-30" : "z-[100]"
          )}
        >
          {/* Close button */}
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 p-3 bg-card border border-border rounded-full hover:bg-muted text-foreground shadow-lg z-[110] transition-colors"
            title={t('landing.gallery.close', 'Close')}
            aria-label={t('landing.gallery.close', 'Close')}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Image Wrapper */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-[90vw] max-h-[90vh] bg-card border border-border/80 rounded-3xl p-3 shadow-2xl overflow-hidden flex flex-col"
          >
            <img
              src={selectedImage.url}
              alt={selectedImage.filename}
              className="max-w-full max-h-[65vh] object-contain rounded-2xl"
            />

            <div className="mt-4 px-2 flex flex-col gap-3 border-t border-border/10 pt-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm truncate max-w-[50vw]" title={selectedImage.filename}>
                  {selectedImage.filename}
                </h2>

              </div>

              {isAuthenticated && (
                <div className="flex items-center justify-between gap-4 border-t border-border/10 pt-3">


                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditImage(selectedImage);
                        setNewFilename(selectedImage.filename);
                      }}
                      className="h-8 px-3 rounded-xl bg-warning/10 text-warning hover:bg-warning hover:text-warning-foreground border border-warning/25 hover:border-warning/30 transition-all active:scale-95 text-xs font-bold gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {t('gallery.rename')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setImageToDelete(selectedImage)}
                      className="h-8 px-3 rounded-xl hover:bg-danger hover:text-danger-foreground transition-all active:scale-95 bg-danger/10 text-danger border border-danger/25 hover:border-danger/30 text-xs font-bold gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('gallery.delete')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        isOpen={!!imageToDelete}
        onOpenChange={(open: boolean) => !open && setImageToDelete(null)}
        onConfirm={() => {
          if (imageToDelete) handleDelete(imageToDelete);
        }}
        title={t('gallery.delete', 'Delete Image')}
        description={t('gallery.confirmDeleteDesc', 'Are you sure you want to permanently delete')}
        itemName={imageToDelete?.filename}
      />
    </div>
  );
};
