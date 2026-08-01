import VerifyGuardsClient from './VerifyGuardsClient';

export default function VerifyGuardsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify Guards</h1>
          <p className="text-gray-600">Review and approve guard applications</p>
        </div>

        <VerifyGuardsClient />
      </main>
    </div>
  );
}