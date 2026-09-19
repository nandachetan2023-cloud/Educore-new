/**
 * The three principal identities in the platform. Admins live in a separate
 * table (mirrors the original Laravel dual-guard design); instructors and
 * students share the `users` table, distinguished by their `role` column.
 */
export enum Principal {
  ADMIN = 'admin',
  INSTRUCTOR = 'instructor',
  STUDENT = 'student',
}
