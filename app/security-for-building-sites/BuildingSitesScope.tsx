const POINTS = [
  'Licence type written to match the duties you describe, not assumed',
  'Licence information recorded on each profile for you to review',
  'Not every duty on a building site is a licensable activity',
  'Applicant eligibility checked against the job’s licence requirement',
];

export default function BuildingSitesScope() {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="scope-heading">
      <div className="max-w-5xl mx-auto px-6 md:px-8">
        <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 md:p-12">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 rounded-2xl border border-teal-400/20 shrink-0">
              <i className="ri-shield-check-line text-2xl text-teal-400" aria-hidden="true" />
            </div>
            <div>
              <h2 id="scope-heading" className="text-2xl md:text-3xl font-bold text-white mb-4">
                Licences, duties and what QuickGuard does not replace
              </h2>
              <p className="text-slate-400 leading-relaxed mb-4">
                QuickGuard is a place to post a building site requirement and find security personnel whose recorded licence details
                match the duties described. It is not a construction accreditation scheme and it does not inspect your site safety
                arrangements.
              </p>
              <ul className="grid sm:grid-cols-2 gap-3 list-none m-0 p-0 mb-5">
                {POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-slate-400">
                    <i className="ri-check-line mt-0.5 text-teal-400" aria-hidden="true" />
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate-500 leading-relaxed mb-3">
                A security officer does not take over your site safety obligations. Site safety planning, supervision of works,
                insurance and any construction-specific accreditation remain with the site operator and its duty holders.
              </p>
              <p className="text-sm text-slate-500 leading-relaxed mb-3">
                A recorded SIA licence is not insurance and we make no blanket claim that every aspect of a guard’s history has been
                verified. Check the licence and insurance evidence you need for your booking before you confirm.
              </p>
              <p className="text-sm text-slate-500 leading-relaxed">
                Duties and licence needs vary by site, so base each requirement on a site-specific risk assessment and check current
                SIA guidance before you post. This page is general information, not legal or licensing advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}