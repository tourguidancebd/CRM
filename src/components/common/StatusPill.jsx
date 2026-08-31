import { paymentStatus } from '../../utils/calculations'

export function StatusPill({ grandTotal, received, label, color }) {
  let status

  if (label && color) {
    status = {
      label,
      color,
      bg: color === 'paid' ? 'rgba(47,212,184,0.18)' : color === 'partial' ? 'rgba(232,169,59,0.18)' : 'rgba(239,100,97,0.18)',
      text: color === 'paid' ? 'var(--teal)' : color === 'partial' ? '#E8A93B' : 'var(--red)',
      border: color === 'paid' ? '1px solid rgba(47,212,184,0.4)' : color === 'partial' ? '1px solid rgba(232,169,59,0.45)' : '1px solid rgba(239,100,97,0.45)'
    }
  } else {
    const total = parseFloat(grandTotal) || 0
    const rec = parseFloat(received) || 0
    const due = total - rec

    if (due <= 0 && total > 0) {
      status = {
        label: 'Paid',
        color: 'paid',
        bg: 'rgba(47,212,184,0.18)',
        text: 'var(--teal)',
        border: '1px solid rgba(47,212,184,0.4)'
      }
    } else if (rec > 0) {
      status = {
        label: 'Adv Payment',
        color: 'partial',
        bg: 'rgba(232,169,59,0.20)',
        text: '#F59E0B',
        border: '1px solid rgba(245,158,11,0.5)'
      }
    } else {
      status = {
        label: 'Due',
        color: 'due',
        bg: 'rgba(239,100,97,0.20)',
        text: '#EF6461',
        border: '1px solid rgba(239,100,97,0.5)'
      }
    }
  }

  return (
    <span
      className={`pill pill-${status.color}`}
      style={{
        background: status.bg,
        color: status.text,
        border: status.border,
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: '12px',
        fontSize: '0.72rem',
        letterSpacing: '0.4px',
        display: 'inline-block',
        whiteSpace: 'nowrap'
      }}
    >
      {status.label}
    </span>
  )
}

export function ActivePill({ active }) {
  return (
    <span
      className={`pill ${active ? 'pill-active' : 'pill-inactive'}`}
      style={{
        background: active ? 'rgba(47,212,184,0.18)' : 'rgba(239,100,97,0.18)',
        color: active ? 'var(--teal)' : 'var(--red)',
        border: active ? '1px solid rgba(47,212,184,0.4)' : '1px solid rgba(239,100,97,0.4)',
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: '12px',
        fontSize: '0.72rem',
        letterSpacing: '0.4px',
        display: 'inline-block'
      }}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}
