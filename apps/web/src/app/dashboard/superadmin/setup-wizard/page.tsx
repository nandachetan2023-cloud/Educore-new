'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Building2, Check, CreditCard, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { SuperAdminShell } from '@/components/superadmin-shell';
import type { PlanRow } from '@/lib/types';

interface TenantOption {
  id: number;
  name: string;
  slug: string;
  owner: { email: string };
}

interface TenantSetupForm {
  tenantName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  planId: string;
}

interface SsoConfig {
  tenantId: number;
  enabled: boolean;
  label: string | null;
  metadataUrl: string | null;
  entryPoint: string | null;
  issuer: string | null;
  cert: string | null;
  spMetadataUrl: string | null;
  acsUrl: string | null;
  loginUrl: string | null;
}

interface RazorpaySettings {
  keyId: string;
  keySecret: string;
  enabled: boolean;
}

const EMPTY_SSO: SsoConfig = {
  tenantId: 0,
  enabled: false,
  label: null,
  metadataUrl: null,
  entryPoint: null,
  issuer: null,
  cert: null,
  spMetadataUrl: null,
  acsUrl: null,
  loginUrl: null,
};

const STEPS = ['Tenant', 'Authentication', 'Payments', 'Complete'];

export default function SetupWizardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [tenantMode, setTenantMode] = useState<'new' | 'existing'>('new');
  const [tenantForm, setTenantForm] = useState<TenantSetupForm>({
    tenantName: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    planId: '',
  });
  const [createdTenant, setCreatedTenant] = useState<TenantOption | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [sso, setSso] = useState<SsoConfig>(EMPTY_SSO);
  const [razorpay, setRazorpay] = useState<RazorpaySettings>({ keyId: '', keySecret: '', enabled: false });
  const [hasRazorpaySecret, setHasRazorpaySecret] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [gatewayTested, setGatewayTested] = useState(false);
  const ssoRequestId = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?next=/dashboard/superadmin/setup-wizard');
      return;
    }
    if (user.principal !== 'admin' || user.adminRole !== 'super_admin') {
      router.push('/dashboard');
      return;
    }

    Promise.all([
      api<TenantOption[]>('/admin/tenants'),
      api<PlanRow[]>('/admin/plans'),
      api<RazorpaySettings>('/admin/payment-settings'),
    ])
      .then(([tenantRows, planRows, paymentSettings]) => {
        setTenants(tenantRows);
        setPlans(planRows);
        setTenantForm((current) => ({ ...current, planId: current.planId || (planRows[0] ? String(planRows[0].id) : '') }));
        setRazorpay({ keyId: paymentSettings.keyId, keySecret: '', enabled: paymentSettings.enabled });
        setHasRazorpaySecret(Boolean(paymentSettings.keySecret));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load plans and payment settings'))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  const loadSso = useCallback(async (id: string) => {
    const requestId = ++ssoRequestId.current;
    if (!id) {
      setSso(EMPTY_SSO);
      setSsoLoading(false);
      return;
    }
    setSsoLoading(true);
    setError(null);
    try {
      const config = await api<SsoConfig>(`/auth/saml/config/tenant/${id}`);
      if (requestId === ssoRequestId.current) setSso(config);
    } catch (e) {
      if (requestId === ssoRequestId.current) {
        setError(e instanceof ApiError ? e.message : 'Could not load workspace authentication settings');
      }
    } finally {
      if (requestId === ssoRequestId.current) setSsoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && tenantId) void loadSso(tenantId);
  }, [loading, tenantId, loadSso]);

  const saveSso = async () => {
    if (!tenantId) {
      setError('Select a workspace first.');
      return false;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await api<SsoConfig>(`/auth/saml/config/tenant/${tenantId}`, {
        method: 'PUT',
        body: JSON.stringify({
          enabled: sso.enabled,
          label: sso.label || null,
          metadataUrl: sso.metadataUrl || null,
          entryPoint: sso.entryPoint || null,
          issuer: sso.issuer || null,
          cert: sso.cert || null,
        }),
      });
      setSso(saved);
      setMessage('Workspace authentication settings saved.');
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save authentication settings');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveAndTestGateway = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    setGatewayTested(false);
    try {
      const payload: { keyId: string; keySecret?: string } = { keyId: razorpay.keyId };
      if (razorpay.keySecret.trim()) payload.keySecret = razorpay.keySecret;
      const saved = await api<RazorpaySettings>('/admin/payment-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setRazorpay({ keyId: saved.keyId, keySecret: '', enabled: saved.enabled });
      setHasRazorpaySecret(Boolean(saved.keySecret));
      if (!saved.enabled) {
        setError('Enter both the Razorpay Key ID and Key Secret before testing.');
        return;
      }
      const result = await api<{ ok: boolean; keyId: string }>('/admin/payment-settings/razorpay/test', {
        method: 'POST',
      });
      setGatewayTested(result.ok);
      setMessage(`Razorpay connection verified for ${result.keyId}.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save or test Razorpay settings');
    } finally {
      setBusy(false);
    }
  };

  const goNext = async () => {
    if (step === 0) {
      if (tenantMode === 'existing') {
        if (!tenantId) {
          setError('Select an existing workspace to continue.');
          return;
        }
        setError(null);
        setStep(1);
        return;
      }
      if (createdTenant) {
        setStep(1);
        setError(null);
        return;
      }
      if (!tenantForm.tenantName.trim() || !tenantForm.adminName.trim() || !tenantForm.adminEmail.trim()
        || tenantForm.adminPassword.length < 8 || !tenantForm.planId) {
        setError('Enter the workspace, owner, password, and plan details to continue.');
        return;
      }
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const tenant = await api<TenantOption>('/admin/tenants', {
          method: 'POST',
          body: JSON.stringify({
            ...tenantForm,
            tenantName: tenantForm.tenantName.trim(),
            adminName: tenantForm.adminName.trim(),
            adminEmail: tenantForm.adminEmail.trim(),
            planId: Number(tenantForm.planId),
          }),
        });
        setCreatedTenant(tenant);
        setTenants((current) => current.some((item) => item.id === tenant.id) ? current : [tenant, ...current]);
        setTenantId(String(tenant.id));
        setTenantForm((current) => ({ ...current, adminPassword: '' }));
        setSso({ ...EMPTY_SSO, tenantId: tenant.id });
        setMessage(`${tenant.name} created. Continue to authentication setup.`);
        setStep(1);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to create tenant');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step === 1 && !(await saveSso())) return;
    setError(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const selectedTenant = createdTenant ?? tenants.find((tenant) => String(tenant.id) === tenantId) ?? null;

  if (authLoading || loading) {
    return <SuperAdminShell><div className="py-20 text-center text-muted">Loading setup wizard…</div></SuperAdminShell>;
  }

  return (
    <SuperAdminShell>
      <Link href="/dashboard/superadmin" className="flex items-center gap-1.5 text-sm text-muted hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Platform console
      </Link>
      <div className="mt-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">New tenant setup</h1>
        <p className="mt-1 text-sm text-muted">
          Set up a new or existing tenant’s optional SAML sign-in, then save and verify the platform Razorpay gateway.
        </p>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((title, index) => (
          <div key={title} className={`rounded-xl border p-3 text-sm font-semibold ${step === index ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-card text-muted'}`}>
            <span className="mr-2">{index + 1}.</span>{title}
          </div>
        ))}
      </div>

      {(error || message) && (
        <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${error ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-700'}`}>
          {error ?? message}
        </p>
      )}

      <section className="mt-5 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-7">
        {step === 0 && (
          <div className="max-w-2xl">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><Building2 className="h-5 w-5 text-brand" /> Choose tenant setup</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" className={`rounded-xl border p-4 text-left transition ${tenantMode === 'new' ? 'border-brand bg-brand-soft' : 'border-line hover:bg-surface'}`} onClick={() => { setTenantMode('new'); setTenantId(''); setError(null); setMessage(null); }}>
                <span className="block text-sm font-semibold text-ink">Sell a new tenant</span>
                <span className="mt-1 block text-xs text-muted">Create a workspace and its first admin.</span>
              </button>
              <button type="button" className={`rounded-xl border p-4 text-left transition ${tenantMode === 'existing' ? 'border-brand bg-brand-soft' : 'border-line hover:bg-surface'}`} onClick={() => { setTenantMode('existing'); setCreatedTenant(null); setTenantId(tenants[0] ? String(tenants[0].id) : ''); setError(null); setMessage(null); }}>
                <span className="block text-sm font-semibold text-ink">Set up an existing tenant</span>
                <span className="mt-1 block text-xs text-muted">Update authentication without creating another workspace.</span>
              </button>
            </div>
            {tenantMode === 'existing' ? (
              tenants.length ? (
                <div className="mt-5">
                  <label className="label" htmlFor="wizard-existing-tenant">Existing workspace</label>
                  <select id="wizard-existing-tenant" className="input" value={tenantId} onChange={(e) => { setTenantId(e.target.value); setMessage(null); setError(null); setGatewayTested(false); }}>
                    {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} — {tenant.owner.email}</option>)}
                  </select>
                  {selectedTenant && <p className="mt-2 text-xs text-muted">Workspace slug: {selectedTenant.slug}</p>}
                </div>
              ) : (
                <p className="mt-5 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-700">There are no existing tenants to configure.</p>
              )
            ) : createdTenant ? (
              <div className="mt-5 rounded-xl bg-green-500/10 p-4 text-sm text-green-700">
                <p className="font-semibold">{createdTenant.name} is ready.</p>
                <p className="mt-1">Owner: {createdTenant.owner.email} · Workspace slug: {createdTenant.slug}</p>
              </div>
            ) : plans.length === 0 ? (
              <p className="mt-5 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-700">Create an active subscription plan before onboarding a tenant.</p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="wizard-tenant-name">Workspace / brand name</label>
                  <input id="wizard-tenant-name" required className="input" placeholder="Acme Academy" value={tenantForm.tenantName} onChange={(e) => setTenantForm((current) => ({ ...current, tenantName: e.target.value }))} />
                </div>
                <div>
                  <label className="label" htmlFor="wizard-plan">Plan</label>
                  <select id="wizard-plan" required className="input" value={tenantForm.planId} onChange={(e) => setTenantForm((current) => ({ ...current, planId: e.target.value }))}>
                    {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} — {(plan.priceMonthly / 100).toFixed(2)} {plan.currency}/mo</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="wizard-admin-name">Admin name</label>
                  <input id="wizard-admin-name" required className="input" placeholder="Jane Owner" value={tenantForm.adminName} onChange={(e) => setTenantForm((current) => ({ ...current, adminName: e.target.value }))} />
                </div>
                <div>
                  <label className="label" htmlFor="wizard-admin-email">Admin email</label>
                  <input id="wizard-admin-email" required type="email" className="input" placeholder="owner@example.com" value={tenantForm.adminEmail} onChange={(e) => setTenantForm((current) => ({ ...current, adminEmail: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="wizard-admin-password">Admin password (minimum 8 characters)</label>
                  <input id="wizard-admin-password" required type="password" minLength={8} autoComplete="new-password" className="input" placeholder="Choose a strong password" value={tenantForm.adminPassword} onChange={(e) => setTenantForm((current) => ({ ...current, adminPassword: e.target.value }))} />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><ShieldCheck className="h-5 w-5 text-brand" /> Authentication — {selectedTenant?.name}</h2>
            <p className="mt-1 text-sm text-muted">Email/password sign-in stays available. SAML is optional and applies only to this workspace.</p>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="flex items-start gap-3 rounded-xl border border-line p-4 lg:col-span-2">
                <input type="checkbox" className="mt-1 accent-brand" checked={sso.enabled} onChange={(e) => setSso((current) => ({ ...current, enabled: e.target.checked }))} />
                <span><span className="block text-sm font-semibold text-ink">Enable SAML single sign-on</span><span className="mt-1 block text-xs text-muted">The workspace login page will show the SSO option when configured.</span></span>
              </label>
              <div>
                <label className="label" htmlFor="sso-label">Sign-in button label</label>
                <input id="sso-label" className="input" placeholder="Sign in with company SSO" value={sso.label ?? ''} onChange={(e) => setSso((current) => ({ ...current, label: e.target.value }))} />
              </div>
              <div>
                <label className="label" htmlFor="sso-metadata">Identity provider metadata URL</label>
                <input id="sso-metadata" type="url" className="input" placeholder="https://identity-provider.example/metadata" value={sso.metadataUrl ?? ''} onChange={(e) => setSso((current) => ({ ...current, metadataUrl: e.target.value }))} />
              </div>
              <details className="rounded-xl border border-line p-4 lg:col-span-2">
                <summary className="cursor-pointer text-sm font-semibold text-ink">Advanced — manual SAML settings</summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div><label className="label" htmlFor="sso-entry">Identity provider SSO URL</label><input id="sso-entry" type="url" className="input" value={sso.entryPoint ?? ''} onChange={(e) => setSso((current) => ({ ...current, entryPoint: e.target.value }))} /></div>
                  <div><label className="label" htmlFor="sso-issuer">Service provider issuer override</label><input id="sso-issuer" className="input" value={sso.issuer ?? ''} onChange={(e) => setSso((current) => ({ ...current, issuer: e.target.value }))} /></div>
                  <div className="lg:col-span-2"><label className="label" htmlFor="sso-cert">Identity provider signing certificate</label><textarea id="sso-cert" className="input min-h-28 font-mono text-xs" value={sso.cert ?? ''} onChange={(e) => setSso((current) => ({ ...current, cert: e.target.value }))} /></div>
                </div>
              </details>
              <div className="rounded-xl bg-surface p-4 text-xs text-muted lg:col-span-2">
                <p className="font-semibold text-ink">Identity provider callback details (after save)</p>
                <p className="mt-2 break-all">ACS / Reply URL: {sso.acsUrl ?? 'Generated by the API'}</p>
                <p className="mt-1 break-all">Service provider metadata: {sso.spMetadataUrl ?? 'Generated after the workspace is selected'}</p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-3xl">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><CreditCard className="h-5 w-5 text-brand" /> Payment gateway</h2>
            <p className="mt-1 text-sm text-muted">
              Razorpay credentials are currently shared platform-wide. This step saves credentials using the existing secure settings endpoint and tests the provider connection.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="razorpay-key">Razorpay Key ID</label><input id="razorpay-key" className="input font-mono" autoComplete="off" placeholder="rzp_test_…" value={razorpay.keyId} onChange={(e) => { setRazorpay((current) => ({ ...current, keyId: e.target.value })); setGatewayTested(false); }} /></div>
              <div><label className="label" htmlFor="razorpay-secret">Razorpay Key Secret</label><input id="razorpay-secret" type="password" className="input font-mono" autoComplete="new-password" placeholder={hasRazorpaySecret ? 'Saved — enter only to replace' : 'Enter key secret'} value={razorpay.keySecret} onChange={(e) => { setRazorpay((current) => ({ ...current, keySecret: e.target.value })); setGatewayTested(false); }} /></div>
            </div>
            <p className="mt-2 text-xs text-muted">Saved secrets are never displayed again. Leave the secret blank to keep the current one. Use test credentials before enabling live checkout.</p>
            {gatewayTested && <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-green-700"><Check className="h-4 w-4" /> Gateway connection verified.</p>}
            <button type="button" className="btn-primary mt-5" disabled={busy} onClick={saveAndTestGateway}>{busy ? 'Saving and testing…' : 'Save and test Razorpay'}</button>
            <p className="mt-4 text-xs text-muted">Other gateways (Stripe and PayPal) remain configured through the API environment, as in the current platform setup.</p>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-2xl">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><Check className="h-5 w-5 text-green-600" /> Setup complete</h2>
            <p className="mt-2 text-sm text-muted">The selected workspace authentication settings were saved. The platform Razorpay settings {gatewayTested ? 'were tested successfully' : 'can be completed later'}.</p>
            <dl className="mt-5 space-y-3 rounded-xl bg-surface p-4 text-sm">
              <div><dt className="text-muted">Workspace</dt><dd className="font-semibold text-ink">{selectedTenant?.name ?? '—'}</dd></div>
              <div><dt className="text-muted">SAML SSO</dt><dd className="font-semibold text-ink">{sso.enabled ? 'Enabled' : 'Disabled'}</dd></div>
              <div><dt className="text-muted">Razorpay</dt><dd className="font-semibold text-ink">{gatewayTested ? 'Connected and tested' : razorpay.enabled ? 'Configured — not tested in this wizard' : 'Not configured'}</dd></div>
            </dl>
            <Link href="/dashboard/superadmin/tenants" className="btn-primary mt-5 inline-flex">Back to workspaces</Link>
          </div>
        )}

        <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-line pt-5">
          <button type="button" className="btn-ghost" disabled={step === 0 || busy} onClick={() => { setError(null); setStep((current) => Math.max(current - 1, 0)); }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </button>
          {step < 2 && <button type="button" className="btn-primary" disabled={busy || (step === 0 && ((tenantMode === 'new' && plans.length === 0 && !createdTenant) || (tenantMode === 'existing' && tenants.length === 0))) || (step === 1 && ssoLoading)} onClick={() => void goNext()}>{busy ? 'Creating…' : step === 1 ? (ssoLoading ? 'Loading authentication…' : 'Save and continue') : tenantMode === 'existing' ? 'Continue with existing tenant' : createdTenant ? 'Continue' : 'Create tenant and continue'} <ArrowRight className="ml-1 h-4 w-4" /></button>}
          {step === 2 && <button type="button" className="btn-ghost" disabled={busy} onClick={() => { setError(null); setStep(3); }}>Skip gateway setup</button>}
          {step === 2 && gatewayTested && <button type="button" className="btn-primary" onClick={() => { setError(null); setStep(3); }}>Finish <ArrowRight className="ml-1 h-4 w-4" /></button>}
        </div>
      </section>
    </SuperAdminShell>
  );
}
