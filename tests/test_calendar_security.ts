import fs from 'fs';

const content = fs.readFileSync('src/calendar.ts', 'utf8');

const issues: string[] = [];

const lines = content.split('\n');
lines.forEach((line, index) => {
  // Debug output for lines with execSync or gog
  if (line.includes('gog')) {
      // console.log(`Checking line ${index + 1}: ${line.trim()}`);
  }

  if (line.includes('execSync') || line.includes('gog')) {

    // Check for --account ${PRIMARY_ACCOUNT} without quotes
    // Note: In the source file, it looks like: ... --account ${PRIMARY_ACCOUNT} ...
    // We want to detect this specific pattern.

    // Using simple string includes for robustness against regex escaping issues
    if (line.includes('--account ${PRIMARY_ACCOUNT}')) {
      issues.push(`Line ${index + 1}: Unquoted PRIMARY_ACCOUNT`);
    }

    if (line.includes('--account ${PARTNER_ACCOUNT}')) {
      issues.push(`Line ${index + 1}: Unquoted PARTNER_ACCOUNT`);
    }
  }
});

if (issues.length > 0) {
  console.error('Security check FAILED: Found unquoted variables in shell commands:');
  issues.forEach(i => console.error(i));
  process.exit(1);
} else {
  console.log('Security check PASSED: No unquoted account variables found.');
}
