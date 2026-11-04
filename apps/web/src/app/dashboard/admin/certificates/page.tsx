'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Award, Plus } from 'lucide-react';
import { useAuth } from '@/lib/providers';
import { DirectoryShell } from '@/components/directory-shell';
import { api, downloadFile, ApiError } from '@/lib/api';

interface CertRecord {
  id: number;
  studentId: number;
  courseId: number;
  style: string;
  issuedAt: string;
  issuedBy: string;
  pdfUrl?: string | null;
  student?: { id: number; name: string; email: string };
  course?: { id: number; title: string };
}

const STYLES = ['Classic', 'Modern', 'Minimal', 'Elegant', 'Bold', 'Gradient', 'Vintage', 'Neon', 'Artisan', 'Corporate'];

export default function AdminCertificatesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [records, setRecords] = useState<CertRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [students, setStudents] = useState<{id:number; name:string}[]>([]);
  const [courses, setCourses] = useState<{id:number; title:string}[]>([]);
  const [form, setForm] = useState({ studentId: 0, courseId: 0, style: STYLES[0] });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [certs, studsRaw, crsRaw] = await Promise.all([
      api<CertRecord[]>('/admin/certificates').catch(()=>[]),
      api<any[]>('/admin/users?role=student').catch(()=>[]),
      api<{ data?: {id:number;title:string}[]; meta?: any }>('/courses?perPage=100').catch(()=>({ data: [] })),
    ]);
    setRecords(certs);
    setStudents((studsRaw as any[]).map((s: any) => ({ id: s.id, name: s.name })));
    setCourses(((crsRaw as any)?.data ?? []).map((c: any) => ({ id: c.id, title: c.title })));
  };

  useEffect(() => {
    if (loading) return;
    if (!user || user.principal !== 'admin') router.push('/login');
    load();
  }, [user, loading]);

  const create = async () => {
    if (!form.studentId || !form.courseId) {
      alert('Select a student and a course first.');
      return;
    }
    setBusy(true);
    try {
      await api('/admin/certificates', { method: 'POST', body: JSON.stringify({ studentId: form.studentId, courseId: form.courseId, style: form.style }) });
      setShowForm(false);
      setForm({ studentId: 0, courseId: 0, style: STYLES[0] });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Could not issue certificate.');
    } finally {
      setBusy(false);
    }
  };

  const download = async (id: number) => {
    try {
      await downloadFile(`/admin/certificates/${id}/pdf`, `certificate-${id}.pdf`);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Could not download the certificate PDF.');
    }
  };

  const del = async (id: number) => {
    if (!confirm('Delete certificate record?')) return;
    try {
      await api(`/admin/certificates/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Could not delete certificate.');
    }
  };

  if (loading) return <div className="py-20 text-center text-muted">Loading…</div>;

  return (
    <DirectoryShell eyebrow="Admin Console" sections={[{ heading: 'Certificates', links: [{ href: '/dashboard/admin/certificates', label: 'Certificates', icon: <Award size={17}/> }, { href: '/dashboard/admin', label: 'Back', icon: <Award size={17}/> }]} ]} userName={user?.name ?? 'Admin'} userCaption="Tenant admin" onLogout={() => router.push('/login')}>
      <div className="mx-auto max-w-[1100px]">
        <header className="mb-6 flex items-end justify-between">
          <div>
            <p className="mb-1 text-[12.5px] font-semibold text-brand">CERTIFICATES</p>
            <h1 className="text-[27px] font-semibold">Certificate Issuance</h1>
            <p className="mt-1 text-sm text-muted">Issue certificates to students after course completion. Choose one of 10 preset styles.</p>
          </div>
          <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowForm(true)}><Plus size={16}/> Issue new</button>
        </header>

        {showForm && (
          <div className="card mb-6 p-5">
            <h3 className="font-bold mb-3">New certificate</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <select className="input" value={form.studentId} onChange={e=>setForm(f=>({...f,studentId:Number(e.target.value)}))}>
                <option value={0}>Select student</option>
                {students.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="input" value={form.courseId} onChange={e=>setForm(f=>({...f,courseId:Number(e.target.value)}))}>
                <option value={0}>Select course</option>
                {courses.map(c=> <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <select className="input" value={form.style} onChange={e=>setForm(f=>({...f,style:e.target.value}))}>
                {STYLES.map(s=> <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn" onClick={()=>setShowForm(false)}>Cancel</button>
              <button className="btn-primary" disabled={busy} onClick={create}>{busy ? 'Issuing…' : 'Issue'}</button>
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-[11px] uppercase text-muted">
              <tr>
                <th className="px-4 py-3 text-left">Student</th>
                <th className="px-4 py-3 text-left">Course</th>
                <th className="px-4 py-3 text-left">Style</th>
                <th className="px-4 py-3 text-left">Issued</th>
                <th className="px-4 py-3 text-left">By</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {records.map(r=>(
                <tr key={r.id}>
                  <td className="px-4 py-3">{r.student?.name ?? `Student #${r.studentId}`}</td>
                  <td className="px-4 py-3">{r.course?.title ?? `Course #${r.courseId}`}</td>
                  <td className="px-4 py-3">{r.style}</td>
                  <td className="px-4 py-3">{new Date(r.issuedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{r.issuedBy}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-sm text-brand hover:underline mr-3" onClick={()=>download(r.id)}>Download PDF</button>
                    <button className="text-sm text-red-500 hover:underline" onClick={()=>del(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {records.length===0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted">No certificates issued yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </DirectoryShell>
  );
}
