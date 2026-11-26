const POINTS = [
  'Licence type written to match the duties you describe, not assumed from the site type',
  'Licence information recorded on each profile for you to review before choosing',
  'Not every store duty is a licensable activity — customer service usually is not',
  'Applicant eligibility checked against the job’s stated licence requirement',
];

export default function RetailScopeNote() {
  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="retail-scope-heading">
      <div className="max-w-5xl mx-auto px-6 md:px-8">
        <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 md:p-12">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 rounded-2xl border border-teal-400/20 shrink-0">
              <i className="ri-shield-check-line text-2xl text-teal-400" aria-hidden="true" />
            </div>
            <div>
              <h2 id="retail-scope-heading" className="text-2xl md:text-3xl font-bold text-white mb-4">
                Licensing, risk assessment and your responsibilities as a retailer
              </h2>
              <p className="text-slate-400 leading-relaxed mb-4">
                QuickGuard is a place to post a store requirement and find security personnel whose recorded licence details match the
                duties described. It is not a licensing authority, it does not assess your store’s risk, and it does not certify
                compliance.
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
                The retailer keeps responsibility for its own risk assessment, store policies and procedures, premises licence
                conditions where they apply, insurance, staff training and any decision to detain or refuse entry. A security officer does
                not take those duties over, and QuickGuard does not supervise the shift.
              </p>
              <p className="text-sm text-slate-500 leading-relaxed">
                Licence requirements depend on the activity and can change, so base each requirement on your own risk assessment and check
                current SIA guidance before you post. This page is general information, not legal or licensing advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}