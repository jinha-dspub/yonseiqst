-- ==============================================================================
-- Add 'lecturer' role to ALL RLS policies
-- This is needed because lecturer users can access the CMS UI 
-- but the RLS policies were blocking their DB operations.
-- Run this in the Supabase SQL Editor.
-- ==============================================================================

-- 1. Cohorts: lecturer can manage
drop policy if exists "Staff can manage cohorts" on public.cohorts;
create policy "Staff can manage cohorts" on public.cohorts for all using (
  public.get_auth_role() in ('staff', 'admin', 'superuser', 'lecturer')
);

-- 2. Cohort Memberships: lecturer can manage (INSERT, SELECT, DELETE)
drop policy if exists "Staff can manage memberships" on public.cohort_memberships;
create policy "Staff can manage memberships" on public.cohort_memberships for all using (
  public.get_auth_role() in ('staff', 'admin', 'superuser', 'lecturer')
);

-- 3. Cohort Memberships: lecturer can UPDATE (needed for upsert)
drop policy if exists "Staff can update memberships" on public.cohort_memberships;
create policy "Staff can update memberships" on public.cohort_memberships for update using (
  public.get_auth_role() in ('staff', 'admin', 'superuser', 'lecturer')
);

-- 4. Cohort Instructors: lecturer can manage
drop policy if exists "Staff can manage instructors" on public.cohort_instructors;
create policy "Staff can manage instructors" on public.cohort_instructors for all using (
  public.get_auth_role() in ('staff', 'admin', 'superuser', 'lecturer')
);

-- 5. Cohort Instructors: lecturer can UPDATE
drop policy if exists "Staff can update instructors" on public.cohort_instructors;
create policy "Staff can update instructors" on public.cohort_instructors for update using (
  public.get_auth_role() in ('staff', 'admin', 'superuser', 'lecturer')
);

-- 6. Users table: lecturer can view all profiles
drop policy if exists "Staff can view all profiles" on public.users;
create policy "Staff can view all profiles" on public.users for select using (
  public.get_auth_role() in ('staff', 'admin', 'superuser', 'lecturer')
);

-- 7. Users table: lecturer can update students (for cohort sync)
drop policy if exists "Staff can update users" on public.users;
create policy "Staff can update users" on public.users for update using (
  public.get_auth_role() in ('staff', 'admin', 'superuser', 'lecturer')
);

-- 8. Programs: lecturer can view
drop policy if exists "Staff can view programs" on public.programs;
create policy "Staff can view programs" on public.programs for select using (
  public.get_auth_role() in ('staff', 'admin', 'superuser', 'lecturer')
);

-- 9. Program assignments: lecturer can view
drop policy if exists "Staff can view program_assignments" on public.program_assignments;
create policy "Staff can view program_assignments" on public.program_assignments for select using (
  public.get_auth_role() in ('staff', 'admin', 'superuser', 'lecturer')
);
