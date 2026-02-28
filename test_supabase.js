const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  
  if (bucketError) {
    console.error("Error listing buckets:", bucketError);
    return;
  }
  
  console.log("Available buckets:");
  console.log(buckets);
  
  const courseImageBucket = buckets.find(b => b.name === 'course-images');
  if (!courseImageBucket) {
    console.log("\n❌ Bucket 'course-images' does not exist.");
    return;
  }
  
  if (!courseImageBucket.public) {
    console.log("\n❌ Bucket 'course-images' exists but is NOT public.");
  } else {
    console.log("\n✅ Bucket 'course-images' exists and is public.");
  }
}

testUpload();
