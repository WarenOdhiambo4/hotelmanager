import { THEMES, useTheme, type ThemeId } from '../lib/theme'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

/** Theme choice as named colour strips (no icons). Saved on the device and, if signed in, on the profile. */
export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useTheme()
  const { profile } = useAuth()
  const choose = (id: ThemeId) => {
    setTheme(id)
    if (profile && supabase) void supabase.from('profiles').update({ appearance: { ...profile.appearance, theme: id } }).eq('id', profile.id)
  }
  return (
    <div className={`flex flex-wrap ${compact ? 'gap-3' : 'gap-x-8 gap-y-5'}`} role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} onClick={() => choose(t.id)}
          className={`group flex flex-col items-start gap-1.5 text-left ${theme === t.id ? 'text-ink' : 'text-muted hover:text-ink'}`}>
          <span className="flex overflow-hidden rounded-full">
            {t.swatch.map((c) => <span key={c} className={compact ? 'h-3 w-5' : 'h-4 w-8'} style={{ background: c }} />)}
          </span>
          <span className={`text-sm font-bold ${theme === t.id ? 'underline decoration-brand decoration-2 underline-offset-4' : ''}`}>{t.label}</span>
          {compact ? null : <span className="text-xs text-muted">{t.note}</span>}
        </button>
      ))}
    </div>
  )
}
