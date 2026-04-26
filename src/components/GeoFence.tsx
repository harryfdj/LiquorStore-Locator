import React, { useEffect, useState } from 'react';
import { MapPinOff, Navigation, AlertTriangle } from 'lucide-react';

interface GeoFenceProps {
  storeLat: number | null;
  storeLng: number | null;
  radiusMiles: number | null;
  children: React.ReactNode;
}

// Convert degrees to radians
function toRad(value: number) {
  return (value * Math.PI) / 180;
}

// Haversine formula to absolutely calculate the distance between two points on Earth
function calcDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // Radius of earth in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const l1 = toRad(lat1);
  const l2 = toRad(lat2);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(l1) * Math.cos(l2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const GeoFence: React.FC<GeoFenceProps> = ({ storeLat, storeLng, radiusMiles, children }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isWithinBounds, setIsWithinBounds] = useState<boolean>(true);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    // If Admin hasn't set any location restrictions, instantly pass.
    if (!storeLat || !storeLng || !radiusMiles) {
      setHasPermission(true);
      setIsWithinBounds(true);
      return;
    }

    if (!navigator.geolocation) {
      setHasPermission(false);
      return;
    }

    // Begin tracking position
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setHasPermission(true);
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;
        
        const dist = calcDistanceMiles(storeLat, storeLng, currentLat, currentLng);
        setDistance(dist);
        setIsWithinBounds(dist <= radiusMiles);
      },
      (error) => {
        console.error("Geolocation Error:", error);
        setHasPermission(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [storeLat, storeLng, radiusMiles]);

  // Pass-through if no fencing required
  if (!storeLat || !storeLng || !radiusMiles) {
    return <>{children}</>;
  }

  // Waiting for GPS
  if (hasPermission === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center text-slate-950">
        <div className="surface-card max-w-md p-8">
          <Navigation className="w-16 h-16 text-lime-700 mb-6 mx-auto animate-pulse" />
          <h2 className="text-2xl font-semibold mb-2">Acquiring GPS Signal...</h2>
          <p className="text-slate-500">Please wait while we verify your location for security.</p>
        </div>
      </div>
    );
  }

  // User outright denied location permissions
  if (hasPermission === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center text-slate-950">
        <div className="surface-card max-w-md p-8">
          <MapPinOff className="w-20 h-20 text-red-500 mb-6 mx-auto" />
          <h2 className="text-3xl font-semibold mb-3 text-red-600">Location Required</h2>
          <p className="text-slate-600 text-lg">
            This application requires GPS permission to ensure you are physically inside the store.
          </p>
          <p className="text-slate-500 mt-6 text-sm">Please enable location services in your browser settings and refresh the page.</p>
        </div>
      </div>
    );
  }

  // Employee is outside the barrier map
  if (!isWithinBounds) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center text-slate-950">
        <div className="surface-card max-w-lg p-8">
          <AlertTriangle className="w-24 h-24 text-amber-500 mb-6 mx-auto" />
          <h2 className="text-4xl font-semibold mb-4 tracking-tight">Out of bounds</h2>
          <p className="text-slate-600 text-xl mb-2">
            You are currently <strong>{distance?.toFixed(2)} miles</strong> away.
          </p>
          <p className="text-slate-500">
            You are not allowed to use this application outside of the authorized {radiusMiles}-mile store radius.
          </p>
        </div>
      </div>
    );
  }

  // Good to go!
  return <>{children}</>;
};
