'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadDemoData } from '@/app/(app)/intake/actions';

/**
 * Fills every module with the Vardhman demo issuer's answers in one click —
 * for showing the tool rather than typing into it live. Safe to press more
 * than once: each press is a normal append-only write (D-design), so
 * nothing already saved is ever lost underneath it.
 */
export function LoadDemoDataButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await loadDemoData();
          if (!result.ok && result.error) window.alert(result.error);
          router.refresh();
        });
      }}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {pending ? 'Loading...' : 'Load demo data'}
    </Button>
  );
}
