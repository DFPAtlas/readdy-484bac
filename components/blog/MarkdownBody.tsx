import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="text-slate-300 text-base sm:text-[17px] leading-[1.75]">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2 className="text-2xl font-bold text-white mt-10 mb-4 leading-snug">{children}</h2>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-10 mb-4 leading-snug">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-white mt-8 mb-3 leading-snug">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-5">{children}</p>,
          a: ({ children, href }) => (
            <a href={href} className="text-teal-400 underline decoration-teal-400/40 hover:text-teal-300">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-5 space-y-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-5 space-y-2">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-teal-400/60 pl-5 my-6 text-slate-400 italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-slate-700/60 my-8" />,
          code: ({ children }) => (
            <code className="bg-[#0B1933] border border-slate-700/60 rounded px-1.5 py-0.5 text-sm text-teal-300">
              {children}
            </code>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="text-left font-semibold text-white border-b border-slate-700/60 px-3 py-2">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-slate-800/60 px-3 py-2">{children}</td>,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}