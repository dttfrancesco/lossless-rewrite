export function UiIcon({ name, className = "" }: { name: "brand" | "leaf" | "document" | "sparkles" | "shield" | "quote" | "list" | "upload" | "pen" | "writer" | "ban" | "sun" | "bulb" | "trash" | "lines" | "chevrons"; className?: string }) {
  const paths = {
    brand: <><path d="M3 18C-1 8 7 4 22 3c-1 9-4 16-12 16Z" fill="#87c4a4" stroke="none"/><path d="M15 18c3-3 7-3 7 0s-4 4-7 0Z" fill="#b2d9c3" stroke="none"/><path d="M2 22 23 2" stroke="#267859" strokeWidth="2.1"/><path d="m6 18 11-11" stroke="#ffffff" strokeOpacity=".55" strokeWidth=".7"/></>,
    leaf: <><path d="M20 3C8 2 3 7 5 15c8 3 14-2 15-12Z"/><path d="m3 21 13-13"/></>,
    document: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h6"/></>,
    sparkles: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/><path d="M21 2v4M19 4h4"/></>,
    shield: <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/>,
    quote: <path fill="currentColor" stroke="none" d="M3 5h7v7c0 5-3 7-7 8v-3c3-1 4-2 4-4H3Zm11 0h7v7c0 5-3 7-7 8v-3c3-1 4-2 4-4h-4Z"/>,
    list: <><path d="M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01"/></>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/></>,
    pen: <><path d="m4 16 12-12 4 4L8 20H4Zm10-10 4 4"/></>,
    writer: <><path d="M12 4C10 1 6 2 5 5c-3 0-4 4-2 6-2 2-1 5 1 6-1 4 5 6 8 3 3 3 9 1 8-3 2-1 3-4 1-6 2-2 1-6-2-6-1-3-5-4-7-1Z"/><path d="M12 4v16M5 5c2 0 3 1 3 3M3 11h3m1 4c3 0 5 2 5 5M19 5c-2 0-3 1-3 3m5 3h-3m-1 4c-3 0-5 2-5 5"/></>,
    ban: <><circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,
    bulb: <><path d="M8 16c0-3-3-3-3-7a7 7 0 0 1 14 0c0 4-3 4-3 7Zm0 3h8m-6 3h4"/></>,
    trash: <><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></>,
    lines: <path d="M3 4h18M3 10h15M3 16h16M3 22h10" strokeWidth="2.4"/>,
    chevrons: <path d="m8 9 4-4 4 4m-8 6 4 4 4-4"/>,
  };
  return <svg className={`ui-icon ${className}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
