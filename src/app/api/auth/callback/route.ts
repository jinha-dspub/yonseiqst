import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email

        // Check existing role from the users table (correct schema)
        const { data: existingUser } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        // Determine role: prioritize DB value, else use email-based default
        const defaultRole = (user.email === 'jinha@dspubs.org' || user.email === 'xodusrudrl1412@gmail.com')
          ? 'admin'
          : 'student'
        const finalRole = existingUser?.role || defaultRole

        // Sync to users table (source of truth for role)
        const { error: usersError } = await supabase.from('users').upsert([
          { id: user.id, email: user.email, name: name, role: finalRole === 'admin' ? 'superuser' : finalRole }
        ], { onConflict: 'id', ignoreDuplicates: false })

        if (usersError) {
          console.error("Auth: users upsert error:", usersError.message)
        }

        // Sync to profiles table (only columns that exist)
        const { error: profilesError } = await supabase.from('profiles').upsert([{
          id: user.id,
          email: user.email,
          full_name: name,
        }], { onConflict: 'id', ignoreDuplicates: false })

        if (profilesError) {
          console.error("Auth: profiles upsert error:", profilesError.message)
        }

        // Role-based redirect
        const redirectPath = (finalRole === 'admin' || finalRole === 'instructor' || finalRole === 'staff' || finalRole === 'superuser')
          ? '/en/dashboard'
          : '/en/lms'

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
