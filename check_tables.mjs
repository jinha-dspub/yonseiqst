import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://erddtvphhkvzdglseufc.supabase.co';
const supabaseKey = 'sb_publishable_qUKAPX_C5ksX0iAprhDPbw_VZcm207R';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    // There isn't a direct "list tables" in PostgREST easily without special RPC or querying information_schema
    // But we can try a few common names or use the error hint.
    
    // Let's try to query information_schema.tables via a raw query if enabled, 
    // but usually anon key can't do that.
    
    // Instead, let's look at the codebase again for ANY other table names.
    console.log("Checking common table names...");
    const tables = ['courses', 'missions', 'programs', 'cohorts', 'units', 'sections'];
    
    for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`Table '${table}': NOT FOUND or error (${error.message})`);
        } else {
            console.log(`Table '${table}': EXISTS`);
        }
    }
}

listTables();
