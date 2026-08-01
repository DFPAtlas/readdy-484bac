import Link from 'next/link';

export default function NotificationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Notifications</h1>
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b hover:bg-gray-50 cursor-pointer">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0"><i className="ri-sparkling-line text-purple-600 text-sm"></i></span>
            <div>
              <p className="text-sm font-medium text-gray-800">AI review needed</p>
              <p className="text-xs text-gray-500">1 item pending identification</p>
              <p className="text-xs text-gray-400 mt-1">2 hours ago</p>
            </div>
          </div>
        </div>
        <div className="p-4 border-b hover:bg-gray-50 cursor-pointer">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0"><i className="ri-share-forward-line text-indigo-600 text-sm"></i></span>
            <div>
              <p className="text-sm font-medium text-gray-800">Loan return due</p>
              <p className="text-xs text-gray-500">LED Christmas Lights - due 15 Jan</p>
              <p className="text-xs text-gray-400 mt-1">Yesterday</p>
            </div>
          </div>
        </div>
        <div className="p-4 hover:bg-gray-50 cursor-pointer">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0"><i className="ri-error-warning-line text-red-600 text-sm"></i></span>
            <div>
              <p className="text-sm font-medium text-gray-800">Storage warning</p>
              <p className="text-xs text-gray-500">Camping Gas Stove - unacknowledged</p>
              <p className="text-xs text-gray-400 mt-1">3 days ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}