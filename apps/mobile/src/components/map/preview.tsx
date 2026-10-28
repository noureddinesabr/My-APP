import { createContext, useContext, useState, type ReactNode } from 'react';

import type { Location } from '@/constants/places';

type Preview = { location: Location | null; set: (location: Location | null) => void };

const PreviewContext = createContext<Preview>({ location: null, set: () => {} });

/** A place being looked up below a map, shared so the map above can show it live. */
export function MapPreviewProvider({ children }: { children: ReactNode }) {
  const [location, set] = useState<Location | null>(null);
  return <PreviewContext.Provider value={{ location, set }}>{children}</PreviewContext.Provider>;
}

export function useMapPreview() {
  return useContext(PreviewContext);
}
