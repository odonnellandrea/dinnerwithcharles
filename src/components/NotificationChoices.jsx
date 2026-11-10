import React from 'react'
import { EMAIL_CONSENT_TEXT, SMS_CONSENT_TEXT, SMS_MARKETING_CONSENT_TEXT, SMS_TERMS_TEXT, TRANSACTIONAL_NOTE } from '../lib/notificationConsent'

// The independent opt-ins: email, order/menu texts, and marketing texts. Used on the
// request-to-join form and in Notification Settings so both show identical choices. Never
// pre-check a box.
export default function NotificationChoices({ emailOptIn, smsOptIn, smsMarketingOptIn = false, phoneNumber, onChange, phoneError }) {
  const wantsTexts = smsOptIn === true || smsMarketingOptIn === true
  const boxStyle = { width: '18px', height: '18px', marginTop: '2px', flexShrink: 0, accentColor: '#083525', cursor: 'pointer' }
  const textStyle = { fontSize: '14px', lineHeight: '1.6', color: '#333' }

  return (
    <div>
      <div style={{ padding: '16px 0', borderBottom: '1px solid #e0dbd1' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>Email</p>
        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={emailOptIn === true}
            onChange={(e) => onChange('emailOptIn', e.target.checked)}
            style={boxStyle}
          />
          <span style={textStyle}>{EMAIL_CONSENT_TEXT}</span>
        </label>
      </div>

      <div style={{ padding: '16px 0', borderBottom: '1px solid #e0dbd1' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>Text messages</p>
        <label htmlFor="smsPhoneNumber" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#083525', marginBottom: '6px' }}>
          Mobile number{wantsTexts ? ' *' : ' (only needed for texts)'}
        </label>
        <input
          id="smsPhoneNumber"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phoneNumber}
          onChange={(e) => onChange('phoneNumber', e.target.value)}
          placeholder="(555) 123-4567"
          style={{ width: '100%', maxWidth: '320px', padding: '12px', border: `1px solid ${phoneError ? '#c62828' : '#e0dbd1'}`, boxSizing: 'border-box', fontSize: '16px', fontFamily: 'inherit', marginBottom: phoneError ? '6px' : '12px' }}
        />
        {phoneError && <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#c62828' }}>{phoneError}</p>}
        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={smsOptIn === true}
            onChange={(e) => onChange('smsOptIn', e.target.checked)}
            style={boxStyle}
          />
          <span style={textStyle}>{SMS_CONSENT_TEXT}</span>
        </label>
        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', marginTop: '12px' }}>
          <input
            type="checkbox"
            checked={smsMarketingOptIn === true}
            onChange={(e) => onChange('smsMarketingOptIn', e.target.checked)}
            style={boxStyle}
          />
          <span style={textStyle}>{SMS_MARKETING_CONSENT_TEXT}</span>
        </label>
        <p style={{ margin: '12px 0 0 0', fontSize: '12px', lineHeight: '1.6', color: '#666' }}>{SMS_TERMS_TEXT}</p>
      </div>

      <p style={{ margin: '16px 0 0 0', fontSize: '13px', lineHeight: '1.6', color: '#666' }}>{TRANSACTIONAL_NOTE}</p>
    </div>
  )
}
