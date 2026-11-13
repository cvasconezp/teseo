// Iconos de trazo de la vista Cielo (SVG en línea, heredan el color del texto).
const P = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  layers: <><path d="m12 3.5 8.5 4.6L12 12.7 3.5 8.1 12 3.5Z" /><path d="m4 12.2 8 4.3 8-4.3" /><path d="m4 16.2 8 4.3 8-4.3" /></>,
  pin: <><path d="M12 21s6.5-5.8 6.5-11a6.5 6.5 0 0 0-13 0C5.5 15.2 12 21 12 21Z" /><circle cx="12" cy="10" r="2.3" /></>,
  tour: <><circle cx="12" cy="12" r="8.5" /><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.2V12l3.2 2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  target: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" /></>,
  camera: <><path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10.5H4V8.5Z" /><circle cx="12" cy="13.4" r="3.2" /></>,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  shrink: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  share: <><path d="M12 15V4" /><path d="m7.5 8 4.5-4.5L16.5 8" /><path d="M5 12.5V20h14v-7.5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  warn: <><path d="M12 4 2.8 19.5h18.4L12 4Z" /><path d="M12 10v4.5M12 17.2v.2" /></>,
  retry: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4.2h-4.2" /></>,
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" stroke="none" />,
  pause: <path d="M8 5.5v13M16 5.5v13" strokeWidth="2.6" />,
  prev: <path d="m14.5 6-6 6 6 6" />,
  next: <path d="m9.5 6 6 6-6 6" />,
  eye: <><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
  locate: <><circle cx="12" cy="12" r="6.2" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><path d="M12 2.5v3.3M12 18.2v3.3M2.5 12h3.3M18.2 12h3.3" /></>,
  down: <path d="m6 9.5 6 6 6-6" />,
  hand: <><path d="M9 11.5V5.2a1.6 1.6 0 0 1 3.2 0v5" /><path d="M12.2 10.2V8.6a1.6 1.6 0 0 1 3.2 0v2.2" /><path d="M15.4 11V9.9a1.5 1.5 0 0 1 3 0v4.6c0 3.6-2.4 6-6 6-2.6 0-4-1.1-5.3-3.3L5 13.6a1.5 1.5 0 0 1 2.6-1.5l1.4 2" /></>,
  sun: <><circle cx="12" cy="12" r="3.8" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></>,
  // teléfono levantado hacia una estrella (modo "Apuntar al cielo")
  point: <><rect x="4.5" y="9" width="8.5" height="12.5" rx="1.8" transform="rotate(-18 8.75 15.25)" /><path d="M17.5 2.8v5M15 5.3h5" /><path d="M20 11.5v2.6M18.7 12.8h2.6" strokeWidth="1.3" /></>,
  dots: <><circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none" /></>,
  moon: <path d="M19.5 14.2A8 8 0 1 1 9.8 4.5a6.4 6.4 0 0 0 9.7 9.7Z" />,
  planet: <><circle cx="12" cy="12" r="4.6" /><ellipse cx="12" cy="12" rx="10" ry="3.4" transform="rotate(-20 12 12)" /></>,
  meteor: <><path d="m20 4-9.5 9.5" /><path d="M20 9.5 14.5 15" strokeWidth="1.3" /><path d="M14.5 4 9 9.5" strokeWidth="1.3" /><circle cx="7" cy="17" r="3" /></>,
  sparkle: <><path d="M12 3.5c.6 4.400 2.100 5.900 6.5 6.5-4.400.6-5.900 2.100-6.5 6.5-.6-4.400-2.100-5.900-6.5-6.5 4.400-.6 5.900-2.100 6.5-6.5Z" /><path d="M18.5 16v4M16.5 18h4" strokeWidth="1.3" /></>,
  download: <><path d="M12 4v11" /><path d="m7.5 10.5 4.500 4.500 4.500-4.500" /><path d="M5 19.500h14" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1" /><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" /></>,
  info: <><circle cx="12" cy="12" r="8.500" /><path d="M12 11v5.500M12 7.600v.2" /></>,
  constellation: <><circle cx="5" cy="7" r="1.4" fill="currentColor" /><circle cx="11" cy="11" r="1.4" fill="currentColor" /><circle cx="18" cy="6" r="1.4" fill="currentColor" /><circle cx="15" cy="18" r="1.4" fill="currentColor" /><path d="m5 7 6 4 7-5M11 11l4 7" strokeWidth="1.1" /></>,
};

export default function Icon({ name, size = 20, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[name] || null}
    </svg>
  );
}
