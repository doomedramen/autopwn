'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/analytics', label: 'Analytics' },
  ];

  return (
    <nav className="flex gap-2 sm:gap-4">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base ${
            pathname === link.href
              ? 'bg-green-600 text-white'
              : 'text-gray-300 hover:bg-gray-800'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
