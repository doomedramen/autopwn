'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/analytics', label: 'Analytics' },
  ];

  return (
    <nav className="flex gap-2 sm:gap-4">
      {links.map((link) => (
        <Button
          key={link.href}
          asChild
          variant={pathname === link.href ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            "text-sm sm:text-base",
            pathname === link.href && "bg-green-600 hover:bg-green-700"
          )}
        >
          <Link href={link.href}>
            {link.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
