import { execSync } from 'child_process';
console.log(execSync('git log -n 2 --stat').toString());
