interface Props {
  paragraphs: string[];
  points: string[];
  note: string;
}

export default function EventCompliance({ paragraphs, points, note }: Props) {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="event-compliance-heading">
      <div className="max-w-5xl mx-auto px-6 md:px-8">
        <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 md:p-12">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 rounded-2xl border border-teal-400/20 shrink-0">
              <i className="ri-file-shield-2-line text-2xl text-teal-400" aria-hidden="true" />
            </div>
            <div>
              <h2 id="event-compliance-heading" className="text-2xl md:text-3xl font-bold text-white mb-4">
                Stewarding, licensable activity and event duties
              </h2>
              {paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-slate-400 leading-relaxed mb-4">
                  {paragraph}
                </p>
              ))}
              <ul className="grid sm:grid-cols-2 gap-3 list-none m-0 p-0 mt-2">
                {points.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-400">
                    <i className="ri-check-line mt-0.5 text-teal-400" aria-hidden="true" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate-500 mt-5 leading-relaxed">{note}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}