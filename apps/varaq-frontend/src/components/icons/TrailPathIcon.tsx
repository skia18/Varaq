import type { SVGProps } from 'react';

export function TrailPathIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="5" cy="18" r="2.25" />
      <circle cx="19" cy="6" r="2.25" />
      <circle cx="17" cy="19" r="1.75" />
      <circle cx="8.5" cy="15" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="11.5" cy="12" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="9" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="18.6" cy="10.5" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="18.2" cy="13.7" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="17.6" cy="16.4" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
