'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Pacifico&display=swap"
          rel="stylesheet"
          media="print"
          onLoad={(e) => {
            (e.currentTarget as HTMLLinkElement).media = 'all';
          }}
        />
      </head>
      <body>
        <div className="min-h-screen bg-[#0B1933] flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="font-['Pacifico'] text-4xl text-teal-400 mb-8">QuickGuard</div>
            <div className="text-6xl font-bold text-teal-400 mb-4">Critical Error</div>
            <h1 className="text-2xl font-semibold text-white mb-2">Something went seriously wrong</h1>
            <p className="text-slate-400 mb-6">
              We&apos;re working to fix this. Please try refreshing the page.
            </p>
            <button
              onClick={reset}
              className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-900 rounded-lg font-medium transition cursor-pointer whitespace-nowrap"
            >
              Refresh page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}