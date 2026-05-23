const fs = require('fs');
const content = fs.readFileSync('c:/Users/Victus/Desktop/vegas/frontend/src/pages/common/ProfileVerification.tsx', 'utf8');
let braceCount = 0;
let parenCount = 0;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '{') braceCount++;
  if (content[i] === '}') braceCount--;
  if (content[i] === '(') parenCount++;
  if (content[i] === ')') parenCount--;
}
console.log('Brace count:', braceCount);
console.log('Paren count:', parenCount);
