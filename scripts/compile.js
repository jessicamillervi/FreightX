const path = require('path');
const fs = require('fs');
const solc = require('solc');

const passportPath = path.resolve(__dirname, '../contracts/FreightPassport.sol');
const escrowPath = path.resolve(__dirname, '../contracts/FreightEscrow.sol');
const usycPath = path.resolve(__dirname, '../contracts/MockUSYC.sol');

const passportSource = fs.readFileSync(passportPath, 'utf8');
const escrowSource = fs.readFileSync(escrowPath, 'utf8');
const usycSource = fs.readFileSync(usycPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'FreightPassport.sol': {
      content: passportSource
    },
    'FreightEscrow.sol': {
      content: escrowSource
    },
    'MockUSYC.sol': {
      content: usycSource
    }
  },
  settings: {
    viaIR: true,
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode']
      }
    },
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};

console.log('Compiling contracts (FreightPassport, FreightEscrow, MockUSYC)...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

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
const sourceFiles = ['FreightPassport.sol', 'FreightEscrow.sol', 'MockUSYC.sol'];
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
