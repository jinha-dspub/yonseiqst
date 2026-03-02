import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { locales } from './i18n'

// Create the next-intl middleware instance
const intlMiddleware = createIntlMiddleware({
  locales: locales,
  defaultLocale: 'ko'
})

export async function middleware(request: NextRequest) {
  // 1. Let next-intl handle localization routing first
  const intlResponse = intlMiddleware(request)
  
  // Create a new response initialized with intl's response headers/status
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
  
  // Copy over the headers/status/url from next-intl (eg. redirect to /ko/...)
  // if intlResponse decided to redirect or rewrite
  if (intlResponse.status !== 200) {
      supabaseResponse = intlResponse
  }

  // 2. Refresh the Supabase Auth Session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          // Also set on the response object so the browser cookie gets updated
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Fetching the user from Supabase to refresh the token if it's expired
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
}
