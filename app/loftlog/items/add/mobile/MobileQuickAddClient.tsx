'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { mockContainers } from '@/lib/loftlog/mock-data';

export default function MobileQuickAddClient() {
  const [step, setStep] = useState<'scan' | 'photo' | 'details' | 'confirm'>('scan');
  const [containerCode, setContainerCode] = useState('');
  const [photoTaken, setPhotoTaken] = useState(false);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [voiceNote, setVoiceNote] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch {
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      setCameraActive(false);
    }
  };

  const simulatePhoto = () => {
    setPhotoTaken(true);
    stopCamera();
    setAiSuggestion('Cordless Drill Kit');
    setStep('details');
  };

  const handleSave = () => {
    setSaved(true);
  };

  const handleAddAnother = () => {
    setSaved(false);
    setPhotoTaken(false);
    setItemName('');
    setQuantity(1);
    setVoiceNote('');
    setAiSuggestion('');
    setStep('photo');
    startCamera();
  };

  if (saved) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <i className="ri-check-line text-green-600 text-xl"></i>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Item Added</h2>
          <p className="text-sm text-gray-500">{itemName || 'Item'} saved to {containerCode}</p>
          <div className="flex flex-col gap-2 mt-4">
            <button onClick={handleAddAnother} className="w-full px-4 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors">
              Add Another Item
            </button>
            <Link href="/loftlog/items" className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors text-center">
              Back to Items
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/loftlog/items" className="hover:text-gray-600 transition-colors">Items</Link>
        <span className="w-3 h-3 flex items-center justify-center"><i className="ri-arrow-right-s-line text-xs"></i></span>
        <span className="text-gray-600">Quick Add</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Mobile Quick Add</h1>
      <p className="text-sm text-gray-500 mb-6">Fast item entry designed for mobile use in the loft.</p>

      {step === 'scan' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Scan Box QR Code</h2>
          <p className="text-sm text-gray-500 mb-4">Scan the QR code on the container, or select a box below.</p>

          <div className="bg-gray-100 rounded-xl aspect-square mb-4 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-qr-scan-line text-gray-400 text-2xl"></i>
              </div>
              <p className="text-sm text-gray-500">Camera preview for QR scanning</p>
              <p className="text-xs text-gray-400 mt-1">Point camera at box label</p>
            </div>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {mockContainers.map(c => (
              <button
                key={c.id}
                onClick={() => { setContainerCode(c.code); setStep('photo'); }}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  containerCode === c.code ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.label}</p>
                    <p className="text-xs text-gray-400 font-mono">{c.code}</p>
                  </div>
                  <span className="w-6 h-6 flex items-center justify-center text-gray-400"><i className="ri-arrow-right-s-line"></i></span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'photo' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Take Photo</h2>
            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">{containerCode}</span>
          </div>

          {!cameraActive ? (
            <button
              onClick={startCamera}
              className="w-full aspect-square bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                  <i className="ri-camera-line text-gray-400 text-2xl"></i>
                </div>
                <p className="text-sm text-gray-600 font-medium">Tap to open camera</p>
              </div>
            </button>
          ) : (
            <div className="relative aspect-square rounded-xl overflow-hidden bg-black">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <button
                onClick={simulatePhoto}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-gray-300 hover:scale-105 transition-transform"
              >
                <div className="w-12 h-12 bg-white rounded-full"></div>
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'details' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Item Details</h2>

          {aiSuggestion && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 flex items-center justify-center"><i className="ri-sparkling-line text-purple-600 text-sm"></i></span>
                <span className="text-xs font-semibold text-purple-700">AI Suggestion</span>
              </div>
              <p className="text-sm text-purple-800 font-medium">{aiSuggestion}</p>
              <button
                onClick={() => setItemName(aiSuggestion)}
                className="mt-2 text-xs text-purple-600 hover:text-purple-700 font-medium"
              >
                Use this name
              </button>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Item Name</label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="What is this item?"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-700 font-bold"
                >
                  −
                </button>
                <span className="text-lg font-semibold text-gray-900 w-12 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-700 font-bold"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Voice Note</label>
              <button
                onClick={() => {
                  setIsRecording(!isRecording);
                  if (!isRecording) setVoiceNote('Red camping stove with two gas connectors, used twice');
                }}
                className={`w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl text-sm font-medium transition-colors ${
                  isRecording
                    ? 'bg-red-100 text-red-700 border-2 border-red-300 animate-pulse'
                    : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200'
                }`}
              >
                <span className="w-8 h-8 flex items-center justify-center">
                  <i className={`${isRecording ? 'ri-mic-fill text-red-500' : 'ri-mic-line'} text-lg`}></i>
                </span>
                {isRecording ? 'Recording... Tap to stop' : 'Tap to record voice note'}
              </button>
              {voiceNote && (
                <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                  &quot;{voiceNote}&quot;
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button onClick={() => setStep('photo')} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
              Retake Photo
            </button>
            <button onClick={() => setStep('confirm')} className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors">
              Review
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Confirm & Save</h2>

          {photoTaken && (
            <div className="w-full aspect-square bg-gray-100 rounded-xl mb-4 flex items-center justify-center">
              <i className="ri-check-line text-green-500 text-4xl"></i>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Container</span>
              <span className="text-sm font-mono text-gray-700">{containerCode}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Name</span>
              <span className="text-sm font-semibold text-gray-900">{itemName || '—'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Quantity</span>
              <span className="text-sm text-gray-700">{quantity}</span>
            </div>
            {voiceNote && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Voice Note</span>
                <span className="text-sm text-gray-700 truncate max-w-[180px]">{voiceNote}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <button onClick={() => setStep('details')} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
              Edit
            </button>
            <button onClick={handleSave} className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors">
              Confirm & Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}