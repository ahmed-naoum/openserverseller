import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import { initStorePixels, trackStorePageView } from '../../utils/storePixelTracking';

/**
 * Headless tracking component rendered inside StoreLayout.
 * Initializes all global pixels returned for this store and tracks PageView on every route transition.
 */
export const StorePixelTracker: React.FC = () => {
  const { pixels } = useStore();
  const location = useLocation();
  const lastTrackedUrlRef = useRef<string | null>(null);

  // Initialize scripts as soon as pixels are available
  useEffect(() => {
    if (pixels && pixels.length > 0) {
      initStorePixels(pixels);
    }
  }, [pixels]);

  // Track PageView on route change
  useEffect(() => {
    if (!pixels || pixels.length === 0) return;

    const currentUrl = window.location.pathname + window.location.search;
    if (lastTrackedUrlRef.current === currentUrl) return;

    lastTrackedUrlRef.current = currentUrl;
    trackStorePageView(pixels, window.location.href);
  }, [pixels, location.pathname, location.search]);

  return null;
};

export default StorePixelTracker;
