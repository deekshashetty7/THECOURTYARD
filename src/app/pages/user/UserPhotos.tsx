import { GlassCard } from '../../components/GlassCard';
import { ImageIcon } from 'lucide-react';

export const UserPhotos = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
        <GlassCard className="p-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-green-700" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Photos</h1>
            <p className="text-gray-600">Photo gallery is coming soon.</p>
          </div>
        </GlassCard>
    </div>
  );
};
