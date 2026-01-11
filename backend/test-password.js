// Test password verification
import bcrypt from 'bcrypt';

const testPassword = 'Admin@123';
const hashFromDB = '$2b$10$Et2RfBzrlSLBpLXu58fzhOyB37.E.d.p0qQqDTDWXBLbJZviZy.kK';

console.log('🔐 Testing password verification...');
console.log('Password:', testPassword);
console.log('Hash:', hashFromDB);

bcrypt.compare(testPassword, hashFromDB)
  .then(result => {
    console.log('\n✅ Password match result:', result);
    if (result) {
      console.log('✅ Password verification WORKS!');
    } else {
      console.log('❌ Password verification FAILED!');
      console.log('\n🔧 Generating new hash...');
      return bcrypt.hash(testPassword, 10);
    }
  })
  .then(newHash => {
    if (newHash) {
      console.log('New hash:', newHash);
      console.log('\n📝 Use this hash in your SQL:');
      console.log(`UPDATE users SET password_hash = '${newHash}' WHERE username = 'admin';`);
    }
  })
  .catch(err => {
    console.error('💥 Error:', err);
  });
