// icons.jsx — iconos de trazo propios (sin emojis ni dependencias).
const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: false };
const I = (children) => function Icon(props) { return <svg {...base} {...props}>{children}</svg>; };

// Pestañas
export const IconRoute = I(<><circle cx="5" cy="18" r="2.2" /><circle cx="19" cy="6" r="2.2" /><path d="M7 17c5 0 3-9 10-10" strokeDasharray="0.1 3.1" strokeWidth="2" /></>);
export const IconWindows = I(<><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="m9 15 2 2 4-4" /></>);
export const IconSky = I(<><path d="M12 3.5l1.6 4.6 4.9.3-3.8 3 1.3 4.7-4-2.7-4 2.7 1.3-4.7-3.8-3 4.9-.3z" /><path d="M19.5 17.5v3M18 19h3M4.5 4v2M3.5 5h2" /></>);
export const IconScale = I(<><path d="M12 3v18" /><path d="M12 5h5M12 9h3M12 13h6M12 17h3" /><circle cx="12" cy="21" r="0.6" fill="currentColor" /></>);

// Vehículos
export const IconLight = I(<><path d="M13 2 5 13.5h6L10 22l9-12.5h-6z" /></>);
export const IconProbe = I(<><circle cx="9" cy="12" r="4.5" /><path d="M13.5 12H21M17 8.5l4 3.5-4 3.5M9 7.5V3M9 21v-4.5" /></>);
export const IconRocket = I(<><path d="M12 2.5c3.5 2.6 5 6.3 5 10.2L15 16H9l-2-3.3c0-3.9 1.5-7.6 5-10.2z" /><circle cx="12" cy="9.5" r="1.7" /><path d="M9.5 16l-.8 4 3.3-1.8 3.3 1.8-.8-4" /></>);
export const IconPlane = I(<><path d="M10.5 3.5c0-1 3-1 3 0V9l7.5 5v2l-7.5-2.3V18l2.5 2v1.5L12 20.3 8 21.5V20l2.5-2v-4.3L3 16v-2l7.5-5z" /></>);

// Interfaz
export const IconSwap = I(<><path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" /></>);
export const IconChevron = I(<><path d="m6 9 6 6 6-6" /></>);
export const IconRetry = I(<><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></>);
export const IconClose = I(<><path d="M6 6l12 12M18 6 6 18" /></>);
export const IconInfo = I(<><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="7.6" r="0.7" fill="currentColor" /></>);
export const IconArrow = I(<><path d="M5 12h14M13 6l6 6-6 6" /></>);
