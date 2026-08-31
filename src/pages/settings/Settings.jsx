import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/common/Toast'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings } from '../../contexts/SettingsContext'
import { previewId } from '../../utils/idGenerator'
import { money } from '../../utils/money'

export default function Settings() {
  const { settings, saveSettings, currencySymbol } = useSettings()
  const { updatePassword, user } = useAuth()
  const { toasts, success, error: toastError, dismiss } = useToast()

  const [activeTab, setActiveTab] = useState('company') // 'company' | 'banks' | 'ids' | 'system' | 'profile'
  const [saving, setSaving] = useState(false)

  // Local copy of form state
  const [form, setForm] = useState(settings)

  // Profile password state
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    setForm(settings)
  }, [settings])

  const handleFieldChange = (section, key, value) => {
    setForm(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }))
  }

  const handleIdConfigChange = (entity, key, value) => {
    setForm(prev => ({
      ...prev,
      idSettings: {
        ...prev.idSettings,
        [entity]: {
          ...prev.idSettings?.[entity],
          [key]: value
        }
      }
    }))
  }

  const handleSaveAll = async (e) => {
    if (e) e.preventDefault()
    setSaving(true)
    try {
      await saveSettings(form)
      success('System settings saved successfully')
    } catch (err) {
      toastError('Failed to save settings: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Handle image conversion to Base64 data URL for logo/signature
  const handleImageUpload = (e, targetField) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toastError('Image file size must be less than 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      handleFieldChange('company', targetField, reader.result)
      success(`Image loaded. Click 'Save Changes' below to persist.`)
    }
    reader.readAsDataURL(file)
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      toastError('New password must be at least 8 characters long')
      return
    }

    const hasLetter = /[a-zA-Z]/.test(passwordForm.newPassword)
    const hasNumber = /[0-9]/.test(passwordForm.newPassword)
    if (!hasLetter || !hasNumber) {
      toastError('Password must contain both letters and numbers')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toastError('Passwords do not match')
      return
    }

    setSavingPassword(true)
    try {
      await updatePassword(passwordForm.newPassword)
      success('Admin password successfully updated!')
      setPasswordForm({ newPassword: '', confirmPassword: '' })
    } catch (err) {
      toastError('Failed to update password: ' + err.message)
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings & Configuration</h1>
          <p className="page-subtitle">Configure company details, bank payment profiles, sequential numbering, and targets</p>
        </div>
        {activeTab !== 'profile' && (
          <button className="btn btn-primary" onClick={handleSaveAll} disabled={saving} id="save-settings-top-btn">
            {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        )}
      </div>

      <div className="card">
        {/* Navigation Tabs */}
        <div className="tabs">
          <button className={`tab ${activeTab === 'company' ? 'active' : ''}`} onClick={() => setActiveTab('company')}>
            🏢 Company & Branding
          </button>
          <button className={`tab ${activeTab === 'banks' ? 'active' : ''}`} onClick={() => setActiveTab('banks')}>
            💳 Bank Accounts
          </button>
          <button className={`tab ${activeTab === 'ids' ? 'active' : ''}`} onClick={() => setActiveTab('ids')}>
            🔢 ID Prefix & Numbering
          </button>
          <button className={`tab ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>
            ⚙ System & Seasonal Targets
          </button>
          <button className={`tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            🔒 Admin Security
          </button>
        </div>

        {/* Tab 1: Company Info */}
        {activeTab === 'company' && (
          <form onSubmit={handleSaveAll}>
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label required">CRM Application Name</label>
                <input
                  className="form-input"
                  value={form.crmName || 'TGBD CRM'}
                  onChange={e => setForm(f => ({ ...f, crmName: e.target.value }))}
                  placeholder="e.g. TGBD CRM"
                  required
                />
                <div className="form-hint">Displayed in login, navigation header, and browser tab.</div>
              </div>

              <div className="form-group">
                <label className="form-label required">Official Company Name</label>
                <input
                  className="form-input"
                  value={form.company?.name || ''}
                  onChange={e => handleFieldChange('company', 'name', e.target.value)}
                  placeholder="e.g. Tour Guidance BD"
                  required
                />
                <div className="form-hint">Appears on letterhead invoice and receipt headers.</div>
              </div>
            </div>

            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label">Company Logo (For Invoices & Vouchers)</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {form.company?.logo ? (
                    <img src={form.company.logo} alt="Logo Preview" style={{ width: 64, height: 64, objectFit: 'contain', background: '#fff', padding: 4, borderRadius: 6, border: '1px solid var(--card-border)' }} />
                  ) : (
                    <div style={{ width: 64, height: 64, background: 'rgba(255,255,255,0.05)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>No Logo</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <input
                      type="file"
                      accept="image/*"
                      className="form-input"
                      style={{ fontSize: '0.78rem' }}
                      onChange={e => handleImageUpload(e, 'logo')}
                    />
                    {form.company?.logo && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--red)', marginTop: 4, fontSize: '0.72rem', padding: '2px 0' }}
                        onClick={() => handleFieldChange('company', 'logo', '')}
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Authority Signature Image (For Invoices)</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {form.company?.authoritySignature ? (
                    <img src={form.company.authoritySignature} alt="Signature Preview" style={{ width: 100, height: 50, objectFit: 'contain', background: '#fff', padding: 4, borderRadius: 6, border: '1px solid var(--card-border)' }} />
                  ) : (
                    <div style={{ width: 100, height: 50, background: 'rgba(255,255,255,0.05)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>No Signature</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <input
                      type="file"
                      accept="image/*"
                      className="form-input"
                      style={{ fontSize: '0.78rem' }}
                      onChange={e => handleImageUpload(e, 'authoritySignature')}
                    />
                    {form.company?.authoritySignature && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--red)', marginTop: 4, fontSize: '0.72rem', padding: '2px 0' }}
                        onClick={() => handleFieldChange('company', 'authoritySignature', '')}
                      >
                        Remove Signature
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="form-grid form-grid-3">
              <div className="form-group">
                <label className="form-label">Official Phone</label>
                <input className="form-input" value={form.company?.phone || ''} onChange={e => handleFieldChange('company', 'phone', e.target.value)} placeholder="+880 1..." />
              </div>
              <div className="form-group">
                <label className="form-label">Official Email</label>
                <input className="form-input" value={form.company?.email || ''} onChange={e => handleFieldChange('company', 'email', e.target.value)} placeholder="info@tourguidebd.com" />
              </div>
              <div className="form-group">
                <label className="form-label">WhatsApp Number</label>
                <input className="form-input" value={form.company?.whatsapp || ''} onChange={e => handleFieldChange('company', 'whatsapp', e.target.value)} placeholder="+880 1..." />
              </div>
            </div>

            <div className="form-grid form-grid-3">
              <div className="form-group">
                <label className="form-label">Website URL</label>
                <input className="form-input" value={form.company?.website || ''} onChange={e => handleFieldChange('company', 'website', e.target.value)} placeholder="https://tourguidebd.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Facebook Page</label>
                <input className="form-input" value={form.company?.facebook || ''} onChange={e => handleFieldChange('company', 'facebook', e.target.value)} placeholder="fb.com/tourguidancebd" />
              </div>
              <div className="form-group">
                <label className="form-label">Trade License No</label>
                <input className="form-input" value={form.company?.tradeLicense || ''} onChange={e => handleFieldChange('company', 'tradeLicense', e.target.value)} placeholder="TRAD/DNCC/..." />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Office Address</label>
              <input className="form-input" value={form.company?.address || ''} onChange={e => handleFieldChange('company', 'address', e.target.value)} placeholder="Suite 402, House 12, Road 5, Dhanmondi, Dhaka-1205" />
            </div>

            <div className="form-group">
              <label className="form-label">Print Footer Notes & Disclaimer</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={form.company?.footer || ''}
                onChange={e => handleFieldChange('company', 'footer', e.target.value)}
                placeholder="Thank you for choosing Tour Guidance BD. Please keep this invoice for all journey confirmations."
              />
            </div>

            <div style={{ marginTop: 20 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Company Details'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Bank Accounts */}
        {activeTab === 'banks' && (
          <form onSubmit={handleSaveAll}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Primary Bank */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 18, borderRadius: 8, border: '1px solid var(--card-border)' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--gold)', marginBottom: 14, fontWeight: 700 }}>
                  🏦 Primary Bank Account
                </div>
                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input className="form-input" placeholder="e.g. Dutch-Bangla Bank PLC" value={form.primaryBank?.bankName || ''} onChange={e => handleFieldChange('primaryBank', 'bankName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Name</label>
                  <input className="form-input" placeholder="e.g. Tour Guidance BD" value={form.primaryBank?.accountName || ''} onChange={e => handleFieldChange('primaryBank', 'accountName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Number</label>
                  <input className="form-input mono" placeholder="e.g. 1151200000000" value={form.primaryBank?.accountNumber || ''} onChange={e => handleFieldChange('primaryBank', 'accountNumber', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Branch Name</label>
                  <input className="form-input" placeholder="e.g. Dhanmondi Branch" value={form.primaryBank?.branchName || ''} onChange={e => handleFieldChange('primaryBank', 'branchName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Routing Number</label>
                  <input className="form-input mono" placeholder="e.g. 090260000" value={form.primaryBank?.routingNumber || ''} onChange={e => handleFieldChange('primaryBank', 'routingNumber', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Other Payment / MFS Info</label>
                  <input className="form-input" placeholder="e.g. bKash Merchant: 01700000000" value={form.primaryBank?.otherInfo || ''} onChange={e => handleFieldChange('primaryBank', 'otherInfo', e.target.value)} />
                </div>
              </div>

              {/* Secondary Bank */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 18, borderRadius: 8, border: '1px solid var(--card-border)' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--teal)', marginBottom: 14, fontWeight: 700 }}>
                  🏦 Secondary Bank Account
                </div>
                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input className="form-input" placeholder="e.g. BRAC Bank PLC" value={form.secondaryBank?.bankName || ''} onChange={e => handleFieldChange('secondaryBank', 'bankName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Name</label>
                  <input className="form-input" placeholder="e.g. Tour Guidance BD" value={form.secondaryBank?.accountName || ''} onChange={e => handleFieldChange('secondaryBank', 'accountName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Number</label>
                  <input className="form-input mono" placeholder="e.g. 1501200000000" value={form.secondaryBank?.accountNumber || ''} onChange={e => handleFieldChange('secondaryBank', 'accountNumber', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Branch Name</label>
                  <input className="form-input" placeholder="e.g. Gulshan Branch" value={form.secondaryBank?.branchName || ''} onChange={e => handleFieldChange('secondaryBank', 'branchName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Routing Number</label>
                  <input className="form-input mono" placeholder="e.g. 060260000" value={form.secondaryBank?.routingNumber || ''} onChange={e => handleFieldChange('secondaryBank', 'routingNumber', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Other Payment / MFS Info</label>
                  <input className="form-input" placeholder="e.g. Nagad Merchant: 01800000000" value={form.secondaryBank?.otherInfo || ''} onChange={e => handleFieldChange('secondaryBank', 'otherInfo', e.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Bank Accounts'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: ID Settings */}
        {activeTab === 'ids' && (
          <form onSubmit={handleSaveAll}>
            <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              💡 <b>Note:</b> ID changes only apply to newly generated records. Existing records preserve their established historical IDs.
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Entity Type</th>
                    <th>Prefix</th>
                    <th>Start Number</th>
                    <th>Digit Padding</th>
                    <th>Live ID Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'invoice', label: 'Invoices' },
                    { key: 'customer', label: 'Customers' },
                    { key: 'vendor', label: 'Vendors' },
                    { key: 'expense', label: 'Expenses' },
                    { key: 'receipt', label: 'Money Receipts' },
                  ].map(entity => {
                    const cfg = form.idSettings?.[entity.key] || { prefix: '', digits: 6, startNumber: 1 }
                    return (
                      <tr key={entity.key}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{entity.label}</td>
                        <td>
                          <input
                            className="form-input mono"
                            style={{ width: 120, padding: '4px 8px' }}
                            value={cfg.prefix || ''}
                            onChange={e => handleIdConfigChange(entity.key, 'prefix', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            className="form-input mono"
                            style={{ width: 90, padding: '4px 8px' }}
                            value={cfg.startNumber || 1}
                            onChange={e => handleIdConfigChange(entity.key, 'startNumber', parseInt(e.target.value) || 1)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            className="form-input mono"
                            style={{ width: 70, padding: '4px 8px' }}
                            value={cfg.digits || 6}
                            onChange={e => handleIdConfigChange(entity.key, 'digits', parseInt(e.target.value) || 6)}
                          />
                        </td>
                        <td>
                          <span className="mono" style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.9rem' }}>
                            {previewId(cfg)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 20 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save ID Configurations'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 4: System & Seasonal Targets */}
        {activeTab === 'system' && (
          <form onSubmit={handleSaveAll}>
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label required">Currency Symbol</label>
                <input
                  className="form-input mono"
                  style={{ width: 120, fontSize: '1.2rem' }}
                  value={form.system?.currencySymbol || '৳'}
                  onChange={e => handleFieldChange('system', 'currencySymbol', e.target.value)}
                  placeholder="৳"
                  required
                />
                <div className="form-hint">Default is ৳ (Bangladeshi Taka).</div>
              </div>

              <div className="form-group">
                <label className="form-label">Seasonal Sales Target Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  className="form-input mono"
                  style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--gold)' }}
                  value={form.system?.seasonalTarget || 0}
                  onChange={e => handleFieldChange('system', 'seasonalTarget', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
                <div className="form-hint">Drives the Dashboard progress gauge.</div>
              </div>
            </div>

            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label">Seasonal Target Start Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.system?.targetStartDate || ''}
                  onChange={e => handleFieldChange('system', 'targetStartDate', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Seasonal Target End Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.system?.targetEndDate || ''}
                  onChange={e => handleFieldChange('system', 'targetEndDate', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 10 }}>
                <input
                  type="checkbox"
                  style={{ width: 18, height: 18, accentColor: 'var(--gold)' }}
                  checked={form.system?.birthdayWishEnabled !== false}
                  onChange={e => handleFieldChange('system', 'birthdayWishEnabled', e.target.checked)}
                />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    Enable "Today's Birthdays" Notification Panel on Dashboard
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Surfaces customers whose birthday matches today, with a 1-click branded greeting email composer.
                  </div>
                </div>
              </label>
            </div>

            <div style={{ marginTop: 20 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save System Settings'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 5: Admin Security */}
        {activeTab === 'profile' && (
          <div style={{ maxWidth: 440 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Change Account Password
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Updating your password modifies your credentials across all active devices.
              </div>
            </div>

            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label className="form-label required">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Min 8 chars with letters and numbers"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Repeat new password"
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ marginTop: 8 }}
                disabled={savingPassword || !passwordForm.newPassword}
              >
                {savingPassword ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}
