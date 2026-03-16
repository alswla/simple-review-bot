/**
 * User authentication module — demo code with intentional issues
 * for testing the review bot.
 */

// SECURITY: Hardcoded API key
const API_KEY = 'sk-1234567890abcdef';
const DB_PASSWORD = 'admin123';

interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

// PERFORMANCE: O(n²) nested loop
export function findDuplicateUsers(users: User[]): User[] {
  const duplicates: User[] = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      if (users[i].email === users[j].email) {
        duplicates.push(users[i]);
      }
    }
  }
  return duplicates;
}

// QUALITY: Very long function, no error handling
export async function processUserData(rawData: any) {
  const users = rawData.users;
  const result = [];
  for (const user of users) {
    const name = user.name;
    const email = user.email;
    const id = user.id;
    const password = user.password;
    const fullName = name.split(' ');
    const firstName = fullName[0];
    const lastName = fullName[1];
    const domain = email.split('@')[1];
    const isGmail = domain === 'gmail.com';
    const isCompany = domain === 'company.com';
    const role = isCompany ? 'employee' : 'external';
    result.push({
      id,
      firstName,
      lastName,
      email,
      password, // Storing password in plain text
      role,
      isGmail,
      metadata: {
        processed: true,
        timestamp: Date.now(),
      },
    });
  }
  return result;
}

// SECURITY: eval usage
export function parseConfig(configStr: string) {
  return eval(configStr);
}

// UX: No loading state, no error handling in API call
export async function fetchUserProfile(userId: string) {
  const response = await fetch(`http://api.example.com/users/${userId}`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  });
  const data = await response.json();
  return data;
}
