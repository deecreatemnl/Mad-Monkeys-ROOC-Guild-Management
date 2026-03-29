import { SupabaseDatabase } from "./src/db";
import dotenv from "dotenv";

dotenv.config();

async function testConnection() {
  console.log("Testing Supabase connection...");
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set.");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key);

  console.log("Checking 'jobs' table...");
  const { data: jobs, error: jobsError } = await supabase.from('jobs').select('*');
  
  if (jobsError) {
    console.error("Jobs table error:", jobsError.message);
  } else {
    console.log("Jobs table found. Count:", jobs?.length);
  }

  console.log("Checking 'settings' table...");
  const { data: settings, error: settingsError } = await supabase.from('settings').select('*');
  
  if (settingsError) {
    console.error("Settings table error:", settingsError.message);
  } else {
    console.log("Settings table found. Count:", settings?.length);
  }

  console.log("Checking 'users' table...");
  const { data: users, error: usersError } = await supabase.from('users').select('*');
  
  if (usersError) {
    console.error("Users table error:", usersError.message);
  } else {
    console.log("Users table found. Count:", users?.length);
  }

  if (!jobsError && !settingsError && !usersError) {
    console.log("\nConnection test PASSED! All tables are accessible.");
  } else {
    console.log("\nConnection test completed with some errors.");
  }
}

testConnection();
