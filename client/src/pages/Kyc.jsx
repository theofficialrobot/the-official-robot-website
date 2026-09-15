import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, apiUpload, isKycEmpty, isNotFound, mediaUrl } from '../api';
import { needsVerification, useAuth } from '../AuthContext';
import EmailVerifyNotice from '../components/EmailVerifyNotice';
import ReqLabel from '../components/ReqLabel';

const field = 'mt-1 w-full border border-line rounded-[10px] px-3 py-2.5 bg-white font-normal';

const COUNTRIES = [
  'United States', 'Canada', 'Mexico', 'United Kingdom', 'Ireland', 'France', 'Germany', 'Italy', 'Spain',
  'Portugal', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland',
  'Poland', 'Czech Republic', 'Hungary', 'Greece', 'Turkey', 'Israel', 'United Arab Emirates', 'Saudi Arabia',
  'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'China', 'Japan', 'South Korea', 'Taiwan', 'Hong Kong',
  'Singapore', 'Malaysia', 'Thailand', 'Vietnam', 'Indonesia', 'Philippines', 'Australia', 'New Zealand',
  'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'South Africa', 'Nigeria', 'Kenya', 'Egypt', 'Morocco',
  'Ukraine', 'Romania', 'Bulgaria', 'Croatia', 'Serbia', 'Slovakia', 'Slovenia', 'Estonia', 'Latvia',
  'Lithuania', 'Luxembourg', 'Iceland', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Jordan', 'Lebanon',
  'Other'
];

const PROOF_TYPES = [
  { id: 'passport', label: 'Passport' },
  { id: 'government issued ID', label: 'Government issued ID' }
];

function inferKind(user) {
  const t = (user && (user.accountType || user.account_type)) || 'individual';
  return (t === 'reseller' || t === 'manufacturer') ? 'company' : 'individual';
}

function kycStatus(payload) {
  const kyc = payload && (payload.kyc !== undefined ? payload.kyc : payload);
  if (isKycEmpty(kyc)) return 'Not started';
  const status = String((kyc && (kyc.status || kyc.state)) || '').trim();
  if (status) {
    const s = status.replace(/_/g, ' ');
    if (s.toLowerCase() === 'submitted') return 'Submitted — awaiting admin approval';
    return s;
  }
  return 'Submitted — awaiting admin approval';
}

function idTypeForApi(value) {
  return value === 'passport' ? 'passport' : 'government_id';
}

export default function Kyc() {
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/add';
  const [kind, setKind] = useState(null);
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    countryOfCitizenship: 'United States',
    countryOfBirth: 'United States',
    dateOfBirth: '',
    identityProofType: 'passport',
    countryOfIssue: 'United States',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    phone: '',
    documentUrl: ''
  });
  const [company, setCompany] = useState({
    legalCompanyName: '',
    registrationState: '',
    registrationNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    phone: '',
    documentUrl: ''
  });
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const inferred = inferKind(user);
    setKind(inferred);
    setForm((f) => ({
      ...f,
      firstName: f.firstName || user.firstName || '',
      lastName: f.lastName || user.lastName || ''
    }));
    setCompany((c) => ({
      ...c,
      legalCompanyName: c.legalCompanyName || user.companyName || user.company_name || ''
    }));
    api('/api/kyc', { auth: true })
      .then((d) => {
        const nextKind = d.kind === 'company' || d.kind === 'business' ? 'company' : (d.kind === 'individual' ? 'individual' : inferred);
        setKind(nextKind);
        const kyc = d.kyc !== undefined ? d.kyc : d;
        setStatus(kycStatus(d));
        if (kyc && typeof kyc === 'object') {
          if (nextKind === 'company') {
            setCompany((c) => ({
              ...c,
              legalCompanyName: kyc.legalName || kyc.legal_name || kyc.legalCompanyName || kyc.legal_company_name || kyc.companyName || kyc.company_name || c.legalCompanyName,
              registrationState: kyc.registrationState || kyc.registration_state || kyc.stateOfRegistration || kyc.state_of_registration || c.registrationState,
              registrationNumber: kyc.registrationNumber || kyc.registration_number || c.registrationNumber,
              addressLine1: kyc.addressLine1 || kyc.address_line1 || c.addressLine1,
              addressLine2: kyc.addressLine2 || kyc.address_line2 || c.addressLine2,
              city: kyc.city || kyc.cityTown || c.city,
              state: kyc.state || kyc.region || c.state,
              postalCode: kyc.postalCode || kyc.postal_code || kyc.zip || c.postalCode,
              country: kyc.country || kyc.addressCountry || c.country,
              phone: kyc.phone || kyc.phoneNumber || c.phone,
              documentUrl: kyc.documentUrl || kyc.document_url || kyc.formationDocumentUrl || kyc.idDocumentUrl || c.documentUrl
            }));
          } else {
            setForm((f) => ({
              ...f,
              firstName: kyc.firstName || kyc.first_name || f.firstName,
              middleName: kyc.middleName || kyc.middle_name || f.middleName,
              lastName: kyc.lastName || kyc.last_name || f.lastName,
              countryOfCitizenship: kyc.countryOfCitizenship || kyc.citizenshipCountry || kyc.citizenship_country || f.countryOfCitizenship,
              countryOfBirth: kyc.countryOfBirth || kyc.birthCountry || kyc.birth_country || f.countryOfBirth,
              dateOfBirth: (kyc.dateOfBirth || kyc.date_of_birth || '').slice(0, 10) || f.dateOfBirth,
              identityProofType: kyc.identityProofType || kyc.identity_proof_type || (kyc.idType === 'government_id' ? 'government issued ID' : kyc.idType) || f.identityProofType,
              countryOfIssue: kyc.countryOfIssue || kyc.issueCountry || kyc.issue_country || kyc.idCountry || kyc.id_country || f.countryOfIssue,
              addressLine1: kyc.addressLine1 || kyc.address_line1 || f.addressLine1,
              addressLine2: kyc.addressLine2 || kyc.address_line2 || f.addressLine2,
              city: kyc.city || kyc.cityTown || f.city,
              state: kyc.state || kyc.region || f.state,
              postalCode: kyc.postalCode || kyc.postal_code || kyc.zip || f.postalCode,
              country: kyc.country || kyc.addressCountry || f.country,
              phone: kyc.phone || kyc.phoneNumber || f.phone,
              documentUrl: kyc.documentUrl || kyc.document_url || kyc.idDocumentUrl || kyc.id_document_url || f.documentUrl
            }));
          }
        }
      })
      .catch((e) => {
        if (isNotFound(e)) setStatus('Not started');
        else setError(e.message);
      })
      .finally(() => setLoaded(true));
  }, [user]);

  if (ready && !user) return <Navigate to={'/login?next=' + encodeURIComponent('/kyc?next=' + next)} replace />;

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setCo(k, v) {
    setCompany((c) => ({ ...c, [k]: v }));
  }

  const NAME_RE = /^[A-Za-z][A-Za-z .'-]*$/;
  const PLACE_RE = /^[A-Za-z0-9][A-Za-z0-9 .,'-]*$/;
  const POSTAL_RE = /^[A-Za-z0-9][A-Za-z0-9 \-]*$/;

  function phoneDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function validatePhone(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'Phone number is required.';
    if (/[A-Za-z]/.test(raw)) return 'Phone number cannot include letters.';
    if (!/^\+?[0-9][0-9\s().\-]*$/.test(raw)) return 'Enter a valid phone number (digits, optional +, spaces, or dashes).';
    const n = phoneDigits(raw);
    if (n.length < 7 || n.length > 15) return 'Phone number must have 7 to 15 digits.';
    return '';
  }

  function validatePersonName(value, label) {
    const s = String(value || '').trim();
    if (!s) return label + ' is required.';
    if (!NAME_RE.test(s)) return label + ' can only include letters, spaces, hyphens, and apostrophes.';
    return '';
  }

  function validatePlace(value, label) {
    const s = String(value || '').trim();
    if (!s) return label + ' is required.';
    if (!PLACE_RE.test(s)) return label + ' has invalid characters.';
    return '';
  }

  function validatePostal(value) {
    const s = String(value || '').trim();
    if (!s) return 'Postal code is required.';
    if (!POSTAL_RE.test(s)) return 'Postal code can only include letters, numbers, spaces, and hyphens.';
    return '';
  }

  function countrySelect(value, onChange) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={field}>
        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    );
  }

  async function uploadDocument(doc) {
    const fd = new FormData();
    fd.append('file', doc);
    const up = await apiUpload('/api/uploads?kind=kyc', fd);
    return mediaUrl(up);
  }

  async function submitPersonal(e) {
    e.preventDefault();
    const checks = [
      validatePersonName(form.firstName, 'First name'),
      form.middleName.trim() ? validatePersonName(form.middleName, 'Middle name') : '',
      validatePersonName(form.lastName, 'Last name'),
      validatePlace(form.city, 'City'),
      validatePlace(form.state, 'State / Region'),
      validatePostal(form.postalCode),
      validatePhone(form.phone)
    ].filter(Boolean);
    if (!file && !form.documentUrl) checks.push('Upload an identity document (image or PDF).');
    if (!form.dateOfBirth) checks.push('Date of birth is required.');
    if (checks.length) {
      setError(checks[0]);
      return;
    }
    setBusy(true);
    setError('');
    try {
      let documentUrl = form.documentUrl || '';
      if (file) documentUrl = (await uploadDocument(file)) || documentUrl;
      const legalName = [form.firstName, form.middleName, form.lastName].map((s) => s.trim()).filter(Boolean).join(' ');
      await api('/api/kyc', {
        method: 'PUT',
        auth: true,
        body: {
          firstName: form.firstName.trim(),
          middleName: form.middleName.trim() || undefined,
          lastName: form.lastName.trim(),
          legalName,
          countryOfCitizenship: form.countryOfCitizenship,
          citizenshipCountry: form.countryOfCitizenship,
          countryOfBirth: form.countryOfBirth,
          birthCountry: form.countryOfBirth,
          dateOfBirth: form.dateOfBirth,
          identityProofType: form.identityProofType,
          idType: idTypeForApi(form.identityProofType),
          countryOfIssue: form.countryOfIssue,
          idCountry: form.countryOfIssue,
          addressLine1: form.addressLine1.trim(),
          addressLine2: form.addressLine2.trim() || undefined,
          city: form.city.trim(),
          state: form.state.trim(),
          region: form.state.trim(),
          postalCode: form.postalCode.trim(),
          country: form.country,
          phone: form.phone.trim(),
          documentUrl: documentUrl || undefined,
          idDocumentUrl: documentUrl || undefined
        }
      });
      nav(next);
    } catch (err) {
      setError(isNotFound(err) ? 'Identity verification is not available yet.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCompany(e) {
    e.preventDefault();
    const legal = company.legalCompanyName.trim();
    const checks = [
      legal ? (/[A-Za-z]/.test(legal) ? '' : 'Legal name must include letters.') : 'Legal name is required.',
      validatePlace(company.registrationState, 'State of registration'),
      validatePlace(company.city, 'City'),
      validatePlace(company.state, 'State / Region'),
      validatePostal(company.postalCode),
      validatePhone(company.phone)
    ].filter(Boolean);
    if (checks.length) {
      setError(checks[0]);
      return;
    }
    setBusy(true);
    setError('');
    try {
      let documentUrl = company.documentUrl || '';
      if (file) documentUrl = (await uploadDocument(file)) || documentUrl;
      await api('/api/kyc/company', {
        method: 'PUT',
        auth: true,
        body: {
          legalName: company.legalCompanyName.trim(),
          legalCompanyName: company.legalCompanyName.trim(),
          stateOfRegistration: company.registrationState.trim(),
          registrationState: company.registrationState.trim(),
          registrationNumber: company.registrationNumber.trim() || undefined,
          addressLine1: company.addressLine1.trim(),
          addressLine2: company.addressLine2.trim() || undefined,
          city: company.city.trim(),
          state: company.state.trim(),
          region: company.state.trim(),
          postalCode: company.postalCode.trim(),
          zip: company.postalCode.trim(),
          country: company.country,
          phone: company.phone.trim(),
          documentUrl: documentUrl || undefined,
          formationDocumentUrl: documentUrl || undefined
        }
      });
      nav(next);
    } catch (err) {
      setError(isNotFound(err) ? 'Company verification is not available yet.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  const isCompany = kind === 'company';

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-[13px]">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-2">
        {isCompany ? 'Company · sell gate' : 'Identity · sell gate'}
      </p>
      <h1 className="font-display font-bold text-3xl tracking-tight">
        {isCompany ? 'Verify your company' : 'Verify your identity'}
      </h1>
      <p className="text-muted mt-2 text-sm">
        {isCompany
          ? 'Complete company verification before you list a robot.'
          : 'Complete KYC before you list a robot. Use the name and document you will upload.'}
      </p>
      {status && (
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Status · {status}
        </p>
      )}
      {needsVerification(user) && <EmailVerifyNotice className="mt-6" />}

      {isCompany ? (
        <form onSubmit={submitCompany} className="mt-8 space-y-4">
          <label className="block text-sm font-semibold">
            <ReqLabel>Legal company name</ReqLabel>
            <input required value={company.legalCompanyName} onChange={(e) => setCo('legalCompanyName', e.target.value)} className={field} autoComplete="organization" />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold">
              <ReqLabel>State of registration</ReqLabel>
              <input required value={company.registrationState} onChange={(e) => setCo('registrationState', e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-semibold">
              Registration number
              <input value={company.registrationNumber} onChange={(e) => setCo('registrationNumber', e.target.value)} className={field} />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            <ReqLabel>Company address line 1</ReqLabel>
            <input required value={company.addressLine1} onChange={(e) => setCo('addressLine1', e.target.value)} className={field} autoComplete="address-line1" />
          </label>
          <label className="block text-sm font-semibold">
            Address line 2
            <input value={company.addressLine2} onChange={(e) => setCo('addressLine2', e.target.value)} className={field} autoComplete="address-line2" />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold">
              <ReqLabel>City</ReqLabel>
              <input required value={company.city} onChange={(e) => setCo('city', e.target.value)} className={field} autoComplete="address-level2" />
            </label>
            <label className="block text-sm font-semibold">
              <ReqLabel>State / Region</ReqLabel>
              <input required value={company.state} onChange={(e) => setCo('state', e.target.value)} className={field} autoComplete="address-level1" />
            </label>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold">
              <ReqLabel>ZIP</ReqLabel>
              <input required value={company.postalCode} onChange={(e) => setCo('postalCode', e.target.value)} className={field} autoComplete="postal-code" />
            </label>
            <label className="block text-sm font-semibold">
              <ReqLabel>Country</ReqLabel>
              {countrySelect(company.country, (v) => setCo('country', v))}
            </label>
          </div>
          <label className="block text-sm font-semibold">
            <ReqLabel>Phone</ReqLabel>
            <input
              required
              type="tel"
              inputMode="tel"
              pattern="^\+?[0-9][0-9\s().\-]{6,24}$"
              title="Digits only; optional +, spaces, or dashes"
              value={company.phone}
              onChange={(e) => setCo('phone', e.target.value)}
              className={field}
              autoComplete="tel"
            />
          </label>
          <label className="block text-sm font-semibold">
            Formation document
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile((e.target.files && e.target.files[0]) || null)}
              className={field}
            />
            <span className="block text-xs text-dim font-normal mt-1">Optional. Image or PDF of articles of incorporation or similar.</span>
          </label>
          {company.documentUrl && !file && (
            <p className="text-xs text-muted">A document is already on file.</p>
          )}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={busy || !loaded} className="or-check w-full text-white font-semibold py-3.5 rounded-[12px] disabled:opacity-60">
            {busy ? 'Submitting…' : 'Submit company verification'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitPersonal} className="mt-8 space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block text-sm font-semibold">
              <ReqLabel>First name</ReqLabel>
              <input required pattern="[A-Za-z][A-Za-z .'-]*" title="Letters only" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} className={field} autoComplete="given-name" />
            </label>
            <label className="block text-sm font-semibold">
              Middle
              <input pattern="[A-Za-z][A-Za-z .'-]*" title="Letters only" value={form.middleName} onChange={(e) => set('middleName', e.target.value)} className={field} autoComplete="additional-name" />
            </label>
            <label className="block text-sm font-semibold">
              <ReqLabel>Last name</ReqLabel>
              <input required pattern="[A-Za-z][A-Za-z .'-]*" title="Letters only" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className={field} autoComplete="family-name" />
            </label>
          </div>
          <p className="text-xs text-dim">Enter your complete name as it appears on your Identity proof document</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold">
              <ReqLabel>Country of citizenship</ReqLabel>
              {countrySelect(form.countryOfCitizenship, (v) => set('countryOfCitizenship', v))}
            </label>
            <label className="block text-sm font-semibold">
              <ReqLabel>Country of birth</ReqLabel>
              {countrySelect(form.countryOfBirth, (v) => set('countryOfBirth', v))}
            </label>
          </div>
          <label className="block text-sm font-semibold">
            <ReqLabel>Date of birth</ReqLabel>
            <input required type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} className={field} />
          </label>
          <label className="block text-sm font-semibold">
            <ReqLabel>Identity proof type</ReqLabel>
            <select required value={form.identityProofType} onChange={(e) => set('identityProofType', e.target.value)} className={field}>
              {PROOF_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            <ReqLabel>Country of issue</ReqLabel>
            {countrySelect(form.countryOfIssue, (v) => set('countryOfIssue', v))}
          </label>

          <label className="block text-sm font-semibold">
            <ReqLabel>Address Line 1</ReqLabel>
            <input required value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} className={field} autoComplete="address-line1" />
          </label>
          <label className="block text-sm font-semibold">
            Address Line 2
            <input value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} className={field} autoComplete="address-line2" />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold">
              <ReqLabel>City / Town</ReqLabel>
              <input required value={form.city} onChange={(e) => set('city', e.target.value)} className={field} autoComplete="address-level2" />
            </label>
            <label className="block text-sm font-semibold">
              <ReqLabel>State / Region</ReqLabel>
              <input required value={form.state} onChange={(e) => set('state', e.target.value)} className={field} autoComplete="address-level1" />
            </label>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold">
              <ReqLabel>ZIP / Postal code</ReqLabel>
              <input required value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} className={field} autoComplete="postal-code" />
            </label>
            <label className="block text-sm font-semibold">
              <ReqLabel>Country (address)</ReqLabel>
              {countrySelect(form.country, (v) => set('country', v))}
            </label>
          </div>
          <label className="block text-sm font-semibold">
            <ReqLabel>Phone number</ReqLabel>
            <input
              required
              type="tel"
              inputMode="tel"
              pattern="^\+?[0-9][0-9\s().\-]{6,24}$"
              title="Digits only; optional +, spaces, or dashes"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className={field}
              autoComplete="tel"
            />
          </label>
          <label className="block text-sm font-semibold">
            <ReqLabel required={!form.documentUrl}>Identity document upload</ReqLabel>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile((e.target.files && e.target.files[0]) || null)}
              className={field}
            />
            <span className="block text-xs text-dim font-normal mt-1">Image or PDF of your passport or government issued ID.</span>
          </label>
          {form.documentUrl && !file && (
            <p className="text-xs text-muted">A document is already on file.</p>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={busy || !loaded} className="or-check w-full text-white font-semibold py-3.5 rounded-[12px] disabled:opacity-60">
            {busy ? 'Submitting…' : 'Submit identity verification'}
          </button>
        </form>
      )}
      <p className="mt-6 text-sm"><Link to="/account" className="text-accent">Back to account</Link></p>
    </div>
  );
}
