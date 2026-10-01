interface Props {
  message: string;
  sub: string;
  image: string;
}

export default function IndustryFeatureBanner({ message, sub, image }: Props) {
  return (
    <section
      aria-label="Why QuickGuard"
      className="relative py-24 bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(11, 26, 51, 0.94) 0%, rgba(11, 26, 51, 0.78) 55%, rgba(11, 26, 51, 0.55) 100%), url('${image}')`,
      }}
    >
      <div className="max-w-5xl mx-auto px-6 md:px-8 text-center">
        <div className="inline-flex items-center gap-2 bg-teal-500/15 border border-teal-400/30 text-teal-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6 backdrop-blur-sm">
          <i className="ri-shield-star-line" aria-hidden="true" />
          Built for this industry
        </div>
        <p className="text-3xl md:text-5xl font-bold text-white leading-tight max-w-4xl mx-auto">
          {message}
        </p>
        <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mt-6">
          {sub}
        </p>
      </div>
    </section>
  );
}