import { paymentStatus } from '../../utils/calculations'

export function StatusPill({ grandTotal, received, label, color }) {
  // Allow either raw status label+color or computed from invoice amounts
  let status
  if (label && color) {
    status = { label, color }
  } else {
    status = paymentStatus(grandTotal, received)
  }

  return (
    <span className={`pill pill-${status.color}`}>
      {status.label}
    </span>
  )
}

export function ActivePill({ active }) {
  return (
    <span className={`pill ${active ? 'pill-active' : 'pill-inactive'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}
