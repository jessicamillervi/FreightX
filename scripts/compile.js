const path = require('path');
const fs = require('fs');
const solc = require('solc');

const contractsDir = path.resolve(__dirname, '../contracts');
const files = fs.readdirSync(contractsDir).filter(file => file.endsWith('.sol'));

const sources = {};
for (const file of files) {
  sources[file] = {
    content: fs.readFileSync(path.resolve(contractsDir, file), 'utf8')
  };
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    viaIR: true,
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode']
      }
    },
    optimizer: {
      enabled: true,
      runs: 1
    }
  }
};

function findImports(importPath) {
  try {
    let resolvedPath;
    if (importPath.startsWith('@openzeppelin/')) {
      resolvedPath = path.resolve(__dirname, '../node_modules', importPath);
    } else {
      resolvedPath = path.resolve(__dirname, '../contracts', importPath);
    }
    if (fs.existsSync(resolvedPath)) {
      return { contents: fs.readFileSync(resolvedPath, 'utf8') };
    }
    return { error: 'File not found: ' + importPath };
  } catch (err) {
    return { error: 'Error resolving ' + importPath + ': ' + err.message };
  }
}

console.log('Compiling contracts with OpenZeppelin import resolution...');
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

// Check for errors/warnings
let hasErrors = false;
if (output.errors) {
  output.errors.forEach(err => {
    console.log(err.formattedMessage);
    if (err.severity === 'error') {
      hasErrors = true;
    }
  });
}

if (hasErrors) {
  console.error('Compilation failed due to errors.');
  process.exit(1);
}

const buildDir = path.resolve(__dirname, '../src/abi');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Save all contracts from all source files
const sourceFiles = Object.keys(sources);
for (const sourceFile of sourceFiles) {
  const contracts = output.contracts[sourceFile];
  if (!contracts) continue;
  for (let contractName in contracts) {
    const contract = contracts[contractName];
    fs.writeFileSync(
      path.resolve(buildDir, `${contractName}.json`),
      JSON.stringify({
        abi: contract.abi,
        bytecode: contract.evm.bytecode.object
      }, null, 2)
    );
    console.log(`  ✓ ${contractName}.json saved`);
  }
}

console.log('Compilation successful! ABIs saved to src/abi');
