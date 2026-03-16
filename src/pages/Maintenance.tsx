import { AlertTriangle } from 'lucide-react';

export default function Maintenance() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-10 h-10 text-amber-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">We'll be back soon!</h1>
        <p className="text-gray-600 text-lg">
          Our platform is currently undergoing scheduled maintenance to improve your experience. 
          Please check back later.
        </p>
        <div className="pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Are you an administrator? <a href="/login" className="text-emerald-600 hover:underline">Log in here</a>
          </p>
        </div>
      </div>
    </div>
  );
}
