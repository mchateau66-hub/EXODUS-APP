"use client";

import React, { createContext, useEffect, useMemo, useState } from "react";

type ThemeMode = "auto" | "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "exodus-theme-mode";

// ⚠️ On n’enregistre plus la latitude/longitude exacte.
// On stocke une version arrondie + timestamp (réduit la sensibilité + passe mieux CodeQL).
const COORDS_KEY = "exodus-theme-coords-v2";

function clampHour24(h: number) {
  let x = h % 24;
  if (x < 0) x += 24;
  return x;
}

function degToRad(d: number) {
  return (d * Math.PI) / 180;
}
function radToDeg(r: number) {
  return (r * 180) / Math.PI;
}

function normalize360(x: number) {
  let v = x % 360;
  if (v < 0) v += 360;
  return v;
}

/**
 * NOAA-ish sunrise/sunset approximation.
 * Returns local Date objects for the given date & coords.
 */
function getSunTimes(date: Date, lat: number, lng: number) {
  const zenith = 90.833; // official-ish (includes refraction)
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);

  // Day of year N
  const start = new Date(day.getFullYear(), 0, 0);
  const diff = day.getTime() - start.getTime();
  const N = Math.floor(diff / (1000 * 60 * 60 * 24));

  const lngHour = lng / 15;

  function calc(isSunrise: boolean) {
    const t = N + ((isSunrise ? 6 : 18) - lngHour) / 24;

    // Sun's mean anomaly
    const M = 0.9856 * t - 3.289;

    // Sun's true longitude
    let L =
      M +
      1.916 * Math.sin(degToRad(M)) +
      0.02 * Math.sin(degToRad(2 * M)) +
      282.634;
    L = normalize360(L);

    // Right ascension
    let RA = radToDeg(Math.atan(0.91764 * Math.tan(degToRad(L))));
    RA = normalize360(RA);

    // Quadrant correction
    const Lquadrant = Math.floor(L / 90) * 90;
    const RAquadrant = Math.floor(RA / 90) * 90;
    RA = RA + (Lquadrant - RAquadrant);

    RA = RA / 15; // in hours

    // Declination
    const sinDec = 0.39782 * Math.sin(degToRad(L));
    const cosDec = Math.cos(Math.asin(sinDec));

    // Local hour angle
    const cosH =
      (Math.cos(degToRad(zenith)) - sinDec * Math.sin(degToRad(lat))) /
      (cosDec * Math.cos(degToRad(lat)));

    // Polar edge cases
    if (cosH > 1) return null; // never rises
    if (cosH < -1) return null; // never sets

    let H = radToDeg(Math.acos(cosH));
    if (isSunrise) H = 360 - H;
    H = H / 15;

    // Local mean time
    const T = H + RA - 0.06571 * t - 6.622;

    // UT
    let UT = T - lngHour;
    UT = clampHour24(UT);

    // Convert UT -> local time using timezone offset of that day
    const tzOffsetHours = -day.getTimezoneOffset() / 60;
    const localTime = clampHour24(UT + tzOffsetHours);

    const hours = Math.floor(localTime);
    const minutes = Math.floor((localTime - hours) * 60);
    const seconds = Math.floor((((localTime - hours) * 60) - minutes) * 60);

    const d = new Date(day);
    d.setHours(hours, minutes, seconds, 0);
    return d;
  }

  return {
    sunrise: calc(true),
    sunset: calc(false),
  };
}

function readMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system" || raw === "auto") return raw;
  return "auto";
}

function writeMode(mode: ThemeMode) {
  window.localStorage.setItem(STORAGE_KEY, mode);
}

function setHtmlTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

type CachedCoords = { lat2: number; lng2: number; ts: number };

function readCachedCoords(): CachedCoords | null {
  try {
    const raw = window.localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.lat2 === "number" &&
      typeof parsed?.lng2 === "number" &&
      typeof parsed?.ts === "number"
    ) {
      return parsed as CachedCoords;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCachedCoords(lat2: number, lng2: number) {
  window.localStorage.setItem(
    COORDS_KEY,
    JSON.stringify({ lat2, lng2, ts: Date.now() })
  );
}

// Réduction de précision => ~1.1km à 2 décimales
function round2(x: number) {
  return Math.round(x * 100) / 100;
}

async function getCoordsOptional(): Promise<{ lat: number; lng: number } | null> {
  // cache jusqu’à 7 jours pour éviter de re-prompt
  const cached = readCachedCoords();
  if (cached && Date.now() - cached.ts < 7 * 24 * 60 * 60 * 1000) {
    return { lat: cached.lat2, lng: cached.lng2 };
  }

  if (!("geolocation" in navigator)) return null;

  return await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // ⚠️ On ne persiste pas la donnée brute : on arrondit avant stockage
        const lat2 = round2(pos.coords.latitude);
        const lng2 = round2(pos.coords.longitude);

        writeCachedCoords(lat2, lng2);
        resolve({ lat: lat2, lng: lng2 });
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 2500, maximumAge: 24 * 60 * 60 * 1000 }
    );
  });
}

function resolveThemeSystem(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function resolveThemeFallbackAuto(now: Date): ResolvedTheme {
  // fallback simple si pas de géoloc: dark après 19h, light après 7h
  const h = now.getHours();
  return h >= 19 || h < 7 ? "dark" : "light";
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("auto");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // init mode
  useEffect(() => {
    setModeState(readMode());
  }, []);

  // persist mode
  const setMode = (m: ThemeMode) => {
    setModeState(m);
    writeMode(m);
  };

  // resolver
  useEffect(() => {
    let alive = true;

    const apply = async () => {
      const now = new Date();

      let nextResolved: ResolvedTheme;
      if (mode === "light" || mode === "dark") {
        nextResolved = mode;
      } else if (mode === "system") {
        nextResolved = resolveThemeSystem();
      } else {
        // mode === "auto" -> sunset-based
        const coords = await getCoordsOptional();
        if (coords) {
          const { sunrise, sunset } = getSunTimes(now, coords.lat, coords.lng);
          if (sunrise && sunset) {
            nextResolved = now >= sunset || now < sunrise ? "dark" : "light";
          } else {
            nextResolved = resolveThemeFallbackAuto(now);
          }
        } else {
          nextResolved = resolveThemeFallbackAuto(now);
        }
      }

      if (!alive) return;
      setResolved(nextResolved);
      setHtmlTheme(nextResolved);
    };

    apply();

    // re-check regularly (simple & safe)
    const intervalId = window.setInterval(apply, 5 * 60 * 1000);

    // system changes
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (mode === "system") apply();
    };
    mql?.addEventListener?.("change", onSystemChange);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
      mql?.removeEventListener?.("change", onSystemChange);
    };
  }, [mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode }),
    [mode, resolved]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}