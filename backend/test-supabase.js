// Test Supabase connection and user data
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testConnection() {
  console.log('🔍 Testing Supabase connection...');
  console.log('URL:', process.env.SUPABASE_URL);
  console.log('Key length:', process.env.SUPABASE_SERVICE_KEY?.length);
  
  try {
    // Try to fetch users
    const { data, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) {
      console.error('❌ Error fetching users:', error);
    } else {
      console.log('✅ Successfully connected to Supabase!');
      console.log('📊 Users in database:', data?.length || 0);
      
      if (data && data.length > 0) {
        console.log('\n👥 Users found:');
        data.forEach(user => {
          console.log(`  - ${user.username} (${user.role}) - Active: ${user.is_active}`);
          console.log(`    Password hash: ${user.password_hash?.substring(0, 30)}...`);
        });
      } else {
        console.log('⚠️  No users found in database!');
        console.log('\n💡 You need to run the FIX_USERS.sql script in Supabase SQL Editor');
      }
    }
    
    // Test fetching specific user
    console.log('\n🔍 Testing login query for "admin"...');
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('*')
      .eq('username', 'admin')
      .single();
    
    if (adminError) {
      console.error('❌ Error fetching admin user:', adminError.message);
    } else if (adminUser) {
      console.log('✅ Admin user found:', adminUser.username);
    } else {
      console.log('❌ Admin user not found');
    }
    
  } catch (err) {
    console.error('💥 Fatal error:', err.message);
  }
}

testConnection();
