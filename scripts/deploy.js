const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const configPath = path.join(__dirname, '../src/app/api/auth/config/route.ts');
const sessionPath = path.join(__dirname, '../src/app/api/auth/session/route.ts');
const devStorePath = path.join(__dirname, '../src/app/api/dev-store/route.ts');

console.log('Injecting GitHub OAuth credentials and dev-store edge runtime for Cloudflare Pages build...');

// Backup original files
const configBackup = fs.readFileSync(configPath, 'utf8');
const sessionBackup = fs.readFileSync(sessionPath, 'utf8');
const devStoreBackup = fs.readFileSync(devStorePath, 'utf8');

try {
  // Inject into config/route.ts
  let configContent = configBackup;
  configContent = configContent.replace(
    /const hasGitHub = !!\(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET\);/,
    `const hasGitHub = true;`
  );
  configContent = configContent.replace(
    /clientId: hasGitHub \? process.env.GITHUB_CLIENT_ID : 'ox-game-client',/,
    `clientId: 'Ov23lib07055EJYCq5xN',`
  );
  fs.writeFileSync(configPath, configContent, 'utf8');

  // Inject into session/route.ts
  let sessionContent = sessionBackup;
  sessionContent = sessionContent.replace(
    /const hasGitHubConfig = !!\(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET\);/,
    `const hasGitHubConfig = true;`
  );
  sessionContent = sessionContent.replace(
    /client_id: process.env.GITHUB_CLIENT_ID,/,
    `client_id: 'Ov23lib07055EJYCq5xN',`
  );
  sessionContent = sessionContent.replace(
    /client_secret: process.env.GITHUB_CLIENT_SECRET,/,
    `client_secret: '70cfba54b1a6d679b75be6ba23a2491285d7d86b',`
  );
  fs.writeFileSync(sessionPath, sessionContent, 'utf8');

  // Inject into dev-store/route.ts (convert runtime to edge)
  let devStoreContent = devStoreBackup;
  devStoreContent = devStoreContent.replace(
    /export const runtime = 'nodejs';/,
    `export const runtime = 'edge';`
  );
  fs.writeFileSync(devStorePath, devStoreContent, 'utf8');

  console.log('Building Cloudflare Pages output (next-on-pages)...');
  execSync('npm run open-next', { stdio: 'inherit' });

} finally {
  // Restore original files
  console.log('Restoring original code files...');
  fs.writeFileSync(configPath, configBackup, 'utf8');
  fs.writeFileSync(sessionPath, sessionBackup, 'utf8');
  fs.writeFileSync(devStorePath, devStoreBackup, 'utf8');
}

console.log('Deploying build output to Cloudflare Pages...');
execSync('wrangler pages deploy build_output', { stdio: 'inherit' });
console.log('Deployment completed successfully!');
