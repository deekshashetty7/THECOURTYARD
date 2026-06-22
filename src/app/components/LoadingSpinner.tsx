export const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-gray-200 border-t-[#10b981] rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
};
