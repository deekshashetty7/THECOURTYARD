import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Send, Star, Trash2 } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/Button';
import { getAuthAccessToken } from '../../lib/authToken';
import { useNotifications } from '../../context/NotificationContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';

type Review = {
  id: string;
  name: string;
  email?: string;
  rating: number;
  comment: string;
  date: string;
  adminReply?: string | null;
  adminReplyBy?: string | null;
  adminReplyAt?: string | null;
};

const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';
const API_BASE_URL =
  typeof window !== 'undefined' && window.location.hostname.includes('localhost')
    ? '/api'
    : RAW_API_BASE_URL;

export const AdminReviews = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { addNotification } = useNotifications();

  const loadReviews = async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getAuthAccessToken();
      if (!token) {
        throw new Error('Please sign in again to view reviews.');
      }

      const response = await fetch(`${API_BASE_URL}/admin/reviews`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to load reviews');
      }

      const nextReviews = Array.isArray(payload?.reviews) ? payload.reviews : [];
      setReviews(nextReviews);
      setReplyDrafts((prev) => {
        const next: Record<string, string> = { ...prev };
        nextReviews.forEach((review: Review) => {
          if (!(review.id in next)) {
            next[review.id] = review.adminReply || '';
          }
        });
        return next;
      });
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load reviews';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReviews();
  }, []);

  const averageRating = useMemo(() => {
    if (!reviews.length) {
      return 0;
    }

    const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    return Number((total / reviews.length).toFixed(1));
  }, [reviews]);

  const saveReply = async (reviewId: string) => {
    const reply = (replyDrafts[reviewId] || '').trim();
    if (!reply) {
      return;
    }

    setSavingReviewId(reviewId);
    setError('');

    try {
      const token = await getAuthAccessToken();
      if (!token) {
        throw new Error('Please sign in again to save reply.');
      }

      const response = await fetch(`${API_BASE_URL}/admin/reviews/${reviewId}/reply`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reply }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to save reply');
      }

      setReviews((prev) => prev.map((review) => (review.id === reviewId ? payload.review : review)));
      window.dispatchEvent(new CustomEvent('tcy:settings-updated'));
      addNotification({
        type: 'success',
        title: 'Reply Saved',
        message: 'Your reply has been posted successfully.',
      });
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save reply';
      setError(message);
      addNotification({
        type: 'error',
        title: 'Failed to Save Reply',
        message,
      });
    } finally {
      setSavingReviewId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingReviewId) return;
    
    setDeleteDialogOpen(false);
    setError('');

    try {
      const token = await getAuthAccessToken();
      if (!token) throw new Error('Please sign in again to delete review.');

      const response = await fetch(`${API_BASE_URL}/admin/reviews/${deletingReviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to delete review');

      setReviews((prev) => prev.filter((r) => r.id !== deletingReviewId));
      window.dispatchEvent(new CustomEvent('tcy:settings-updated'));
      addNotification({
        type: 'success',
        title: 'Review Deleted',
        message: 'The review has been successfully deleted.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to delete review';
      setError(message);
      addNotification({
        type: 'error',
        title: 'Failed to Delete Review',
        message,
      });
    } finally {
      setDeletingReviewId(null);
    }
  };

  const deleteReview = (reviewId: string) => {
    setDeletingReviewId(reviewId);
    setDeleteDialogOpen(true);
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Reviews & Ratings</h1>
          <p className="text-sm md:text-base text-gray-600">Read user feedback and respond directly from admin.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <GlassCard className="p-4">
            <p className="text-sm text-gray-500">Total Reviews</p>
            <p className="text-2xl font-bold text-gray-900">{reviews.length}</p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-sm text-gray-500">Average Rating</p>
            <p className="text-2xl font-bold text-gray-900">{averageRating || 0} / 5</p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-sm text-gray-500">With Admin Reply</p>
            <p className="text-2xl font-bold text-gray-900">{reviews.filter((review) => review.adminReply).length}</p>
          </GlassCard>
        </div>

        {error ? (
          <GlassCard className="p-4 mb-4 border border-red-200 bg-red-50 text-red-700 text-sm">{error}</GlassCard>
        ) : null}

        {loading ? (
          <GlassCard className="p-8 text-center text-gray-600">Loading reviews...</GlassCard>
        ) : reviews.length === 0 ? (
          <GlassCard className="p-8 text-center text-gray-600">No reviews yet.</GlassCard>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <GlassCard key={review.id} className="p-5">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{review.name}</h3>
                    <p className="text-xs text-gray-500">{review.email || 'No email'}</p>
                    <div className="flex items-center gap-1 mt-2">
                      {[...Array(5)].map((_, index) => (
                        <Star
                          key={`${review.id}-${index}`}
                          className={`w-4 h-4 ${index < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">{review.date}</p>
                </div>

                <p className="text-gray-700 mb-4">{review.comment}</p>

                {review.adminReply ? (
                  <div className="mb-4 rounded-xl border border-green-100 bg-green-50 p-3">
                    <p className="text-xs font-semibold text-green-900 mb-1 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Reply from {review.adminReplyBy || 'Admin'}
                    </p>
                    <p className="text-sm text-gray-700">{review.adminReply}</p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Admin Reply</label>
                  <textarea
                    value={replyDrafts[review.id] || ''}
                    onChange={(event) => setReplyDrafts((prev) => ({ ...prev, [review.id]: event.target.value }))}
                    placeholder="Write a response for this user..."
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#808000] min-h-[100px]"
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      onClick={() => void saveReply(review.id)}
                      disabled={!String(replyDrafts[review.id] || '').trim() || savingReviewId === review.id}
                    >
                      <Send className="w-4 h-4" />
                      {savingReviewId === review.id ? 'Saving...' : review.adminReply ? 'Update Reply' : 'Post Reply'}
                    </Button>
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button variant="destructive" onClick={() => void deleteReview(review.id)}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Review
                    </Button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Review</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. Are you sure you want to permanently delete this review?
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

