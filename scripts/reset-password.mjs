import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
const lines = envContent.split('\n');
let supabaseUrl = '', serviceKey = '';
for (const line of lines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=').slice(1).join('=');
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) serviceKey = line.split('=').slice(1).join('=');
}

// List users
const listRes = await fetch(supabaseUrl + '/auth/v1/admin/users', {
  headers: {
    'Authorization': 'Bearer ' + serviceKey,
    'apikey': serviceKey,
  }
});
const data = await listRes.json();
const user = data.users?.find(u => u.email === 'admin@over-inc.test');
if (!user) {
  console.log('User not found');
  process.exit(1);
}
console.log('Found user:', user.id);

// Update password
const updateRes = await fetch(supabaseUrl + '/auth/v1/admin/users/' + user.id, {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + serviceKey,
    'apikey': serviceKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ password: 'Test1234!' })
});
const result = await updateRes.json();
if (result.id) {
  console.log('Password reset successful!');
} else {
  console.log('Error:', JSON.stringify(result));
}
