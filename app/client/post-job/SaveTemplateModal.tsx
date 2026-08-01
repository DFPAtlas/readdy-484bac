
'use client';

import { useState } from 'react';

interface SaveTemplateModalProps {
  defaultName: string;
  onSave: (name: string) => void;
  onClose: () => void;
  saving: boolean;
}

export default function SaveTemplateModal({ defaultName, onSave, onClose, saving }: SaveTemplateModalProps) {
  const [name, setName] = useState(defaultName);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <i className="ri-file-copy-line text-2xl text-indigo-600"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Save as Template</h2>
            <p className="text-sm text-gray-500">Reuse this job configuration later</p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Template Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Weekend Door Supervisor"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onSave(name)}
            disabled={!name.trim() || saving}
            className="flex-1 bg-[#1a237e] text-white py-3 rounded-lg font-semibold hover:bg-[#0d1642] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              <>
                <i className="ri-save-line"></i>
                Save Template
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
