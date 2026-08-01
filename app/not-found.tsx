import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center px-4 bg-[#0B1933]">
      <div className="w-24 h-24 bg-teal-500/10 border border-teal-400/20 rounded-2xl flex items-center justify-center mb-8">
        <i className="ri-error-warning-line text-5xl text-teal-400" />
      </div>
      <h1 className="text-6xl font-bold text-white mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-slate-300 mt-2">Page Not Found</h2>
      <p className="mt-3 text-lg text-slate-500 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block bg-teal-500 text-slate-900 px-8 py-3 rounded-xl font-semibold hover:bg-teal-400 transition-all shadow-lg hover:shadow-teal-500/20"
      >
        Back to Home
      </Link>
    </div>
  );
}