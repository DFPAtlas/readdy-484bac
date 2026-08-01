
'use client';

import { useState } from 'react';

interface Draft {
  id: string;
  draft_name: string;
  last_saved_at: string;
  form_data: any;
}

interface DraftManagerProps {
  drafts: Draft[];
  onLoadDraft: (draft: Draft) => void;
  onDeleteDraft: (id: string) => void;
  onClose: () => void;
}

export default function DraftManager({ drafts, onLoadDraft, onDeleteDraft, onClose }: DraftManagerProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Saved Drafts</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-6">
          {drafts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-draft-line text-3xl text-gray-400"></i>
              </div>
              <p className="text-gray-600 font-medium">No saved drafts</p>
              <p className="text-gray-400 text-sm mt-1">Drafts you save will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <div key={draft.id} className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{draft.draft_name || 'Untitled Draft'}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Last saved: {new Date(draft.last_saved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  {draft.form_data?.jobTitle && (
                    <p className="text-sm text-gray-600 mb-3 truncate">
                      <i className="ri-briefcase-line mr-1"></i>
                      {draft.form_data.jobTitle}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => onLoadDraft(draft)}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-upload-2-line mr-1"></i>
                      Load Draft
                    </button>
                    {confirmDelete === draft.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => { onDeleteDraft(draft.id); setConfirmDelete(null); }}
                          className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(draft.id)}
                        className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
