import React from 'react';
import Link from 'next/link';

const Logo = () => {
  return (
    <Link href="/" className="flex items-center gap-3 group" aria-label="VibePlanner">
      <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#C06A3D] text-white font-semibold tracking-tight transition-transform duration-200 group-hover:-translate-y-0.5">
        VP
      </span>
      <span className="text-xl font-medium tracking-tight font-[var(--font-display-serif)] text-foreground group-hover:opacity-90 transition-opacity duration-200">
        VibePlanner
      </span>
    </Link>
  );
};

export default Logo;
