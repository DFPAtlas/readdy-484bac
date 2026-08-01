"use client";

interface FilterState {
  siaLicence: string;
  distance: string;
  rating: string;
  experience: string;
  availability: string;
  sortBy: string;
  compliance: string;
}

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
  resultCount: number;
}

export default function ApplicantFilters({
  filters,
  onChange,
  onReset,
  resultCount,
}: Props) {
  const update = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <i className="ri-filter-3-line text-slate-400"></i>
          <h3 className="text-sm font-semibold text-slate-200">Filters</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {resultCount} result{resultCount !== 1 ? "s" : ""}
          </span>
          <button
            onClick={onReset}
            className="text-xs text-teal-400 hover:text-teal-300 cursor-pointer font-medium"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1.5">
            SIA Licence
          </label>
          <div className="relative">
            <select
              value={filters.siaLicence}
              onChange={(e) => update("siaLicence", e.target.value)}
              className="w-full appearance-none bg-[#162036] border border-[#1e2d4d] rounded-lg px-3 py-2 text-sm text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 pr-8"
            >
              <option value="">All</option>
              <option value="verified">SIA Verified</option>
              <option value="door_supervisor">Door Supervisor</option>
              <option value="security_guard">Security Guard</option>
              <option value="close_protection">Close Protection</option>
              <option value="cctv">CCTV</option>
            </select>
            <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 block mb-1.5">
            Distance
          </label>
          <div className="relative">
            <select
              value={filters.distance}
              onChange={(e) => update("distance", e.target.value)}
              className="w-full appearance-none bg-[#162036] border border-[#1e2d4d] rounded-lg px-3 py-2 text-sm text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 pr-8"
            >
              <option value="">Any</option>
              <option value="5">Under 5 km</option>
              <option value="10">Under 10 km</option>
              <option value="20">Under 20 km</option>
              <option value="50">Under 50 km</option>
            </select>
            <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 block mb-1.5">
            Rating
          </label>
          <div className="relative">
            <select
              value={filters.rating}
              onChange={(e) => update("rating", e.target.value)}
              className="w-full appearance-none bg-[#162036] border border-[#1e2d4d] rounded-lg px-3 py-2 text-sm text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 pr-8"
            >
              <option value="">Any</option>
              <option value="4.5">4.5+ stars</option>
              <option value="4">4.0+ stars</option>
              <option value="3.5">3.5+ stars</option>
              <option value="3">3.0+ stars</option>
            </select>
            <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 block mb-1.5">
            Experience
          </label>
          <div className="relative">
            <select
              value={filters.experience}
              onChange={(e) => update("experience", e.target.value)}
              className="w-full appearance-none bg-[#162036] border border-[#1e2d4d] rounded-lg px-3 py-2 text-sm text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 pr-8"
            >
              <option value="">Any</option>
              <option value="5">5+ years</option>
              <option value="3">3+ years</option>
              <option value="1">1+ year</option>
              <option value="0">New guard</option>
            </select>
            <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 block mb-1.5">
            Availability
          </label>
          <div className="relative">
            <select
              value={filters.availability}
              onChange={(e) => update("availability", e.target.value)}
              className="w-full appearance-none bg-[#162036] border border-[#1e2d4d] rounded-lg px-3 py-2 text-sm text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 pr-8"
            >
              <option value="">Any</option>
              <option value="available">Available</option>
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="weekends">Weekends</option>
            </select>
            <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 block mb-1.5">
            Compliance
          </label>
          <div className="relative">
            <select
              value={filters.compliance}
              onChange={(e) => update("compliance", e.target.value)}
              className="w-full appearance-none bg-[#162036] border border-[#1e2d4d] rounded-lg px-3 py-2 text-sm text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 pr-8"
            >
              <option value="">All</option>
              <option value="fully_compliant">Fully Compliant</option>
              <option value="sia_verified">SIA Verified</option>
              <option value="expiring_soon">Expiring Soon</option>
              <option value="missing_docs">Missing Documents</option>
              <option value="licence_match">Licence Match</option>
              <option value="needs_review">Needs Review</option>
            </select>
            <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 block mb-1.5">Sort By</label>
          <div className="relative">
            <select
              value={filters.sortBy}
              onChange={(e) => update("sortBy", e.target.value)}
              className="w-full appearance-none bg-[#162036] border border-[#1e2d4d] rounded-lg px-3 py-2 text-sm text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 pr-8"
            >
              <option value="rating">Highest Rated</option>
              <option value="rate_low">Lowest Rate</option>
              <option value="rate_high">Highest Rate</option>
              <option value="experience">Most Experience</option>
              <option value="distance">Nearest</option>
              <option value="newest">Newest</option>
              <option value="compliance">Highest Compliance</option>
            </select>
            <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          </div>
        </div>
      </div>
    </div>
  );
}