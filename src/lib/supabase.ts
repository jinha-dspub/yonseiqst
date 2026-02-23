import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
// 사용자가 새 API 키 포맷을 사용하는 것 같으므로 변수명이나 설명을 거기에 맞출 수 있습니다.
// 하지만 Supabase JS 클라이언트는 여전히 anon/public 키를 두 번째 인자로 받습니다.
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
