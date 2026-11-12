import { api } from '@/lib/api';

/** Creates a draft "Untitled course" and returns its id, or null on failure. */
export async function createDraftCourse(): Promise<number | null> {
  try {
    const created = await api<{ id: number }>('/courses', {
      method: 'POST',
      body: JSON.stringify({ title: 'Untitled course' }),
    });
    return created.id;
  } catch {
    return null;
  }
}
