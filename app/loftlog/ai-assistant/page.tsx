'use client';

import { useState } from 'react';
import Link from 'next/link';
import { mockItems } from '@/lib/loftlog/mock-data';

const suggestedQuestions = [
  'Where are my Christmas lights?',
  'Do I own a wallpaper steamer?',
  'Which boxes contain electrical tools?',
  'What has not been checked for two years?',
  'Show items marked for donation.',
  'What is inside Box L-R02-S03-B04?',
  'Which items are currently loaned out?',
];

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    { role: 'assistant', text: 'Hi Alex! I can help you find items in your loft. Try asking me a question or pick one of the suggestions below. I only know what is in your current catalogue.' },
  ]);
  const [input, setInput] = useState('');

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text }]);

    setTimeout(() => {
      let response = '';
      const q = text.toLowerCase();

      if (q.includes('christmas') && q.includes('light')) {
        const item = mockItems.find(i => i.id === 'i11');
        response = `Yes! You have **${item?.name}** in **${item?.containerCode}** (${item?.rackCode}). It's currently on loan to Sarah Morgan, expected back by 15 January 2026. [View item](/loftlog/items/i11)`;
      } else if (q.includes('electrical') && q.includes('tool')) {
        const items = mockItems.filter(i => i.category === 'Electrical' || i.category === 'Tools');
        response = `I found ${items.length} items in the Electrical and Tools categories:\n\n${items.map(i => `- **${i.name}** in ${i.containerCode} [View](/loftlog/items/${i.id})`).join('\n')}`;
      } else if (q.includes('not checked') || q.includes('two year')) {
        response = 'Here are items that haven\'t been checked recently:\n\n- Camping Gas Stove (last checked October 2025 - also marked missing)\n- Garden Trowel Set (last checked August 2025)\n\nWould you like to start an audit?';
      } else if (q.includes('donation') || q.includes('donate')) {
        const items = mockItems.filter(i => i.decisionStatus === 'donate');
        response = items.length > 0
          ? `Items marked for donation:\n\n${items.map(i => `- **${i.name}** [View](/loftlog/items/${i.id})`).join('\n')}`
          : 'No items are currently marked for donation.';
      } else if (q.includes('l-r02-s03-b04') || q.includes('box L-R02')) {
        const items = mockItems.filter(i => i.containerCode === 'L-R02-S03-B04');
        response = `**Box L-R02-S03-B04** (Keepsakes Box) contains:\n\n${items.map(i => `- **${i.name}** [View](/loftlog/items/${i.id})`).join('\n')}\n\nLocation: Rack L-R02, Shelf 3, Position 4`;
      } else if (q.includes('loan')) {
        const items = mockItems.filter(i => i.status === 'on_loan');
        response = items.length > 0
          ? `Currently loaned items:\n\n${items.map(i => `- **${i.name}** → ${i.movements.find(m => m.type === 'loaned')?.loanedTo || 'Unknown'} [View](/loftlog/items/${i.id})`).join('\n')}`
          : 'No items are currently on loan.';
      } else if (q.includes('wallpaper steamer')) {
        response = 'No, I did not find a wallpaper steamer in your catalogue. If you own one, it may not have been catalogued yet. Would you like to add it?';
      } else {
        response = 'I searched your catalogue but did not find a clear match. Try searching by category, container code, or item name. You can also browse the [full item list](/loftlog/items).';
      }

      setMessages(prev => [...prev, { role: 'assistant', text: response }]);
    }, 800);

    setInput('');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/loftlog" className="hover:text-gray-600 transition-colors">LoftLog</Link>
        <span className="w-3 h-3 flex items-center justify-center"><i className="ri-arrow-right-s-line text-xs"></i></span>
        <span className="text-gray-600">AI Assistant</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 flex flex-col h-[calc(100vh-200px)]">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ri-robot-line text-purple-600 text-lg"></i>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">AI Assistant</h1>
              <p className="text-xs text-gray-500">
                <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold mr-1">Demo AI</span>
                Answers based on your catalogue data only
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ri-robot-line text-purple-600 text-sm"></i>
                </div>
              )}
              <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-teal-700 text-xs font-bold">AM</span>
                </div>
              )}
            </div>
          ))}

          {messages.length === 1 && (
            <div className="pt-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Suggested questions</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map(q => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend(input)}
              placeholder="Ask about your loft items..."
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              onClick={() => handleSend(input)}
              className="px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}