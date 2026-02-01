const { execSync } = require('child_process');

try {
  execSync('tsc', { stdio: 'inherit' });
  console.log('');
  console.log('[OK] Сборка успешна.');
} catch {
  console.log('');
  console.error('[ОШИБКА] Сборка не удалась.');
  process.exit(1);
}
