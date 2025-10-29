import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials in environment variables');
}

// Create Supabase client with service role key (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper function to execute queries with error handling
export async function executeQuery(queryFn) {
  try {
    const result = await queryFn();
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    return result.data;
  } catch (error) {
    throw error;
  }
}

export default supabase;
