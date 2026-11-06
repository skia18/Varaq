import { renderToString } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { LoadingLabel, LoadingState } from '@/components/ui/LoadingState';

describe('the shared loading language', () => {
  test('announces page loading once and includes its supporting detail', () => {
    const html = renderToString(
      <LoadingState
        variant="page"
        label="Opening your account…"
        detail="Your pages are finding their way back to you."
      />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('varaq-loader--page');
    expect(html).toContain('Opening your account…');
    expect(html).toContain('Your pages are finding their way back to you.');
    expect(html.match(/varaq-loader-slip/g) ?? []).toHaveLength(3);
  });

  test('keeps action progress compact and hides decorative motion dots', () => {
    const html = renderToString(<LoadingLabel>Saving your words</LoadingLabel>);

    expect(html).toContain('Saving your words');
    expect(html).toContain('varaq-loading-dots');
    expect(html).toContain('aria-hidden="true"');
  });
});
