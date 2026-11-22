import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { DishShelf, DishTile } from '../../components/DishShelf'
import { FoodImage } from '../../components/FoodImage'
import { HeaderActions, Sheet } from '../../components/HeaderBar'
import { Checkbox, Notice, TextArea, TextField } from '../../components/form'
import { useLoad } from '../../lib/data'
import { setTitle } from '../../lib/site'
import { db, friendly, uploadImage } from '../../lib/supabase'
import type { MenuCategory, MenuItem } from '../../lib/types'
import { fieldErrors, menuItemSchema, type FieldErrors } from '../../lib/validation'
import { useVendor } from './VendorLayout'

type Form = { name: string; description: string; price: string; categoryId: string; badge: string; isSignature: boolean; isAvailable: boolean }
const blank: Form = { name: '', description: '', price: '', categoryId: '', badge: '', isSignature: false, isAvailable: true }
const NEW_CATEGORY = '__new__'

/**
 * Dishes and prices. The body shows only the dishes (photo shelves per category). "Add a dish"
 * and "Categories" sit in the header bar and open side sheets. Price changes are recorded.
 */
export function VendorMenu() {
  const { vendor } = useVendor()
  useEffect(() => setTitle('Dishes and prices'), [])
  const { data, reload } = useLoad(async () => {
    const [i, c] = await Promise.all([
      db().from('menuItems').select('*').eq('vendorId', vendor!.id).order('sortOrder').order('name'),
      db().from('menuCategories').select('*').eq('vendorId', vendor!.id).order('sortOrder').order('name'),
    ])
    if (i.error) throw i.error
    if (c.error) throw c.error
    return { items: (i.data ?? []) as MenuItem[], categories: (c.data ?? []) as MenuCategory[] }
  }, { items: [] as MenuItem[], categories: [] as MenuCategory[] }, [vendor?.id])

  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [pricesOpen, setPricesOpen] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const close = useCallback(() => setEditing(null), [])

  async function toggle(item: MenuItem) {
    const { error } = await db().from('menuItems').update({ isAvailable: !item.isAvailable }).eq('id', item.id)
    if (error) setProblem(friendly(error)); else reload()
  }

  const shelves = [
    ...data.categories.map((c) => ({ key: c.id, cat: c as MenuCategory | null, title: c.name, items: data.items.filter((i) => i.categoryId === c.id) })),
    { key: 'none', cat: null, title: data.categories.length ? 'No category yet' : 'Your dishes', items: data.items.filter((i) => !i.categoryId || !data.categories.some((c) => c.id === i.categoryId)) },
  ].filter((x) => x.items.length)

  return (
    <div className="mt-2">
      <h2 className="sr-only">Dishes and prices</h2>
      <HeaderActions>
        <button type="button" className="btn" onClick={() => setEditing('new')}>+ Dish</button>
        <button type="button" className="btn btn-ghost" onClick={() => setCategoriesOpen(true)}>Categories · {data.categories.length}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setPricesOpen(true)} disabled={!data.items.length}>Prices</button>
        <span className="ml-auto self-center text-xs text-muted">{data.items.length} dishes · {data.items.filter((i) => !i.isAvailable).length} sold out</span>
      </HeaderActions>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      
      {shelves.map((shelf) => (
        <DishShelf key={shelf.key} title={`${shelf.title} · ${shelf.items.length}`}>
          {shelf.items.map((it) => (
            <DishTile key={it.id} item={it} meta={it.isSignature ? 'Signature dish' : undefined}
              actions={<>
                <QuickPrice item={it} onSaved={reload} onError={setProblem} />
                <button type="button" className="btn" onClick={() => setEditing(it)}>Edit</button>
                <button type="button" onClick={() => toggle(it)} className={`text-[0.7rem] font-extrabold uppercase tracking-wide ${it.isAvailable ? 'text-ok' : 'text-danger'}`}>
                  {it.isAvailable ? 'Available' : 'Sold out'}
                </button>
              </>} />
          ))}
        </DishShelf>
      ))}

      <Sheet open={editing !== null} title={editing && editing !== 'new' ? `Edit ${editing.name}` : 'Add a dish'} onClose={close}>
        {editing ? (
          <DishForm key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? null : editing} categories={data.categories} vendorId={vendor!.id}
            onDone={() => { setEditing(null); reload() }} onCancel={close} />
        ) : null}
      </Sheet>
      <Sheet open={pricesOpen} title="Change prices" onClose={() => setPricesOpen(false)}>
        <BulkPrices items={data.items} categories={data.categories} onDone={reload} />
      </Sheet>
      <Sheet open={categoriesOpen} title="Categories" onClose={() => setCategoriesOpen(false)}>
        <Categories vendorId={vendor!.id} categories={data.categories} items={data.items} onChange={reload} />
      </Sheet>
    </div>
  )
}

/** Every category, including empty ones, with its photo; add new ones here or from the dish form. */
function Categories({ vendorId, categories, items, onChange }: { vendorId: string; categories: MenuCategory[]; items: MenuItem[]; onChange: () => void }) {
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  async function add(e: FormEvent) {
    e.preventDefault(); setMsg(null)
    const { error } = await db().from('menuCategories').insert({ vendorId, name: name.trim(), sortOrder: categories.length })
    if (error) { setMsg({ tone: 'error', text: /duplicate|unique/i.test(error.message) ? 'You already have a category with that name.' : friendly(error) }); return }
    setName(''); setMsg({ tone: 'success', text: 'Category added.' }); onChange()
  }
  async function photo(c: MenuCategory, file: File | undefined) {
    if (!file) return
    setMsg(null)
    try {
      const imagePath = await uploadImage(`vendors/${vendorId}/categories`, file)
      const { error } = await db().from('menuCategories').update({ imagePath }).eq('id', c.id)
      if (error) throw error
      onChange()
    } catch (err) { setMsg({ tone: 'error', text: friendly(err) }) }
  }
  async function remove(c: MenuCategory) {
    if (!window.confirm(`Remove the category ${c.name}? Its dishes stay on the menu without a category.`)) return
    const { error } = await db().from('menuCategories').delete().eq('id', c.id)
    if (error) setMsg({ tone: 'error', text: friendly(error) }); else onChange()
  }
  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={add} className="flex items-end gap-2">
        <TextField label="New category" value={name} onChange={setName} placeholder="Breakfast, Mains, Drinks…" className="flex-1" />
        <button type="submit" className="btn" disabled={!name.trim()}>Add</button>
      </form>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
        {categories.map((c) => (
          <div key={c.id} className="flex flex-col gap-1.5">
            <label className="cursor-pointer">
              <FoodImage path={c.imagePath} name={c.name} width={300} className="aspect-square w-full !rounded-[1rem]" />
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => photo(c, e.target.files?.[0])} />
            </label>
            <p className="text-sm font-extrabold">{c.name}</p>
            <p className="text-xs text-muted">{items.filter((i) => i.categoryId === c.id).length} dishes</p>
            <button type="button" className="self-start text-xs font-bold text-danger" onClick={() => remove(c)}>Remove</button>
          </div>
        ))}
      </div>
      
    </div>
  )
}

function DishForm({ item, categories, vendorId, onDone, onCancel }: { item: MenuItem | null; categories: MenuCategory[]; vendorId: string; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<Form>(item ? {
    name: item.name, description: item.description ?? '', price: String(item.price), categoryId: item.categoryId ?? '',
    badge: item.badge ?? '', isSignature: item.isSignature, isAvailable: item.isAvailable,
  } : blank)
  const [newCategory, setNewCategory] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dropPhoto, setDropPhoto] = useState(false)
  const [errors, setErrors] = useState<FieldErrors<Form>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const preview = file ? URL.createObjectURL(file) : null

  async function save(e: FormEvent) {
    e.preventDefault()
    const parsed = menuItemSchema.safeParse({ ...form, categoryId: form.categoryId === NEW_CATEGORY ? '' : form.categoryId })
    if (!parsed.success) { setErrors(fieldErrors<Form>(parsed.error)); return }
    if (form.categoryId === NEW_CATEGORY && !newCategory.trim()) { setProblem('Type the new category name, or pick an existing one.'); return }
    setErrors({}); setBusy(true); setProblem(null)
    try {
      // A new category typed here is created first, so it can never get lost.
      let categoryId = parsed.data.categoryId || null
      if (form.categoryId === NEW_CATEGORY) {
        const { data: cat, error } = await db().from('menuCategories').insert({ vendorId, name: newCategory.trim(), sortOrder: categories.length }).select('id').single()
        if (error) throw error
        categoryId = (cat as { id: string }).id
      }
      const imagePath = file ? await uploadImage(`vendors/${vendorId}/menu`, file) : dropPhoto ? null : item?.imagePath ?? null
      const row = {
        name: parsed.data.name, description: parsed.data.description || null, price: parsed.data.price,
        categoryId, badge: parsed.data.badge || null, isSignature: parsed.data.isSignature, isAvailable: parsed.data.isAvailable, imagePath,
      }
      const { error } = item ? await db().from('menuItems').update(row).eq('id', item.id) : await db().from('menuItems').insert({ ...row, vendorId })
      if (error) throw error
      onDone()
    } catch (err) {
      setProblem(/duplicate|unique/i.test(String((err as Error)?.message)) ? 'You already have a category with that name; pick it from the list.' : friendly(err))
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!item || !window.confirm(`Remove ${item.name} from the menu? Past orders keep their record.`)) return
    const { error } = await db().from('menuItems').delete().eq('id', item.id)
    if (error) setProblem(friendly(error)); else onDone()
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-6">
      <label className="flex cursor-pointer items-end gap-4">
        {preview ? <img src={preview} alt="" className="aspect-[5/6] w-36 rounded-[1.25rem] object-cover" /> : <FoodImage path={item?.imagePath} name={form.name || 'Dish'} width={420} className="aspect-[5/6] w-36 !rounded-[1.25rem]" />}
        <span className="flex flex-col gap-1">
          <span className="link text-sm font-bold">{item?.imagePath || file ? 'Change photo' : 'Add a photo'}</span>
          <span className="story text-xs text-muted">Bright, close-up. JPG, PNG or WebP up to 5 MB.</span>
        </span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setDropPhoto(false) }} />
      </label>
      {item?.imagePath && !file ? (
        <Checkbox label="Remove the current photo when I save" checked={dropPhoto} onChange={setDropPhoto} />
      ) : null}
      <TextField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} error={errors.name} />
      <TextArea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={2} />
      <div className="grid grid-cols-2 gap-6">
        <TextField label="Price (KES)" inputMode="decimal" value={form.price} onChange={(v) => setForm({ ...form, price: v })} error={errors.price}
          hint={item ? 'Old orders keep their price.' : undefined} />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-muted" htmlFor="dish-category">Category</label>
          <select id="dish-category" className="field" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value={NEW_CATEGORY}>+ New category…</option>
          </select>
        </div>
      </div>
      {form.categoryId === NEW_CATEGORY ? <TextField label="New category name" value={newCategory} onChange={setNewCategory} placeholder="Breakfast, Mains, Drinks…" /> : null}
      <TextField label="Badge (optional)" value={form.badge} onChange={(v) => setForm({ ...form, badge: v })} placeholder="Signature Dish, Hot & Spicy…" maxLength={24} />
      <Checkbox label="Signature dish (featured on the home page)" checked={form.isSignature} onChange={(v) => setForm({ ...form, isSignature: v })} />
      <Checkbox label="Available to order" checked={form.isAvailable} onChange={(v) => setForm({ ...form, isAvailable: v })} />
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save dish'}</button>
        <button type="button" className="link font-bold" onClick={onCancel}>Cancel</button>
        {item ? <button type="button" className="ml-auto text-sm font-bold text-danger" onClick={remove}>Remove</button> : null}
      </div>
    </form>
  )
}

/** Change one dish's price straight from its tile. The database records every change in price history. */
function QuickPrice({ item, onSaved, onError }: { item: MenuItem; onSaved: () => void; onError: (m: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(item.price))
  async function save(e: FormEvent) {
    e.preventDefault()
    const price = Number(value)
    if (!(price > 0 && price <= 100000)) { onError('Enter a price between 1 and 100,000 shillings.'); return }
    const { error } = await db().from('menuItems').update({ price }).eq('id', item.id)
    if (error) { onError(friendly(error)); return }
    onError(null); setOpen(false); onSaved()
  }
  if (!open) return <button type="button" className="btn btn-ghost" onClick={() => { setValue(String(item.price)); setOpen(true) }}>Price</button>
  return (
    <form onSubmit={save} className="flex items-center gap-1.5">
      <input className="field !w-20 !py-1 !text-sm" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} aria-label={`New price for ${item.name} in shillings`} autoFocus />
      <button type="submit" className="btn !px-2.5 !py-1">Save</button>
      <button type="button" className="text-xs font-bold text-muted" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  )
}

/** Raise or lower many prices at once: every dish or one category, by a percentage or a fixed amount, rounded to the nearest 5 shillings. */
function BulkPrices({ items, categories, onDone }: { items: MenuItem[]; categories: MenuCategory[]; onDone: () => void }) {
  const [scope, setScope] = useState('all')
  const [mode, setMode] = useState<'percent' | 'amount'>('percent')
  const [change, setChange] = useState('10')
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const chosen = items.filter((i) => scope === 'all' || i.categoryId === scope)
  const n = Number(change)
  const next = (p: number) => Math.max(5, Math.round((mode === 'percent' ? p * (1 + n / 100) : p + n) / 5) * 5)
  const valid = Number.isFinite(n) && n !== 0 && (mode === 'amount' || n > -90)
  async function apply(e: FormEvent) {
    e.preventDefault()
    if (!valid || !chosen.length) return
    if (!window.confirm(`Change ${chosen.length} price${chosen.length === 1 ? '' : 's'}? Orders already placed keep their old price.`)) return
    setBusy(true); setMsg(null)
    try {
      for (const it of chosen) {
        const price = next(Number(it.price))
        if (price === Number(it.price)) continue
        const { error } = await db().from('menuItems').update({ price }).eq('id', it.id)
        if (error) throw error
      }
      setMsg({ tone: 'success', text: `Updated ${chosen.length} price${chosen.length === 1 ? '' : 's'}.` }); onDone()
    } catch (err) { setMsg({ tone: 'error', text: friendly(err) }) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={apply} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-[0.14em] text-muted" htmlFor="bulk-scope">Which dishes</label>
        <select id="bulk-scope" className="field" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="all">Every dish ({items.length})</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({items.filter((i) => i.categoryId === c.id).length})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-muted" htmlFor="bulk-mode">Change by</label>
          <select id="bulk-mode" className="field" value={mode} onChange={(e) => setMode(e.target.value as 'percent' | 'amount')}>
            <option value="percent">Percentage</option>
            <option value="amount">Shillings</option>
          </select>
        </div>
        <TextField label={mode === 'percent' ? 'Percent (use - to lower)' : 'Shillings (use - to lower)'} inputMode="decimal" value={change} onChange={setChange} />
      </div>
      {valid && chosen.length ? (
        <ul className="flex max-h-64 flex-col gap-1 overflow-auto text-sm">
          {chosen.map((it) => (
            <li key={it.id} className="flex justify-between gap-3"><span className="truncate">{it.name}</span><span className="shrink-0 tabular-nums"><span className="text-muted line-through">{Number(it.price)}</span> → <strong>{next(Number(it.price))}</strong></span></li>
          ))}
        </ul>
      ) : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <button type="submit" className="btn self-start" disabled={busy || !valid || !chosen.length}>{busy ? 'Saving…' : 'Apply new prices'}</button>
    </form>
  )
}
