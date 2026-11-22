import type { ReactNode } from 'react'
import { UserAvatar } from './UserAvatar'

/** A person's formal profile: photo, name, role, contact details and dates, with actions at the foot. */
export function ProfileCard({ name, role, roleTone = 'brand', avatarPath, details, badge, children }: {
  name: string
  role: string
  roleTone?: 'brand' | 'muted' | 'ok'
  avatarPath?: string | null
  details: [label: string, value: ReactNode][]
  badge?: ReactNode
  children?: ReactNode
}) {
  const tone = roleTone === 'brand' ? 'bg-brand text-white' : roleTone === 'ok' ? 'bg-ok/15 text-ok' : 'bg-ink/10 text-ink'
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-line bg-white/80 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]">
      <header className="flex items-center gap-4">
        <UserAvatar path={avatarPath} className="h-16 w-16 shrink-0 ring-2 ring-white" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold leading-tight">{name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-[0.12em] ${tone}`}>{role}</span>
            {badge}
          </div>
        </div>
      </header>
      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
        {details.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="min-w-0 truncate text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {children ? <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-4">{children}</div> : null}
    </article>
  )
}

/** A short date: 22 Nov 2026. */
export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' }) : '—'

/** Phone with its verification state. */
export function PhoneValue({ phone, verified }: { phone: string | null; verified: boolean }) {
  if (!phone) return <span className="text-muted">Not added</span>
  return <>{phone} <span className={`ml-1 text-xs ${verified ? 'text-ok' : 'text-muted'}`}>{verified ? 'Verified' : 'Not verified'}</span></>
}
