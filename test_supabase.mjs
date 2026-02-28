import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

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
  
  console.log("Available buckets:", buckets.map(b => b.name));
  
  const courseImageBucket = buckets.find(b => b.name === 'course-images');
  if (!courseImageBucket) {
    console.log("\n❌ Bucket 'course-images' does not exist. Ensure you created it in the Supabase Dashboard.");
    return;
  } else {
    console.log("\n✅ Bucket 'course-images' exists.");
  }
  
  if (!courseImageBucket.public) {
    console.log("\n❌ Bucket 'course-images' exists but is NOT public.");
  } else {
    console.log("\n✅ Bucket 'course-images' is public.");
  }

  // Next, let's try a test upload to see WHAT the error is (often RLS)
  console.log("\nAttempting to upload a dummy file to test RLS policies...");
  
  // create dummy file
  fs.writeFileSync('dummy.txt', 'test content');
  const dummyFile = fs.readFileSync('dummy.txt');
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('course-images')
    .upload(`test-upload-${Date.now()}.txt`, dummyFile, {
        contentType: 'text/plain'
    });
    
  if (uploadError) {
      console.log("❌ Upload failed with error:");
      console.dir(uploadError, { depth: null });
  } else {
      console.log("✅ Upload successful! Data:", uploadData);
  }
  
  fs.unlinkSync('dummy.txt');
}

testUpload();
