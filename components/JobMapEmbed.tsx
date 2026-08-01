'use client';

interface JobMapEmbedProps {
  latitude: number;
  longitude: number;
  height?: number;
  width?: string;
  className?: string;
}

export default function JobMapEmbed({
  latitude,
  longitude,
  height = 180,
  width = '100%',
  className = '',
}: JobMapEmbedProps) {
  const src = `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d10000!2d${longitude}!3d${latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2suk!4v1`;

  return (
    <div className={`rounded-xl overflow-hidden border border-slate-700/50 ${className}`}>
      <iframe
        src={src}
        width={width}
        height={height}
        style={{ border: 0, filter: 'grayscale(0.3) contrast(1.05)' }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Job location map"
      />
    </div>
  );
}