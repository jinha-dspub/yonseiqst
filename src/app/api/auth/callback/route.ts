import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/en/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    console.log("Auth Callback Error:", error);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const role: string = user.email === 'jinha@dspubs.org' ? 'admin' : 'student'
        const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email

        // Sync to users table (legacy)
        await supabase.from('users').upsert([
           { id: user.id, email: user.email, name: name, role: role === 'admin' ? 'superuser' : role }
        ], { onConflict: 'id', ignoreDuplicates: false })

        // Sync to profiles table
        await supabase.from('profiles').upsert([{
          id: user.id,
          email: user.email,
          full_name: name,
          avatar_url: user.user_metadata?.avatar_url || null,
          role: role
        }], { onConflict: 'id', ignoreDuplicates: false })

        // Role-based redirect
        const redirectPath = (role === 'admin' || role === 'instructor') ? '/en/dashboard' : '/en/lms'

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
