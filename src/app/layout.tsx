import { ReactNode } from 'react';

// Since we have a `[locale]` folder, the root `app/layout.tsx` 
// just needs to pass children through.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
