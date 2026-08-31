import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/common/Toast'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings } from '../../contexts/SettingsContext'
import { today } from '../../utils/dateHelpers'

export default function Settings() {
  const { settings, saveSettings } = useSettings()
  const { updatePassword } = useAuth()
  const { toasts, success, error: toastError, dismiss } = useToast()

  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Settings form state
  const [form, setForm] = useState({
    crmName: 'TGBD CRM',
    company: {
      name: 'TGBD Tours',
      logo: '',
      address: '',
      phone: '',
      email: '',
      tradeLicense: '',
      website: '',
      facebook: '',
      whatsapp: '',
      footer: '',
      authoritySignature: '',
    },
    primaryBank: {
      bankName: '',
      accountName: '',
      accountNumber: '',
      branchName: '',
      routingNumber: '',
      otherInfo: '',
    },
    secondaryBank: {
      bankName: '',
      accountName: '',
      accountNumber: '',
      branchName: '',
      routingNumber: '',
      otherInfo: '',
    },
    idSettings: {
      invoice: { prefix: 'INV-', next: 1, pad: 6, enabled: true },
      customer: { prefix: 'CUS-', next: 1, pad: 6, enabled: true },
      vendor: { prefix: 'VEN-', next: 1, pad: 6, enabled: true },
      expense: { prefix: 'EXP-', next: 1, pad: 6, enabled: true },
      receipt: { prefix: 'MR-', next: 1, pad: 6, enabled: true },
    },
    system: {
      currencySymbol: '৳',
      seasonalTarget: 0,
      targetStartDate: '',
      targetEndDate: today(),
      fixedBudget: 0,
      birthdayWishEnabled: true,
    },
  })

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    if (settings) {
      setForm({
        crmName: settings.crmName || 'TGBD CRM',
        company: {
          name: settings.company?.name || 'TGBD Tours',
          logo: settings.company?.logo || '',
          address: settings.company?.address || '',
          phone: settings.company?.phone || '',
          email: settings.company?.email || '',
          tradeLicense: settings.company?.tradeLicense || '',
          website: settings.company?.website || '',
          facebook: settings.company?.facebook || '',
          whatsapp: settings.company?.whatsapp || '',
          footer: settings.company?.footer || '',
          authoritySignature: settings.company?.authoritySignature || '',
        },
        primaryBank: {
          bankName: settings.primaryBank?.bankName || '',
          accountName: settings.primaryBank?.accountName || '',
          accountNumber: settings.primaryBank?.accountNumber || '',
          branchName: settings.primaryBank?.branchName || '',
          routingNumber: settings.primaryBank?.routingNumber || '',
          otherInfo: settings.primaryBank?.otherInfo || '',
        },
        secondaryBank: {
          bankName: settings.secondaryBank?.bankName || '',
          accountName: settings.secondaryBank?.accountName || '',
          accountNumber: settings.secondaryBank?.accountNumber || '',
          branchName: settings.secondaryBank?.branchName || '',
          routingNumber: settings.secondaryBank?.routingNumber || '',
          otherInfo: settings.secondaryBank?.otherInfo || '',
        },
        idSettings: {
          invoice: { prefix: 'INV-', next: 1, pad: 6, enabled: true, ...settings.idSettings?.invoice },
          customer: { prefix: 'CUS-', next: 1, pad: 6, enabled: true, ...settings.idSettings?.customer },
          vendor: { prefix: 'VEN-', next: 1, pad: 6, enabled: true, ...settings.idSettings?.vendor },
          expense: { prefix: 'EXP-', next: 1, pad: 6, enabled: true, ...settings.idSettings?.expense },
          receipt: { prefix: 'MR-', next: 1, pad: 6, enabled: true, ...settings.idSettings?.receipt },
        },
        system: {
          currencySymbol: settings.system?.currencySymbol || '৳',
          seasonalTarget: settings.system?.seasonalTarget || 0,
          targetStartDate: settings.system?.targetStartDate || '',
          targetEndDate: settings.system?.targetEndDate || today(),
          fixedBudget: settings.system?.fixedBudget || 0,
          birthdayWishEnabled: settings.system?.birthdayWishEnabled !== false,
        },
      })
    }
  }, [settings])

  const setCompanyField = (key, value) => {
    setForm(prev => ({
      ...prev,
      company: { ...prev.company, [key]: value }
    }))
  }

  const setPrimaryBankField = (key, value) => {
    setForm(prev => ({
      ...prev,
      primaryBank: { ...prev.primaryBank, [key]: value }
    }))
  }

  const setSecondaryBankField = (key, value) => {
    setForm(prev => ({
      ...prev,
      secondaryBank: { ...prev.secondaryBank, [key]: value }
    }))
  }

  const setIdField = (entity, field, value) => {
    setForm(prev => ({
      ...prev,
      idSettings: {
        ...prev.idSettings,
        [entity]: {
          ...prev.idSettings[entity],
          [field]: value
        }
      }
    }))
  }

  const setSystemField = (key, value) => {
    setForm(prev => ({
      ...prev,
      system: { ...prev.system, [key]: value }
    }))
  }

  // Handle file uploads (logo / signature)
  const handleFileUpload = (e, field) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toastError('Image file size must be less than 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setCompanyField(field, reader.result)
      success(`Image loaded! Click "Save Settings" below to keep changes.`)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault()
    setSaving(true)
    try {
      await saveSettings(form)
      success('Settings saved successfully!')
    } catch (err) {
      toastError('Failed to save settings: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      toastError('New password must be at least 8 characters long.')
      return
    }

    const hasLetter = /[a-zA-Z]/.test(passwordForm.newPassword)
    const hasNumber = /[0-9]/.test(passwordForm.newPassword)
    if (!hasLetter || !hasNumber) {
      toastError('Password must contain both letters and numbers.')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toastError('New password and confirmation do not match.')
      return
    }

    setSavingPassword(true)
    try {
      await updatePassword(passwordForm.newPassword)
      success('Password updated successfully!')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      toastError('Password update failed: ' + err.message)
    } finally {
      setSavingPassword(false)
    }
  }

  const renderIdRow = (key, label) => {
    const cfg = form.idSettings[key] || { prefix: '', next: 1, pad: 6, enabled: true }
    const preview = `${cfg.prefix || ''}${String(cfg.next || 1).padStart(cfg.pad || 6, '0')}`

    return (
      <div key={key} style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 10, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{label} Prefix</label>
            <input
              className="form-input"
              value={cfg.prefix}
              onChange={e => setIdField(key, 'prefix', e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Start #</label>
            <input
              type="number"
              className="form-input"
              value={cfg.next}
              onChange={e => setIdField(key, 'next', parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Digits</label>
            <input
              type="number"
              className="form-input"
              value={cfg.pad}
              onChange={e => setIdField(key, 'pad', parseInt(e.target.value) || 6)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Enabled</label>
            <select
              className="form-select"
              value={cfg.enabled ? 'true' : 'false'}
              onChange={e => setIdField(key, 'enabled', e.target.value === 'true')}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Preview: <span className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{preview}</span>
        </div>
      </div>
    )
  }

  const renderBankFields = (bank, setBankField) => (
    <>
      <div className="form-grid form-grid-2">
        <div className="form-group">
          <label className="form-label">Bank Name</label>
          <input
            className="form-input"
            value={bank.bankName}
            onChange={e => setBankField('bankName', e.target.value)}
            placeholder="e.g. Dutch-Bangla Bank"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Account Name</label>
          <input
            className="form-input"
            value={bank.accountName}
            onChange={e => setBankField('accountName', e.target.value)}
            placeholder="e.g. Tour Guidance BD"
          />
        </div>
      </div>

      <div className="form-grid form-grid-2">
        <div className="form-group">
          <label className="form-label">Account Number</label>
          <input
            className="form-input mono"
            value={bank.accountNumber}
            onChange={e => setBankField('accountNumber', e.target.value)}
            placeholder="1234567890123"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Branch Name</label>
          <input
            className="form-input"
            value={bank.branchName}
            onChange={e => setBankField('branchName', e.target.value)}
            placeholder="e.g. Banani Branch"
          />
        </div>
      </div>

      <div className="form-grid form-grid-2">
        <div className="form-group">
          <label className="form-label">Routing Number</label>
          <input
            className="form-input mono"
            value={bank.routingNumber}
            onChange={e => setBankField('routingNumber', e.target.value)}
            placeholder="090270000"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Other Payment Info</label>
          <input
            className="form-input"
            value={bank.otherInfo}
            onChange={e => setBankField('otherInfo', e.target.value)}
            placeholder="e.g. bKash / Nagad Merchant: 017xxxxxxxx"
          />
        </div>
      </div>
    </>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure company branding, bank accounts, ID sequences, and system defaults</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSaveSettings}
          disabled={saving}
          id="top-save-settings-btn"
        >
          {saving ? 'Saving...' : '💾 Save Settings'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
        {/* 1. Admin Profile — Change Your Password */}
        <div className="card">
          <div className="card-title">Admin Profile — Change Your Password</div>
          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label className="form-label required">Current Password</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                placeholder="Enter current password"
              />
            </div>
            <div className="form-group">
              <label className="form-label required">New Password</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                placeholder="Enter new password"
              />
            </div>
            <div className="form-group">
              <label className="form-label required">Confirm New Password</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="Re-enter new password"
              />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              At least 8 characters, with both letters and numbers.
            </div>
            <button
              type="submit"
              className="btn btn-secondary btn-block"
              disabled={savingPassword}
              id="change-password-btn"
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* 2. CRM Branding */}
        <div className="card">
          <div className="card-title">CRM Branding</div>
          <div className="form-group">
            <label className="form-label">
              CRM Name <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(shown on login, sidebar &amp; page title)</span>
            </label>
            <input
              className="form-input"
              value={form.crmName}
              onChange={e => setForm(f => ({ ...f, crmName: e.target.value }))}
              placeholder="TGBD CRM"
              id="s-crmname"
            />
          </div>
        </div>

        {/* 3. Company Information */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Company Information</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shown on printed invoices, vouchers &amp; reports</span>
          </div>

          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input
              className="form-input"
              value={form.company.name}
              onChange={e => setCompanyField('name', e.target.value)}
              placeholder="Tour Guidance BD"
              id="s-name"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  background: '#0C1220',
                  border: '1px solid var(--card-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0
                }}
              >
                {form.company.logo ? (
                  <img src={form.company.logo} alt="Logo Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>No logo</span>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="form-input"
                style={{ flex: 1 }}
                onChange={e => handleFileUpload(e, 'logo')}
                id="s-logo"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea
              className="form-input"
              rows={2}
              value={form.company.address}
              onChange={e => setCompanyField('address', e.target.value)}
              placeholder="House 00, Road 00, Block A, Banani, Dhaka-1213"
              id="s-address"
            />
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                value={form.company.phone}
                onChange={e => setCompanyField('phone', e.target.value)}
                placeholder="+880 1700-000000"
                id="s-phone"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={form.company.email}
                onChange={e => setCompanyField('email', e.target.value)}
                placeholder="info@tourguidancebd.com"
                id="s-email"
              />
            </div>
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Trade License No</label>
              <input
                className="form-input"
                value={form.company.tradeLicense}
                onChange={e => setCompanyField('tradeLicense', e.target.value)}
                placeholder="TRAD/DNCC/123456/2026"
                id="s-license"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Website</label>
              <input
                className="form-input"
                value={form.company.website}
                onChange={e => setCompanyField('website', e.target.value)}
                placeholder="https://tourguidancebd.com"
                id="s-website"
              />
            </div>
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Facebook Page</label>
              <input
                className="form-input"
                value={form.company.facebook}
                onChange={e => setCompanyField('facebook', e.target.value)}
                placeholder="facebook.com/tourguidancebd"
                id="s-facebook"
              />
            </div>
            <div className="form-group">
              <label className="form-label">WhatsApp Number</label>
              <input
                className="form-input"
                value={form.company.whatsapp}
                onChange={e => setCompanyField('whatsapp', e.target.value)}
                placeholder="+8801700000000"
                id="s-whatsapp"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Footer Information</label>
            <textarea
              className="form-input"
              rows={2}
              value={form.company.footer}
              onChange={e => setCompanyField('footer', e.target.value)}
              placeholder="Thank you for traveling with Tour Guidance BD! Terms & conditions apply."
              id="s-footer"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Authority Signature</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  background: '#0C1220',
                  border: '1px solid var(--card-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0
                }}
              >
                {form.company.authoritySignature ? (
                  <img src={form.company.authoritySignature} alt="Signature Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>None</span>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="form-input"
                style={{ flex: 1 }}
                onChange={e => handleFileUpload(e, 'authoritySignature')}
                id="s-signature"
              />
            </div>
          </div>
        </div>

        {/* 4. Primary Bank Account */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Primary Bank Account</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shown on invoices</span>
          </div>
          {renderBankFields(form.primaryBank, setPrimaryBankField)}
        </div>

        {/* 5. Second Bank Account */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Second Bank Account</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Optional — choose per invoice which one to show</span>
          </div>
          {renderBankFields(form.secondaryBank, setSecondaryBankField)}
        </div>

        {/* 6. ID Settings */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>ID Settings</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Applies to newly created records only</span>
          </div>
          {renderIdRow('invoice', 'Invoice')}
          {renderIdRow('customer', 'Customer')}
          {renderIdRow('vendor', 'Vendor')}
          {renderIdRow('expense', 'Expense')}
          {renderIdRow('receipt', 'Money Receipt')}
        </div>

        {/* 7. System Settings */}
        <div className="card">
          <div className="card-title">System Settings</div>
          <div className="form-group">
            <label className="form-label">Currency Symbol</label>
            <input
              className="form-input"
              value={form.system.currencySymbol}
              onChange={e => setSystemField('currencySymbol', e.target.value)}
              placeholder="৳"
              id="s-currency"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Seasonal Target</label>
            <input
              type="number"
              className="form-input"
              value={form.system.seasonalTarget}
              onChange={e => setSystemField('seasonalTarget', parseFloat(e.target.value) || 0)}
              placeholder="0"
              id="s-target"
            />
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={form.system.targetStartDate}
                onChange={e => setSystemField('targetStartDate', e.target.value)}
                id="s-start"
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-input"
                value={form.system.targetEndDate}
                onChange={e => setSystemField('targetEndDate', e.target.value)}
                id="s-end"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Fixed Budget</label>
            <input
              type="number"
              className="form-input"
              value={form.system.fixedBudget}
              onChange={e => setSystemField('fixedBudget', parseFloat(e.target.value) || 0)}
              placeholder="0"
              id="s-budget"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Birthday Wishes</label>
            <select
              className="form-select"
              value={form.system.birthdayWishEnabled ? 'true' : 'false'}
              onChange={e => setSystemField('birthdayWishEnabled', e.target.value === 'true')}
              id="s-birthday"
            >
              <option value="true">Enabled — show Today's Birthdays panel</option>
              <option value="false">Disabled</option>
            </select>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Sending still requires a staff member to click "Send Wish" — a browser can't send email unattended. True automatic sending needs the backend/email service step.
            </div>
          </div>
        </div>

        {/* 8. Big Gold Save Button at the Bottom */}
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ padding: '14px', fontSize: '1rem', fontWeight: 700 }}
          onClick={handleSaveSettings}
          disabled={saving}
          id="save-settings-btn"
        >
          {saving ? 'Saving Settings...' : 'Save Settings'}
        </button>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}
