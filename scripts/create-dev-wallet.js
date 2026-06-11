require('dotenv').config();
const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey) {
    console.error('❌ Error: CIRCLE_API_KEY is not defined in your .env file.');
    process.exit(1);
  }
  if (!entitySecret) {
    console.error('❌ Error: CIRCLE_ENTITY_SECRET is not defined in your .env file.');
    process.exit(1);
  }
  console.log('🚀 Initializing Circle Developer-Controlled Wallets Client...');
  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });
  try {
    console.log('📦 Creating Wallet Set...');
    const walletSetResponse = await client.createWalletSet({
      name: 'MarketChain Oracle Wallet Set'
    });
    const walletSet = walletSetResponse.data?.walletSet || walletSetResponse.walletSet || walletSetResponse;
    const walletSetId = walletSet.id;
    if (!walletSetId) {
      console.error('❌ Failed to retrieve Wallet Set ID from response:', walletSetResponse);
      process.exit(1);
    }
    console.log(`✅ Wallet Set Created! ID: ${walletSetId}`);
    console.log('💳 Creating Developer-Controlled Wallet (Ethereum Sepolia)...');
    const walletsResponse = await client.createWallets({
      walletSetId,
      blockchains: ['ETH-SEPOLIA'],
      count: 1
    });
    const wallets = walletsResponse.data?.wallets || walletsResponse.wallets || walletsResponse;
    const wallet = wallets[0];
    if (!wallet || !wallet.id) {
      console.error('❌ Failed to retrieve Wallet ID from response:', walletsResponse);
      process.exit(1);
    }
    console.log('\n==================================================');
    console.log('🎉 SUCCESS: Developer-Controlled Wallet Created!');
    console.log(`Address:   ${wallet.address}`);
    console.log(`Wallet ID: ${wallet.id}`);
    console.log('==================================================\n');
    console.log('👉 Please copy the Wallet ID above and add it to your .env file:');
    console.log(`CIRCLE_WALLET_ID=${wallet.id}\n`);
  } catch (error) {
    console.error('❌ An error occurred during wallet creation:', error.message || error);
    if (error.response) {
      console.error('API Response details:', error.response.data || error.response);
    }
    process.exit(1);
  }
}
main();
