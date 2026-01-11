import bcrypt from 'bcryptjs';
import { supabase } from './src/config/database.js';

async function setupTestUsers() {
  try {
    console.log('Setting up test users...\n');

    // Get existing users
    const { data: existingUsers, error: listError } = await supabase
      .from('users')
      .select('id, username, role, company_id');
    
    if (listError) throw listError;
    
    console.log('Existing users:');
    existingUsers.forEach(u => {
      console.log(`  - ${u.username} (${u.role}) - Company: ${u.company_id}`);
    });
    console.log('');

    // Get companies
    const { data: companies, error: compError } = await supabase
      .from('companies')
      .select('id, name');
    
    if (compError) throw compError;
    
    console.log('Existing companies:');
    companies.forEach(c => {
      console.log(`  - ${c.name} (${c.id})`);
    });
    console.log('');

    const companyId = companies[0]?.id;
    if (!companyId) {
      console.error('No companies found! Please create a company first.');
      return;
    }

    // Hash password
    const password = 'CompanyAdmin@123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if companyadmin exists
    const companyadmin = existingUsers.find(u => u.username === 'companyadmin');

    if (companyadmin) {
      // Update password
      console.log('Updating companyadmin password...');
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: hashedPassword })
        .eq('username', 'companyadmin');
      
      if (updateError) throw updateError;
      console.log('✓ Password updated for companyadmin');
    } else {
      // Create new user
      console.log('Creating companyadmin user...');
      const { error: createError } = await supabase
        .from('users')
        .insert({
          username: 'companyadmin',
          password_hash: hashedPassword,
          role: 'company_admin',
          company_id: companyId,
          is_active: true,
        });
      
      if (createError) throw createError;
      console.log('✓ companyadmin user created');
    }

    console.log('\n✓ Setup complete!');
    console.log('\nTest credentials:');
    console.log('  Username: companyadmin');
    console.log('  Password: CompanyAdmin@123');
    console.log(`  Company: ${companies[0].name} (${companyId})`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

setupTestUsers();
