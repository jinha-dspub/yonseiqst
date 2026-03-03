import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  console.log("Auth Flow - Callback Hit! Origin:", origin, "Params:", searchParams.toString());
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/en/dashboard'

  if (code) {
    console.log("Auth Flow - Code found, initiating session exchange...");
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    console.log("Auth Callback Error:", error);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        console.log("Auth Flow - User ID:", user.id);
        const { data: existingProfile, error: selectError } = await supabase.from('profiles').select('role').eq('id', user.id).single()

        if (selectError) {
          console.error("Auth Flow - Error selecting profile:", selectError.message, selectError.details);
        }

        // Define default role logic, but prioritize existing role from the database if present
        const defaultRole = (user.email === 'jinha@dspubs.org' || user.email === 'xodusrudrl1412@gmail.com') ? 'admin' : 'student'
        const finalRole = existingProfile?.role || defaultRole
        console.log("Auth Flow - Final Role:", finalRole);

        const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email

        // Sync to users table (legacy)
        const { error: usersError } = await supabase.from('users').upsert([
          { id: user.id, email: user.email, name: name, role: finalRole === 'admin' ? 'superuser' : finalRole }
        ], { onConflict: 'id', ignoreDuplicates: false })

        if (usersError) {
          console.error("Auth Flow - Error upserting to users table:", usersError.message, usersError.details);
        }

        // Sync to profiles table
        const { error: profilesError } = await supabase.from('profiles').upsert([{
          id: user.id,
          email: user.email,
          full_name: name,
          avatar_url: user.user_metadata?.avatar_url || null,
          role: finalRole
        }], { onConflict: 'id', ignoreDuplicates: false })

        if (profilesError) {
          console.error("Auth Flow - Error upserting to profiles table:", profilesError.message, profilesError.details);
        }

        // Role-based redirect
        let redirectPath = (finalRole === 'admin' || finalRole === 'instructor' || finalRole === 'staff') ? '/en/dashboard' : '/en/lms'

        const errors: string[] = [];
        if (selectError) errors.push(`select_error:${selectError.message}`);
        if (usersError) errors.push(`users_error:${usersError.message}`);
        if (profilesError) errors.push(`profiles_error:${profilesError.message}`);

        if (errors.length > 0) {
          redirectPath += `?error_details=${encodeURIComponent(errors.join('|'))}`;
        }

        const forwardedHost = request.headers.get('x-forwarded-host')
        const isLocalEnv = process.env.NODE_ENV === 'development'
        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${redirectPath}`)
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${redirectPath}`)
        } else {
          return NextResponse.redirect(`${origin}${redirectPath}`)
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
