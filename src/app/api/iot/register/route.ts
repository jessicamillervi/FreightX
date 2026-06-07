/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { supabase, toSnakeCase } from '../../../../lib/db';
import { getDeviceAddress } from '../../../../lib/iot-oracle';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from 'viem/chains';
import addresses from '../../../../abi/addresses.json';
import oracleArtifact from '../../../../abi/FreightOracle.json';

const privateKey = process.env.PRIVATE_KEY || '';
const rpcUrl = process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network';
const oracleAddress = (addresses as any).FreightOracle || '';

export async function POST(request: NextRequest) {
  try {
    const { deviceId, publicKey, shipmentId } = await request.json();

    if (!deviceId || !publicKey || !shipmentId) {
      return NextResponse.json(
        { error: 'Missing required fields: deviceId, publicKey, shipmentId' },
        { status: 400 }
      );
    }

    // Derive EVM address from public key
    let deviceAddress: string;
    try {
      deviceAddress = getDeviceAddress(publicKey);
    } catch (err: any) {
      return NextResponse.json(
        { error: `Invalid public key: ${err.message}` },
        { status: 400 }
      );
    }

    console.log(`[IoT Registration] Device ${deviceId} -> Derived Address: ${deviceAddress}`);

    // 1. Insert into database iot_devices table
    const { error: dbError } = await supabase.from('iot_devices').upsert(
      toSnakeCase({
        deviceId,
        publicKey,
        shipmentId,
        registeredAt: new Date().toISOString(),
      }) as any
    );

    if (dbError) {
      console.error('[IoT Registration] Database insertion failed:', dbError);
      return NextResponse.json({ error: 'Database error registering device' }, { status: 500 });
    }

    // 2. Update shipments table with iot_gateway address
    const { error: shipmentUpdateError } = await supabase
      .from('shipments')
      .update(toSnakeCase({ iotGateway: deviceAddress }) as any)
      .eq('id', shipmentId);

    if (shipmentUpdateError) {
      console.error('[IoT Registration] Failed to update shipment gateway address:', shipmentUpdateError);
    }

    let txHash = '';
    // 3. Register device on-chain if private key is available
    if (privateKey && oracleAddress) {
      try {
        const account = privateKeyToAccount(privateKey.startsWith('0x') ? (privateKey as `0x${string}`) : `0x${privateKey}`);
        
        const publicClient = createPublicClient({
          chain: arcTestnet,
          transport: http(rpcUrl),
        });

        const walletClient = createWalletClient({
          account,
          chain: arcTestnet,
          transport: http(rpcUrl),
        });

        console.log(`[IoT Registration] Calling registerDevice(${shipmentId}, ${deviceAddress}) on-chain...`);
        const { request: registerRequest } = await publicClient.simulateContract({
          address: oracleAddress as `0x${string}`,
          abi: oracleArtifact.abi,
          functionName: 'registerDevice',
          args: [BigInt(shipmentId), deviceAddress as `0x${string}`],
          account,
        });

        txHash = await walletClient.writeContract(registerRequest);
        console.log(`[IoT Registration] Device registered on-chain, transaction: ${txHash}`);
        await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
      } catch (chainError: any) {
        console.error('[IoT Registration] Failed to register device on-chain:', chainError);
        // Do not fail the whole request as DB registration succeeded
      }
    } else {
      console.log('[IoT Registration] No PRIVATE_KEY or FreightOracle address set, skipped on-chain registration (running in simulated DB mode)');
    }

    return NextResponse.json({
      success: true,
      message: 'IoT device registered successfully',
      deviceAddress,
      txHash,
    });
  } catch (err: any) {
    console.error('[IoT Registration] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
