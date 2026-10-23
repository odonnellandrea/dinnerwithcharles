import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeCode, formatCents } from '../lib/referral'

const KINDS = {
  referral: { label: 'Referral', hint: 'A customer shares it. A friend gets money off, and the customer earns credit.', newDollars: 10, ownerDollars: 10 },
  promo: { label: 'Promo', hint: 'A discount for anyone who has it, such as a flyer or event.', newDollars: 10, ownerDollars: 0 },
  business: { label: 'Business', hint: 'Someone from a company signs up with it, and the company earns a larger credit to order for the team.', newDollars: 0, ownerDollars: 100 }
}

// No 0/O or 1/I, so a code read out loud or off a flyer isn't mistyped
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const randomCode = () => Array.from(crypto.getRandomValues(new Uint32Array(6)), n => ALPHABET[n % ALPHABET.length]).join('')

const field = { width: '100%', padding: '10px', border: '1px solid #e0dbd1', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '14px', background: 'white' }
const label = { display: 'block', margin: '14px 0 6px', fontSize: '13px', fontWeight: '600', color: '#1a441f' }
const card = { background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }

const toCents = (dollars) => Math.round(parseFloat(String(dollars).replace(/[$,]/g, '') || '0') * 100)

export default function ReferralCodesDashboard() {
  const [codes, setCodes] = useState([])
  const [users, setUsers] = useState([])
  const [discounts, setDiscounts] = useState([])
  const [credits, setCredits] = useState([])
  const [status, setStatus] = useState('Loading...')
  const [form, setForm] = useState({ code: '', kind: 'referral', label: '', owner: '', newDollars: '10', ownerDollars: '10', maxUses: '', expires: '' })
  const [creditForm, setCreditForm] = useState({ email: '', dollars: '', note: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const codesResult = await supabase.from('referral_codes').select('*').order('created_at', { ascending: false })
    if (codesResult.error) {
      setStatus(/referral_codes|relation|schema cache/.test(codesResult.error.message || '')
        ? 'Codes are not set up yet. Run supabase/migrations/20261022_referral_codes.sql in the Supabase SQL editor, then reload.'
        : 'Could not load the codes: ' + codesResult.error.message)
      return
    }
    const [usersResult, discountsResult, creditsResult] = await Promise.all([
      supabase.from('users').select('email, first_name, last_name, name, referral_code').not('referral_code', 'is', null),
      supabase.from('order_discounts').select('*'),
      supabase.from('referral_credits').select('*').order('created_at', { ascending: false })
    ])
    setCodes(codesResult.data || [])
    setUsers((usersResult.data || []).filter(u => u.referral_code))
    setDiscounts(discountsResult.data || [])
    setCredits(creditsResult.data || [])
    setStatus('')
  }, [])

  useEffect(() => { load() }, [load])

  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const chooseKind = (kind) => setForm(f => ({ ...f, kind, newDollars: String(KINDS[kind].newDollars), ownerDollars: String(KINDS[kind].ownerDollars) }))

  const createCode = async () => {
    const code = normalizeCode(form.code)
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) { alert('The code needs 3 to 30 letters or numbers, with no spaces.'); return }
    if (codes.some(c => c.code.toUpperCase() === code)) { alert('That code already exists.'); return }
    if (form.ownerDollars && toCents(form.ownerDollars) > 0 && !form.owner.trim()) { alert('Add the email of the person or business who earns the credit, or set their credit to 0.'); return }
    setSaving(true)
    const { error } = await supabase.from('referral_codes').insert({
      code,
      kind: form.kind,
      label: form.label.trim(),
      owner_email: form.owner.trim().toLowerCase() || null,
      new_customer_discount_cents: toCents(form.newDollars),
      owner_credit_cents: toCents(form.ownerDollars),
      max_uses: form.maxUses ? parseInt(form.maxUses, 10) : null,
      expires_at: form.expires ? new Date(`${form.expires}T23:59:59`).toISOString() : null
    })
    setSaving(false)
    if (error) { alert('Could not create the code: ' + error.message); return }
    setForm(f => ({ ...f, code: '', label: '', owner: '', maxUses: '', expires: '' }))
    await load()
  }

  const toggleActive = async (code) => {
    const { error } = await supabase.from('referral_codes').update({ active: !code.active }).eq('id', code.id)
    if (error) alert('Could not update the code: ' + error.message)
    else await load()
  }

  const addCredit = async () => {
    const cents = toCents(creditForm.dollars)
    if (!creditForm.email.trim() || !(cents > 0)) { alert("Enter the customer's email and a credit amount above $0."); return }
    const { error } = await supabase.from('referral_credits').insert({
      owner_email: creditForm.email.trim().toLowerCase(),
      amount_cents: cents,
      note: creditForm.note.trim() || 'Added by hand'
    })
    if (error) { alert('Could not add the credit: ' + error.message); return }
    setCreditForm({ email: '', dollars: '', note: '' })
    await load()
  }

  const nameOf = (email) => {
    const u = users.find(x => String(x.email).toLowerCase() === String(email).toLowerCase())
    return u ? (u.name || [u.first_name, u.last_name].filter(Boolean).join(' ')) : ''
  }

  const usage = (code) => {
    const joined = users.filter(u => String(u.referral_code).toUpperCase() === code.code.toUpperCase())
    const given = discounts.filter(d => d.kind === 'new_customer' && String(d.code || '').toUpperCase() === code.code.toUpperCase())
    return { joined, given: given.reduce((n, d) => n + d.amount_cents, 0) }
  }

  const unspentByOwner = credits.filter(c => !c.spent_order_id).reduce((map, c) => {
    const key = String(c.owner_email).toLowerCase()
    map[key] = (map[key] || 0) + c.amount_cents
    return map
  }, {})

  if (status) {
    return (
      <div>
        <h2 style={{ color: '#1a441f', marginBottom: '20px' }}>Codes</h2>
        <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.6 }}>{status}</p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ color: '#1a441f', marginBottom: '20px' }}>Codes</h2>

      <div style={card}>
        <h3 style={{ color: '#1a441f', marginTop: 0, marginBottom: '4px' }}>New code</h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#666', lineHeight: 1.6 }}>
          Customers type it on the join form. The new customer's discount comes off their first order, automatically. If someone earns credit from it, that credit comes off their next order.
        </p>

        <label style={label}>Type</label>
        <select value={form.kind} onChange={(e) => chooseKind(e.target.value)} style={field}>
          {Object.entries(KINDS).map(([key, kind]) => <option key={key} value={key}>{kind.label}</option>)}
        </select>
        <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#999' }}>{KINDS[form.kind].hint}</p>

        <label style={label}>Code</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={form.code} onChange={(e) => setField('code', e.target.value)} placeholder="e.g. JIAQI10" autoCapitalize="characters" style={{ ...field, textTransform: 'uppercase' }} />
          <button type="button" onClick={() => setField('code', randomCode())} style={{ padding: '10px 14px', background: 'white', color: '#1a441f', border: '1px solid #1a441f', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Make one</button>
        </div>

        <label style={label}>Note for yourself</label>
        <input value={form.label} onChange={(e) => setField('label', e.target.value)} placeholder="e.g. Jiaqi's code, or Fall flyer" style={field} />

        <label style={label}>New customer gets ($ off their first order)</label>
        <input value={form.newDollars} onChange={(e) => setField('newDollars', e.target.value)} inputMode="decimal" style={field} />

        <label style={label}>Who earns credit when someone uses it? (email)</label>
        <input value={form.owner} onChange={(e) => setField('owner', e.target.value)} placeholder="Leave blank for none" type="email" style={field} />

        <label style={label}>Credit they earn ($ off their next order)</label>
        <input value={form.ownerDollars} onChange={(e) => setField('ownerDollars', e.target.value)} inputMode="decimal" style={field} />

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Most people (optional)</label>
            <input value={form.maxUses} onChange={(e) => setField('maxUses', e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="No limit" style={field} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Expires (optional)</label>
            <input type="date" value={form.expires} onChange={(e) => setField('expires', e.target.value)} style={field} />
          </div>
        </div>

        <button onClick={createCode} disabled={saving} style={{ width: '100%', marginTop: '20px', padding: '12px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: saving ? 'wait' : 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Create code'}
        </button>
      </div>

      <div style={card}>
        <h3 style={{ color: '#1a441f', marginTop: 0, marginBottom: '12px' }}>All codes</h3>
        {codes.length === 0 && <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>No codes yet.</p>}
        {codes.map(code => {
          const { joined, given } = usage(code)
          return (
            <div key={code.id} style={{ padding: '14px 0', borderTop: '1px solid #f0ece3', opacity: code.active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1a441f', letterSpacing: '0.04em' }}>
                  {code.code} <span style={{ fontSize: '11px', fontWeight: '600', color: '#D4A373', letterSpacing: '0.12em', textTransform: 'uppercase', marginLeft: '6px' }}>{KINDS[code.kind]?.label || code.kind}{code.active ? '' : ' · paused'}</span>
                </p>
                <button onClick={() => toggleActive(code)} style={{ padding: '4px 12px', background: 'white', color: '#1a441f', border: '1px solid #1a441f', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
                  {code.active ? 'Pause' : 'Resume'}
                </button>
              </div>
              {code.label && <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>{code.label}</p>}
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#666', lineHeight: 1.6 }}>
                New customer: {formatCents(code.new_customer_discount_cents)} off
                {code.owner_credit_cents > 0 && <> · {code.owner_email || 'owner'} earns {formatCents(code.owner_credit_cents)} credit</>}
                {code.max_uses != null && <> · limit {code.max_uses}</>}
                {code.expires_at && <> · expires {new Date(code.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#333' }}>
                Joined with it: <strong>{joined.length}</strong> · Discounts given: <strong>{formatCents(given)}</strong>
              </p>
              {joined.length > 0 && (
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#999', lineHeight: 1.6 }}>
                  {joined.map(u => u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email).join(', ')}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div style={card}>
        <h3 style={{ color: '#1a441f', marginTop: 0, marginBottom: '4px' }}>Credits</h3>
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#666', lineHeight: 1.6 }}>
          Credit comes off the owner's next order, automatically, up to what the food costs. The rest waits for the order after.
        </p>
        {Object.keys(unspentByOwner).length === 0 && <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#666' }}>No unspent credit.</p>}
        {Object.entries(unspentByOwner).map(([email, cents]) => (
          <p key={email} style={{ margin: '0 0 6px', fontSize: '14px', color: '#333' }}>
            <strong>{nameOf(email) || email}</strong>{nameOf(email) && <span style={{ color: '#999' }}> · {email}</span>}: {formatCents(cents)} waiting
          </p>
        ))}

        <h4 style={{ margin: '20px 0 0', color: '#1a441f', fontSize: '14px' }}>Add credit by hand</h4>
        <label style={label}>Customer email</label>
        <input type="email" value={creditForm.email} onChange={(e) => setCreditForm(f => ({ ...f, email: e.target.value }))} style={field} />
        <label style={label}>Amount ($)</label>
        <input value={creditForm.dollars} onChange={(e) => setCreditForm(f => ({ ...f, dollars: e.target.value }))} inputMode="decimal" style={field} />
        <label style={label}>Note</label>
        <input value={creditForm.note} onChange={(e) => setCreditForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Team lunch deposit" style={field} />
        <button onClick={addCredit} style={{ marginTop: '14px', padding: '10px 20px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit' }}>Add credit</button>

        {credits.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h4 style={{ margin: '0 0 8px', color: '#1a441f', fontSize: '14px' }}>History</h4>
            {credits.slice(0, 30).map(c => (
              <p key={c.id} style={{ margin: '0 0 6px', fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
                {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {c.owner_email} · {formatCents(c.amount_cents)} · {c.spent_order_id ? 'used on an order' : 'waiting'}{c.note ? ` · ${c.note}` : ''}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
