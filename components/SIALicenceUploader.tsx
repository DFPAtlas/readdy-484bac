'use client';

import { useRef } from 'react';

interface SIALicenceUploaderProps {
  frontFile: File | null;
  backFile: File | null;
  frontPreview: string;
  backPreview: string;
  onFrontChange: (file: File | null, preview: string) => void;
  onBackChange: (file: File | null, preview: string) => void;
  error: string;
  onError: (msg: string) => void;
}

export default function SIALicenceUploader({
  frontFile,
  backFile,
  frontPreview,
  backPreview,
  onFrontChange,
  onBackChange,
  error,
  onError,
}: SIALicenceUploaderProps) {
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

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

  const handleFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      onError(err);
      return;
    }
    onError('');
    const preview = URL.createObjectURL(file);
    onFrontChange(file, preview);
  };

  const handleBackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      onError(err);
      return;
    }
    onError('');
    const preview = URL.createObjectURL(file);
    onBackChange(file, preview);
  };

  const handleRemoveFront = () => {
    onFrontChange(null, '');
    if (frontRef.current) frontRef.current.value = '';
  };

  const handleRemoveBack = () => {
    onBackChange(null, '');
    if (backRef.current) backRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">SIA Licence Requirements</h3>
        <p className="text-sm text-slate-400 mb-4">
          All QuickGuard security professionals must have a valid SIA licence. Please upload a clear photo or scan of your licence.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
              <i className="ri-check-line text-teal-400 text-xl"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Front of licence</p>
              <p className="text-xs text-slate-400">Required</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
              <i className="ri-check-line text-teal-400 text-xl"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Back of licence</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Front Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Front of SIA Licence <span className="text-red-400">*</span>
          </label>
          <div className="bg-[#162236] border border-slate-600 rounded-xl p-4">
            {frontPreview ? (
              <div className="space-y-3">
                <div className="bg-[#0B1933] rounded-lg overflow-hidden">
                  {frontPreview.toLowerCase().endsWith('.pdf') ? (
                    <div className="p-6 text-center">
                      <div className="w-16 h-16 flex items-center justify-center bg-red-500/15 rounded-full mx-auto mb-3">
                        <i className="ri-file-pdf-line text-3xl text-red-400"></i>
                      </div>
                      <p className="text-sm text-white font-medium">PDF Uploaded</p>
                      <p className="text-xs text-slate-400">{frontFile?.name}</p>
                    </div>
                  ) : (
                    <img src={frontPreview} alt="SIA Licence Front" className="w-full h-auto max-h-[200px] object-contain" />
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => frontRef.current?.click()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-teal-500 text-slate-900 rounded-lg text-sm font-medium hover:bg-teal-400 cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-upload-2-line"></i>
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveFront}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#111d35] text-slate-300 border border-slate-700/50 rounded-lg text-sm font-medium hover:bg-slate-700/50 cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-delete-bin-line"></i>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => frontRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-teal-500 transition-colors"
              >
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/15 rounded-full mx-auto mb-3">
                  <i className="ri-upload-cloud-line text-2xl text-teal-400"></i>
                </div>
                <p className="text-sm font-medium text-white mb-1">Click to upload front</p>
                <p className="text-xs text-slate-400">JPG, PNG, or PDF · Max 10MB</p>
              </div>
            )}
            <input ref={frontRef} type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" onChange={handleFrontChange} className="hidden" />
          </div>
        </div>

        {/* Back Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Back of SIA Licence <span className="text-red-400">*</span>
          </label>
          <div className="bg-[#162236] border border-slate-600 rounded-xl p-4">
            {backPreview ? (
              <div className="space-y-3">
                <div className="bg-[#0B1933] rounded-lg overflow-hidden">
                  {backPreview.toLowerCase().endsWith('.pdf') ? (
                    <div className="p-6 text-center">
                      <div className="w-16 h-16 flex items-center justify-center bg-red-500/15 rounded-full mx-auto mb-3">
                        <i className="ri-file-pdf-line text-3xl text-red-400"></i>
                      </div>
                      <p className="text-sm text-white font-medium">PDF Uploaded</p>
                      <p className="text-xs text-slate-400">{backFile?.name}</p>
                    </div>
                  ) : (
                    <img src={backPreview} alt="SIA Licence Back" className="w-full h-auto max-h-[200px] object-contain" />
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => backRef.current?.click()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-teal-500 text-slate-900 rounded-lg text-sm font-medium hover:bg-teal-400 cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-upload-2-line"></i>
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveBack}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#111d35] text-slate-300 border border-slate-700/50 rounded-lg text-sm font-medium hover:bg-slate-700/50 cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-delete-bin-line"></i>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => backRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-teal-500 transition-colors"
              >
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/15 rounded-full mx-auto mb-3">
                  <i className="ri-upload-cloud-line text-2xl text-teal-400"></i>
                </div>
                <p className="text-sm font-medium text-white mb-1">Click to upload back</p>
                <p className="text-xs text-slate-400">JPG, PNG, or PDF · Max 10MB</p>
              </div>
            )}
            <input ref={backRef} type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" onChange={handleBackChange} className="hidden" />
          </div>
        </div>
      </div>
    </div>
  );
}