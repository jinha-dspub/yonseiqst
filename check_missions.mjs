import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://erddtvphhkvzdglseufc.supabase.co';
const supabaseKey = 'sb_publishable_qUKAPX_C5ksX0iAprhDPbw_VZcm207R';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissions() {
    const { data, error } = await supabase.from('missions').select('*').limit(5);
    if (error) {
        console.error('Error fetching missions:', error);
        return;
    }
    console.log('--- Missions in DB ---');
    console.log(JSON.stringify(data, null, 2));
}

async function checkPrograms() {
    const { data, error } = await supabase.from('programs').select('*').limit(5);
    if (error) {
        console.error('Error fetching programs:', error);
        return;
    }
    console.log('--- Programs in DB ---');
    console.log(JSON.stringify(data, null, 2));
}

checkMissions().then(() => checkPrograms());
