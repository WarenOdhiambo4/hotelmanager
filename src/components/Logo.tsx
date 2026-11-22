/**
 * Campus Food logo, drawn in the style of the brief's reference: a chef's hat resting on an orange
 * swoosh, a fork and spoon rising on the right, a golden swoosh underneath with a leaf, and the
 * name set as a bold word over a script word. Pure SVG, so it stays sharp and follows the theme.
 */
export function LogoMark({ className = 'h-11 w-11', title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id="cfOrange" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff9a3c" />
          <stop offset="1" stopColor="#e8590c" />
        </linearGradient>
        <linearGradient id="cfGold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f5b301" />
          <stop offset="1" stopColor="#ffd34d" />
        </linearGradient>
      </defs>
      {/* Upper orange swoosh */}
      <path d="M22 60C22 34 44 15 70 17c-20 4-36 20-38 43Z" fill="url(#cfOrange)" />
      {/* Lower golden swoosh */}
      <path d="M26 74c8 22 34 34 58 26 11-4 20-12 25-22-10 14-30 22-50 18-14-3-26-11-33-22Z" fill="url(#cfGold)" />
      {/* Leaf */}
      <path d="M104 64c-7-1-12 3-13 9 7 1 12-3 13-9Z" fill="#f59e0b" />
      {/* Chef's hat */}
      <path d="M14 40c-6-2-8-10-3-14 3-3 8-3 11 0 1-6 8-9 13-6 4-5 12-4 15 2 6-1 10 5 7 10-2 3-5 4-8 4l-2 9H19l-2-6c-1 0-2 1-3 1Z" fill="#fff" stroke="#f5b301" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M19 45h29" stroke="#f5b301" strokeWidth="2.2" strokeLinecap="round" />
      {/* Fork */}
      <g fill="url(#cfOrange)">
        <rect x="76" y="14" width="3" height="16" rx="1.5" />
        <rect x="81" y="14" width="3" height="16" rx="1.5" />
        <rect x="86" y="14" width="3" height="16" rx="1.5" />
        <path d="M75 28h15c0 5-3 8-6 8v20h-3V36c-3 0-6-3-6-8Z" />
        {/* Spoon */}
        <ellipse cx="99" cy="24" rx="6" ry="9" />
        <rect x="97.5" y="31" width="3" height="25" rx="1.5" />
      </g>
      {/* Plate rim */}
      <circle cx="62" cy="64" r="20" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.9" />
      <circle cx="62" cy="64" r="12" fill="none" stroke="url(#cfOrange)" strokeWidth="2" />
    </svg>
  )
}

export function Logo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const mark = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'
  const word = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-2xl'
  return (
    <span className={`inline-flex items-center gap-2 text-ink ${className}`}>
      <LogoMark className={mark} />
      <span className="flex flex-col leading-none">
        <span className={`font-display ${word} tracking-wide`}>CAMPUS</span>
        <span className={`font-script -mt-1 text-brand ${size === 'lg' ? 'text-3xl' : 'text-lg'}`}>Food</span>
      </span>
    </span>
  )
}
