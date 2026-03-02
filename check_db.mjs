import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://erddtvphhkvzdglseufc.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_qUKAPX_C5ksX0iAprhDPbw_VZcm207R';

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCourses() {
    const { data, error } = await supabase.from('courses').select('*');
    if (error) {
        console.error('Error fetching courses:', error);
        return;
    }
    console.log('--- Courses in DB ---');
    data.forEach(c => {
        console.log(`\nCourse ID: ${c.id}`);
        console.log(`Title: ${c.title}`);
        console.log(`Status: ${c.status}`);
        console.log(`Updated At: ${c.updated_at}`);
        
        const content = c.content || {};
        const sections = content.sections || [];
        console.log(`Sections Count: ${sections.length}`);
        
        sections.forEach((s, sIdx) => {
            console.log(`  [Section ${sIdx + 1}] Title: ${s.title}, Status: ${s.status}`);
            const subsections = s.subsections || [];
            subsections.forEach((sub, ssIdx) => {
                console.log(`    [Subsection ${sIdx + 1}.${ssIdx + 1}] Title: ${sub.title}, Status: ${sub.status}`);
                const units = sub.units || [];
                units.forEach((u, uIdx) => {
                    console.log(`      [Unit ${sIdx + 1}.${ssIdx + 1}.${uIdx + 1}] Title: ${u.title}, Status: ${u.status}`);
                });
            });
        });
    });
}

checkCourses();
