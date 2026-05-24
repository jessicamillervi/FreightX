require('dotenv').config();
const { createPublicClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { arcTestnet } = require('viem/chains');
const fs = require('fs');
const path = require('path');

const passportArtifact = require('../src/abi/FreightPassport.json');
const escrowArtifact = require('../src/abi/FreightEscrow.json');

const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
const EURC_ADDRESS = '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a';

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network';

  if (!privateKey) {
    console.error('ERROR: PRIVATE_KEY environment variable is not set.');
    console.log('Please set it in a .env file at the project root.');
    console.log('Example: PRIVATE_KEY=0x...');
    process.exit(1);
  }

  // Ensure key format has 0x prefix
  const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey);

  console.log(`Deploying from account: ${account.address}`);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  // Verify wallet has balance for gas (which is USDC on Arc)
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Wallet Balance: ${Number(balance) / 1e18} USDC (Arc uses USDC as native gas token with 18 decimals)`);

  if (balance === 0n) {
    console.warn('WARNING: Wallet balance is 0. Please fund this address at https://faucet.circle.com before deploying.');
  }

  console.log('\nStep 1: Deploying FreightPassport (ERC-721)...');
  const passportHash = await walletClient.deployContract({
    abi: passportArtifact.abi,
    bytecode: passportArtifact.bytecode.startsWith('0x') ? passportArtifact.bytecode : `0x${passportArtifact.bytecode}`,
  });
  console.log(`Transaction sent: ${passportHash}`);
  console.log('Waiting for transaction finality (Arc has sub-second finality)...');
  
  const passportReceipt = await publicClient.waitForTransactionReceipt({ hash: passportHash });
  const passportAddress = passportReceipt.contractAddress;
  console.log(`FreightPassport deployed at: ${passportAddress}`);

  console.log('\nStep 2: Deploying FreightEscrow...');
  const escrowHash = await walletClient.deployContract({
    abi: escrowArtifact.abi,
    bytecode: escrowArtifact.bytecode.startsWith('0x') ? escrowArtifact.bytecode : `0x${escrowArtifact.bytecode}`,
    args: [USDC_ADDRESS, EURC_ADDRESS],
  });
  console.log(`Transaction sent: ${escrowHash}`);
  console.log('Waiting for transaction finality...');
  
  const escrowReceipt = await publicClient.waitForTransactionReceipt({ hash: escrowHash });
  const escrowAddress = escrowReceipt.contractAddress;
  console.log(`FreightEscrow deployed at: ${escrowAddress}`);

  console.log('\nStep 3: Setting escrow contract reference in FreightPassport...');
  const setEscrowHash = await walletClient.writeContract({
    address: passportAddress,
    abi: passportArtifact.abi,
    functionName: 'setEscrowContract',
    args: [escrowAddress],
  });
  await publicClient.waitForTransactionReceipt({ hash: setEscrowHash });
  console.log('Reference set in FreightPassport successfully.');

  console.log('\nStep 4: Setting passport contract reference in FreightEscrow...');
  const setPassportHash = await walletClient.writeContract({
    address: escrowAddress,
    abi: escrowArtifact.abi,
    functionName: 'setPassportContract',
    args: [passportAddress],
  });
  await publicClient.waitForTransactionReceipt({ hash: setPassportHash });
  console.log('Reference set in FreightEscrow successfully.');

  // Save deployed addresses
  const addressesPath = path.resolve(__dirname, '../src/abi/addresses.json');
  fs.writeFileSync(
    addressesPath,
    JSON.stringify({
      FreightPassport: passportAddress,
      FreightEscrow: escrowAddress,
      USDC: USDC_ADDRESS,
      chainName: 'Arc Testnet',
      chainId: arcTestnet.id,
      explorer: 'https://testnet.arcscan.app',
    }, null, 2)
  );

  console.log(`\nDeployment configuration saved to: ${addressesPath}`);
  console.log('Deployment completed successfully!');
}

main().catch((error) => {
  console.error('Deployment script failed:', error);
  process.exit(1);
});
