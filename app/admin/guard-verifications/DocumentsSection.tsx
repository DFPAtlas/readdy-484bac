import { GuardVerification } from './types';

interface DocumentsSectionProps {
  guard: GuardVerification;
}

export default function DocumentsSection({ guard }: DocumentsSectionProps) {
  const hasLicenceFront = !!guard.driving_licence_front_url?.trim();
  const hasLicenceBack = !!guard.driving_licence_back_url?.trim();
  const hasPoA = !!guard.proof_of_address_url?.trim();

  return (
    <div className="grid grid-cols-3 gap-4 text-sm">
      <div>
        <span className="text-gray-600">Driving Licence Front:</span>
        <p className={`font-medium ${hasLicenceFront ? 'text-green-700' : 'text-red-600'}`}>
          {hasLicenceFront ? 'Uploaded' : 'Missing'}
        </p>
      </div>
      <div>
        <span className="text-gray-600">Driving Licence Back:</span>
        <p className={`font-medium ${hasLicenceBack ? 'text-green-700' : 'text-red-600'}`}>
          {hasLicenceBack ? 'Uploaded' : 'Missing'}
        </p>
      </div>
      <div>
        <span className="text-gray-600">Proof of Address:</span>
        <p className={`font-medium ${hasPoA ? 'text-green-700' : 'text-red-600'}`}>
          {hasPoA ? 'Uploaded' : 'Missing'}
        </p>
      </div>
    </div>
  );
}