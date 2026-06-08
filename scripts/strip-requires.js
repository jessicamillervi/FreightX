const fs = require('fs');
const path = require('path');

const escrowPath = path.resolve(__dirname, '../contracts/FreightEscrow.sol');
let content = fs.readFileSync(escrowPath, 'utf8');

// Regex to find require(condition, "string"); and replace with require(condition);
// Handling multiline strings and escaped characters
const requireRegex = /require\s*\(([^,]+),\s*"[^"]*"\s*\)/g;

content = content.replace(requireRegex, 'require($1)');

// Also replace standard reverts with generic revert
content = content.replace(/revert\s*\("[^"]*"\s*\)/g, 'revert()');

fs.writeFileSync(escrowPath, content, 'utf8');
console.log('Successfully stripped require strings from FreightEscrow.sol');
