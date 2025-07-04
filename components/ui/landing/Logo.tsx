import React from 'react';
import Link from 'next/link';
import { Building } from 'lucide-react';

const Logo = () => {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Building className="h-6 w-6" />
      <span className="font-semibold text-lg">VibePlanner</span>
    </Link>
  );
};

export default Logo; 