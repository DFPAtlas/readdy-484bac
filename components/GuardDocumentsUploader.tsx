'use client';

import { useRef } from 'react';

interface GuardDocumentsUploaderProps {
  drivingFrontFile: File | null;
  drivingBackFile: File | null;
  drivingFrontPreview: string;
  drivingBackPreview: string;
  proofOfAddressFile: File | null;
  proofOfAddressPreview: string;
  onDrivingFrontChange: (file: File | null, preview: string) => void;
  onDrivingBackChange: (file: File | null, preview: string) => void;
  onProofOfAddressChange: (file: File | null, preview: string) => void;
  error: string;
  onError: (msg: string) => void;
}

export default function GuardDocumentsUploader({
  drivingFrontFile,
  drivingBackFile,
  drivingFrontPreview,
  drivingBackPreview,
  proofOfAddressFile,
  proofOfAddressPreview,
  onDrivingFrontChange,
  onDrivingBackChange,
  onProofOfAddressChange,
  error,
  onError,
}: GuardDocumentsUploaderProps) {
  const drivingFrontRef = useRef<HTMLInputElement>(null);
  const drivingBackRef = useRef<HTMLInputElement>(null);
  const poaRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return 'Only JPG, PNG, and PDF files are allowed';
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'File size must be less than 10MB';
    }
    return null;
  };

  const handleDrivingFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      onError(err);
      return;
    }
    onError('');
    const preview = URL.createObjectURL(file);
    onDrivingFrontChange(file, preview);
  };

  const handleDrivingBackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      onError(err);
      return;
    }
    onError('');
    const preview = URL.createObjectURL(file);
    onDrivingBackChange(file, preview);
  };

  const handlePoaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      onError(err);
      return;
    }
    onError('');
    const preview = URL.createObjectURL(file);
    onProofOfAddressChange(file, preview);
  };

  const handleRemoveDrivingFront = () => {
    onDrivingFrontChange(null, '');
    if (drivingFrontRef.current) drivingFrontRef.current.value = '';
  };

  const handleRemoveDrivingBack = () => {
    onDrivingBackChange(null, '');
    if (drivingBackRef.current) drivingBackRef.current.value = '';
  };

  const handleRemovePoa = () => {
    onProofOfAddressChange(null, '');
    if (poaRef.current) poaRef.current.value = '';
  };

  const renderPreview = (preview: string, file: File | null, label: string) => {
    if (!preview) return null;
    const isPdf = preview.toLowerCase().endsWith('.pdf') || file?.type === 'application/pdf';
    return (
      <div className="space-y-3">
        <div className="bg-[#0B1933] rounded-lg overflow-hidden">
          {isPdf ? (
            <div className="p-6 text-center">
              <div className="w-16 h-16 flex items-center justify-center bg-red-500/15 rounded-full mx-auto mb-3">
                <i className="ri-file-pdf-line text-3xl text-red-400"></i>
              </div>
              <p className="text-sm text-white font-medium">PDF Uploaded</p>
              <p className="text-xs text-slate-400">{file?.name}</p>
            </div>
          ) : (
            <img src={preview} alt={label} className="w-full h-auto max-h-[200px] object-contain" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Required Documents</h3>
        <p className="text-sm text-slate-400 mb-4">
          For compliance and verification, we need a copy of your driving licence and a recent proof of address. These are stored securely and only visible to QuickGuard admins.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
              <i className="ri-check-line text-teal-400 text-xl"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Driving Licence Front</p>
              <p className="text-xs text-slate-400">Required</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
              <i className="ri-check-line text-teal-400 text-xl"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Driving Licence Back</p>
              <p className="text-xs text-slate-400">Required</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
              <i className="ri-check-line text-teal-400 text-xl"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Proof of Address</p>
              <p className="text-xs text-slate-400">Required</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 flex items-start gap-3">
          <i className="ri-error-warning-line text-red-400 text-xl w-5 h-5 flex items-center justify-center"></i>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Driving Licence Front */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Driving Licence Front <span className="text-red-400">*</span>
          </label>
          <div className="bg-[#162236] border border-slate-600 rounded-xl p-4">
            {drivingFrontPreview ? (
              <div className="space-y-3">
                {renderPreview(drivingFrontPreview, drivingFrontFile, 'Driving Licence Front')}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => drivingFrontRef.current?.click()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-teal-500 text-slate-900 rounded-lg text-sm font-medium hover:bg-teal-400 cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-upload-2-line"></i>
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveDrivingFront}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#111d35] text-slate-300 border border-slate-700/50 rounded-lg text-sm font-medium hover:bg-slate-700/50 cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-delete-bin-line"></i>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => drivingFrontRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-teal-500 transition-colors"
              >
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/15 rounded-full mx-auto mb-3">
                  <i className="ri-upload-cloud-line text-2xl text-teal-400"></i>
                </div>
                <p className="text-sm font-medium text-white mb-1">Click to upload</p>
                <p className="text-xs text-slate-400">JPG, PNG, or PDF · Max 10MB</p>
              </div>
            )}
            <input ref={drivingFrontRef} type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" onChange={handleDrivingFrontChange} className="hidden" />
          </div>
        </div>

        {/* Driving Licence Back */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Driving Licence Back <span className="text-red-400">*</span>
          </label>
          <div className="bg-[#162236] border border-slate-600 rounded-xl p-4">
            {drivingBackPreview ? (
              <div className="space-y-3">
                {renderPreview(drivingBackPreview, drivingBackFile, 'Driving Licence Back')}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => drivingBackRef.current?.click()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-teal-500 text-slate-900 rounded-lg text-sm font-medium hover:bg-teal-400 cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-upload-2-line"></i>
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveDrivingBack}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#111d35] text-slate-300 border border-slate-700/50 rounded-lg text-sm font-medium hover:bg-slate-700/50 cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-delete-bin-line"></i>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => drivingBackRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-teal-500 transition-colors"
              >
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/15 rounded-full mx-auto mb-3">
                  <i className="ri-upload-cloud-line text-2xl text-teal-400"></i>
                </div>
                <p className="text-sm font-medium text-white mb-1">Click to upload</p>
                <p className="text-xs text-slate-400">JPG, PNG, or PDF · Max 10MB</p>
              </div>
            )}
            <input ref={drivingBackRef} type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" onChange={handleDrivingBackChange} className="hidden" />
          </div>
        </div>

        {/* Proof of Address */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Proof of Address <span className="text-red-400">*</span>
          </label>
          <div className="bg-[#162236] border border-slate-600 rounded-xl p-4">
            {proofOfAddressPreview ? (
              <div className="space-y-3">
                {renderPreview(proofOfAddressPreview, proofOfAddressFile, 'Proof of Address')}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => poaRef.current?.click()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-teal-500 text-slate-900 rounded-lg text-sm font-medium hover:bg-teal-400 cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-upload-2-line"></i>
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePoa}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#111d35] text-slate-300 border border-slate-700/50 rounded-lg text-sm font-medium hover:bg-slate-700/50 cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-delete-bin-line"></i>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => poaRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-teal-500 transition-colors"
              >
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/15 rounded-full mx-auto mb-3">
                  <i className="ri-upload-cloud-line text-2xl text-teal-400"></i>
                </div>
                <p className="text-sm font-medium text-white mb-1">Click to upload</p>
                <p className="text-xs text-slate-400">JPG, PNG, or PDF · Max 10MB</p>
              </div>
            )}
            <input ref={poaRef} type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" onChange={handlePoaChange} className="hidden" />
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
          <i className="ri-lock-line text-teal-400 text-lg"></i>
        </div>
        <div>
          <p className="text-sm font-semibold text-white mb-1">Your files are private</p>
          <p className="text-xs text-slate-400">
            Document images are stored in a private, encrypted bucket. Only you and QuickGuard admins can view them. They are never shared publicly.
          </p>
        </div>
      </div>
    </div>
  );
}