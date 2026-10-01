import Link from 'next/link';

export default function SocialConsentNotice() {
  return (
    <p className="text-xs text-[#AAB7C4]/50 text-center leading-relaxed mt-3">
      By continuing, you agree to our{' '}
      <Link href="/terms" className="font-medium transition-colors hover:text-[#3B82F6]" style={{ color: "#1DA1F2" }}>
        Terms of Use
      </Link>{' '}
      and acknowledge our{' '}
      <Link href="/privacy" className="font-medium transition-colors hover:text-[#3B82F6]" style={{ color: "#1DA1F2" }}>
        Privacy Policy
      </Link>
      .
    </p>
  );
}