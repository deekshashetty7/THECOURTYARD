import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Image, Plus, Save, Trash2, Upload } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { useLandingPage } from '../../context/LandingPageContext';
import { getAuthAccessToken } from '../../lib/authToken';
import { showErrorToast, showSuccessToast } from '../../utils/notificationHelpers';

type GalleryDraft = {
  caption: string;
  fileName: string;
  previewUrl: string;
  dataUrl: string;
};

type GalleryItem = {
  id: string;
  url: string;
  caption: string;
};

const DEFAULT_GALLERY_IMAGES: GalleryItem[] = [
  { id: 'gallery-default-1', url: '/img1.jpg', caption: 'Professional court lighting' },
  { id: 'gallery-default-2', url: '/im2.jpg', caption: 'Premium playing surface' },
  { id: 'gallery-default-3', url: '/img3.webp', caption: 'Ready for competitive play' },
  { id: 'gallery-default-4', url: '/img4.webp', caption: 'Weekend training sessions' },
  { id: 'gallery-default-5', url: '/img5.jpg', caption: 'High energy match nights' },
];

const getDefaultDraft = (index = 0): GalleryDraft => {
  const image = DEFAULT_GALLERY_IMAGES[index % DEFAULT_GALLERY_IMAGES.length] || DEFAULT_GALLERY_IMAGES[0];
  return {
    caption: image.caption,
    fileName: '',
    previewUrl: image.url,
    dataUrl: image.url,
  };
};

const createEmptyDraft = (): GalleryDraft => ({
  caption: '',
  fileName: '',
  previewUrl: '',
  dataUrl: '',
});

const MAX_IMAGE_BYTES = 350 * 1024;
const MAX_GALLERY_PAYLOAD_BYTES = 850 * 1024;
const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';
const API_BASE_URL =
  typeof window !== 'undefined' && window.location.hostname.includes('localhost')
    ? '/api'
    : RAW_API_BASE_URL;

const readFileAsDataUrl = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read image file'));
    reader.readAsDataURL(file);
  });
};

const optimizeImageDataUrl = (dataUrl: string, maxDimension = 1400, quality = 0.8) => {
  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const width = image.width;
      const height = image.height;

      const scale = Math.min(1, maxDimension / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Unable to process image'));
        return;
      }

      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
      const webpDataUrl = canvas.toDataURL('image/webp', quality);
      const optimizedDataUrl = webpDataUrl.startsWith('data:image/webp')
        ? webpDataUrl
        : canvas.toDataURL('image/jpeg', quality);

      resolve(optimizedDataUrl);
    };
    image.onerror = () => reject(new Error('Unable to process image'));
    image.src = dataUrl;
  });
};

const estimateBytes = (value: string) => new TextEncoder().encode(value).length;

const uploadImageToCloudinary = async (dataUrl: string, fileName: string) => {
  const token = await getAuthAccessToken();
  if (!token) {
    throw new Error('Please sign in again to upload images');
  }

  const response = await fetch(`${API_BASE_URL}/admin/gallery/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ image: dataUrl, fileName }),
  });

  const rawText = await response.text().catch(() => '');
  const payload = rawText ? (() => {
    try {
      return JSON.parse(rawText);
    } catch {
      return null;
    }
  })() : null;

  if (!response.ok || !payload?.upload?.secureUrl) {
    const statusDetail = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    const serverMessage = payload?.error?.message || rawText || 'Unable to upload image to Cloudinary';
    throw new Error(`${statusDetail}: ${serverMessage}`);
  }

  return payload.upload.secureUrl as string;
};

const saveGalleryToFirestore = async (gallery: GalleryItem[]) => {
  const token = await getAuthAccessToken();
  if (!token) {
    throw new Error('Please sign in again to save gallery changes');
  }

  const response = await fetch(`${API_BASE_URL}/admin/gallery`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ gallery }),
  });

  const rawText = await response.text().catch(() => '');
  const payload = rawText
    ? (() => {
        try {
          return JSON.parse(rawText);
        } catch {
          return null;
        }
      })()
    : null;

  if (!response.ok) {
    const statusDetail = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    const serverMessage = payload?.error?.message || rawText || 'Unable to save gallery to Firestore';
    throw new Error(`${statusDetail}: ${serverMessage}`);
  }

  return Array.isArray(payload?.gallery) ? payload.gallery : gallery;
};

const deleteGalleryImage = async (imageId: string, imageUrl: string, imageCaption: string, imageIndex: number) => {
  const token = await getAuthAccessToken();
  if (!token) {
    throw new Error('Please sign in again to delete gallery images');
  }

  const response = await fetch(`${API_BASE_URL}/admin/gallery/${imageId}?url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(imageCaption)}&index=${imageIndex}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const rawText = await response.text().catch(() => '');
  const payload = rawText
    ? (() => {
        try {
          return JSON.parse(rawText);
        } catch {
          return null;
        }
      })()
    : null;

  if (!response.ok) {
    const statusDetail = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    const serverMessage = payload?.error?.message || rawText || 'Unable to delete gallery image';
    throw new Error(`${statusDetail}: ${serverMessage}`);
  }

  return Array.isArray(payload?.gallery) ? payload.gallery : [];
};

export const AdminGalleryPage = () => {
  const navigate = useNavigate();
  const { content } = useLandingPage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>(content.gallery.length ? content.gallery : DEFAULT_GALLERY_IMAGES);
  const [draft, setDraft] = useState<GalleryDraft>(getDefaultDraft(0));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGallery(content.gallery.length ? content.gallery : DEFAULT_GALLERY_IMAGES);

    const loadGalleryFromApi = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/gallery`, { cache: 'no-store' });
        if (!res.ok) return;
        const payload = await res.json().catch(() => null);
        if (payload && Array.isArray(payload.gallery)) {
          setGallery(payload.gallery);
        }
      } catch {
        // ignore
      }
    };

    void loadGalleryFromApi();
  }, [content.gallery]);

  const isEditing = editingIndex !== null;

  const selectedImagePreview = useMemo(() => draft.previewUrl || (editingIndex !== null ? gallery[editingIndex]?.url || '' : ''), [draft.previewUrl, editingIndex, gallery]);

  const deleteTarget = deleteIndex !== null ? gallery[deleteIndex] : null;

  const resetDraft = () => {
    setDraft(getDefaultDraft(gallery.length));
    setEditingIndex(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const persistGallery = (nextGallery: GalleryItem[]) => {
    setGallery(nextGallery);
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) {
      return;
    }

    const rawDataUrl = await readFileAsDataUrl(file);
    let dataUrl = rawDataUrl;

    // Resize/compress local uploads to keep settings payload within Firestore limits.
    if (estimateBytes(rawDataUrl) > MAX_IMAGE_BYTES) {
      dataUrl = await optimizeImageDataUrl(rawDataUrl);
    }

    if (estimateBytes(dataUrl) > MAX_IMAGE_BYTES) {
      showErrorToast('Image too large', 'Please choose a smaller image (recommended under 2MB)');
      return;
    }

    setDraft((prev) => ({
      ...prev,
      fileName: file.name,
      previewUrl: dataUrl,
      dataUrl,
    }));
  };

  const handleSaveImage = async () => {
    if (!draft.dataUrl && editingIndex === null) {
      showErrorToast('Unable to save image', 'Please choose an image file.');
      return;
    }

    setSaving(true);

    try {
      const nextGallery = [...gallery];
      const caption = draft.caption.trim();
      const fallbackCaption = editingIndex !== null ? nextGallery[editingIndex]?.caption || `Court ${editingIndex + 1}` : `Court ${nextGallery.length + 1}`;
      let imageUrl = draft.dataUrl;

      if (draft.dataUrl.startsWith('data:image/')) {
        try {
          imageUrl = await uploadImageToCloudinary(draft.dataUrl, draft.fileName || fallbackCaption);
        } catch (uploadError) {
          console.warn('Cloudinary upload failed, saving optimized image directly:', uploadError);
          imageUrl = draft.dataUrl;
          showErrorToast('Upload fallback used', 'The optimized image was saved directly so it still appears in the gallery.');
        }
      }

      if (editingIndex === null) {
        nextGallery.push({
          id: Date.now().toString(),
          url: imageUrl,
          caption: caption || fallbackCaption,
        });
      } else {
        const existing = nextGallery[editingIndex];
        if (!existing) {
          return;
        }

        nextGallery[editingIndex] = {
          ...existing,
          url: imageUrl || existing.url,
          caption: caption || existing.caption,
        };
      }

      const payloadBytes = estimateBytes(JSON.stringify({ landing: { gallery: nextGallery } }));
      if (payloadBytes > MAX_GALLERY_PAYLOAD_BYTES) {
        throw new Error('Gallery is too large to save. Remove or compress some images.');
      }

      const savedGallery = await saveGalleryToFirestore(nextGallery);
      persistGallery(savedGallery);
      window.dispatchEvent(new CustomEvent('tcy:settings-updated'));
      try { window.localStorage.setItem('tcy:settings-updated', String(Date.now())); } catch {};
      showSuccessToast(editingIndex === null ? 'Court image added successfully!' : 'Court image updated successfully!');
      resetDraft();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save image';
      showErrorToast('Unable to save image', message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditImage = (index: number) => {
    const image = gallery[index];
    if (!image) {
      return;
    }

    setEditingIndex(index);
    setDraft({
      caption: image.caption,
      fileName: '',
      previewUrl: image.url,
      dataUrl: image.url,
    });
    fileInputRef.current?.click();
  };

  const handleDeleteImage = async (index: number) => {
    const image = gallery[index];
    if (!image) {
      return;
    }

    setDeleteIndex(index);
  };

  const confirmDeleteImage = async () => {
    if (deleteIndex === null) {
      return;
    }

    const image = gallery[deleteIndex];
    if (!image) {
      setDeleteIndex(null);
      return;
    }

    try {
      const savedGallery = await deleteGalleryImage(image.id, image.url, image.caption, deleteIndex);
      persistGallery(savedGallery);
      window.dispatchEvent(new CustomEvent('tcy:settings-updated'));
      try { window.localStorage.setItem('tcy:settings-updated', String(Date.now())); } catch {};
      showSuccessToast('Court image deleted successfully!');

      if (editingIndex === deleteIndex) {
        resetDraft();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete image';
      showErrorToast('Unable to delete image', message);
    } finally {
      setDeleteIndex(null);
    }
  };

  return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <button
          onClick={() => navigate('/admin/settings')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 text-sm md:text-base"
        >
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
          Back to Settings
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Photos</h1>
          <p className="text-gray-600">Add, update, or remove the photos used on the user gallery.</p>
        </div>

        <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-6">
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Image className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{isEditing ? 'Edit Image' : 'Add New Image'}</h2>
                <p className="text-sm text-gray-600">Choose a file and set the caption.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Image File</label>
                <label className="flex items-center justify-center w-full min-h-32 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 hover:bg-green-50 hover:border-green-600 transition-colors cursor-pointer">
                  <div className="text-center p-6">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="font-medium text-gray-700">Click to choose an image</p>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG, JPEG, WEBP</p>
                    {draft.fileName && (
                      <p className="text-xs text-green-900 mt-2">Selected: {draft.fileName}</p>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void handleFileChange(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Caption</label>
                <Input
                  value={draft.caption}
                  onChange={(e) => setDraft((prev) => ({ ...prev, caption: e.target.value }))}
                  placeholder="Court 4"
                />
              </div>

              {selectedImagePreview && (
                <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
                  <img src={selectedImagePreview} alt="Preview" className="w-full h-56 object-cover" />
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button variant="primary" onClick={() => void handleSaveImage()} loading={saving} disabled={saving}>
                  <Save className="w-4 h-4" />
                  {isEditing ? 'Update Image' : 'Add Image'}
                </Button>
                <Button variant="outline" onClick={resetDraft} disabled={saving}>
                  Reset
                </Button>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold">Current Photos</h2>
                <p className="text-sm text-gray-600">Preview of the photos shown to users.</p>
              </div>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Plus className="w-4 h-4" />
                Add Photo
              </Button>
            </div>

            {gallery.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-600">
                No photos yet. Use Add Photo to upload the first gallery item.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {gallery.map((image, index) => (
                  <div key={image.id} className="group relative">
                    <div className="aspect-video rounded-2xl overflow-hidden border border-gray-200 bg-gray-100">
                      <img src={image.url} alt={image.caption} className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl bg-black/50 flex items-center justify-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => handleEditImage(index)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleDeleteImage(index)}>
                        Delete
                      </Button>
                    </div>
                    <p className="mt-2 text-sm font-medium text-gray-800">{image.caption}</p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <AlertDialog open={deleteIndex !== null} onOpenChange={(open) => { if (!open) setDeleteIndex(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Image</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteTarget
                    ? `Delete ${deleteTarget.caption || 'this court image'} from the gallery? This cannot be undone.`
                    : 'Delete this court image from the gallery? This cannot be undone.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void confirmDeleteImage()} className="bg-red-600 text-white hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
  );
};
