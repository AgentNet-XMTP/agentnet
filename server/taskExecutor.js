const crypto = require('crypto');

const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

async function rpcCall(method, params = []) {
  const res = await fetch(BASE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

function hexToDecimal(hex) {
  return parseInt(hex, 16);
}

function weiToEth(weiHex) {
  const wei = BigInt(weiHex);
  return Number(wei) / 1e18;
}

function decodeString(hex) {
  if (!hex || hex === '0x' || hex.length < 66) return null;
  try {
    const stripped = hex.slice(2);
    const firstWord = stripped.slice(0, 64);
    const firstWordInt = parseInt(firstWord, 16);

    if (firstWordInt === 32 || firstWordInt === 64) {
      const offset = firstWordInt * 2;
      if (stripped.length >= offset + 64) {
        const length = parseInt(stripped.slice(offset, offset + 64), 16);
        if (length > 0 && length < 256 && stripped.length >= offset + 64 + length * 2) {
          const bytes = stripped.slice(offset + 64, offset + 64 + length * 2);
          const decoded = Buffer.from(bytes, 'hex').toString('utf8');
          if (/^[\x20-\x7E]+$/.test(decoded)) return decoded;
        }
      }
    }

    const bytes32 = Buffer.from(firstWord, 'hex');
    const nullIdx = bytes32.indexOf(0);
    const trimmed = nullIdx > 0 ? bytes32.slice(0, nullIdx) : bytes32;
    const decoded = trimmed.toString('utf8');
    if (decoded.length > 0 && /^[\x20-\x7E]+$/.test(decoded)) return decoded;

    for (let i = 0; i < Math.min(stripped.length / 64, 4); i++) {
      const word = stripped.slice(i * 64, (i + 1) * 64);
      const wordBytes = Buffer.from(word, 'hex');
      const wordNull = wordBytes.indexOf(0);
      const wordTrimmed = wordNull > 0 ? wordBytes.slice(0, wordNull) : wordBytes;
      const wordDecoded = wordTrimmed.toString('utf8');
      if (wordDecoded.length >= 2 && /^[\x20-\x7E]+$/.test(wordDecoded)) return wordDecoded;
    }

    return null;
  } catch { return null; }
}

const KNOWN_SELECTORS = {
  '06fdde03': 'name()',
  '95d89b41': 'symbol()',
  '313ce567': 'decimals()',
  '18160ddd': 'totalSupply()',
  '70a08231': 'balanceOf(address)',
  'dd62ed3e': 'allowance(address,address)',
  'a9059cbb': 'transfer(address,uint256)',
  '23b872dd': 'transferFrom(address,address,uint256)',
  '095ea7b3': 'approve(address,uint256)',
  '8da5cb5b': 'owner()',
  '5c975abb': 'paused()',
  'f2fde38b': 'transferOwnership(address)',
  '715018a6': 'renounceOwnership()',
  '3644e515': 'DOMAIN_SEPARATOR()',
  'd505accf': 'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)',
};

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const WETH_BASE = '0x4200000000000000000000000000000000000006';
const DAI_BASE = '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb';
const CBETH_BASE = '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22';
const USDbC_BASE = '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA';
const AERO_BASE = '0x940181a94A35A4569E4529A3CDfB74e38FD98631';

const BASE_TOKENS = {
  USDC: { address: USDC_BASE, decimals: 6, symbol: 'USDC' },
  WETH: { address: WETH_BASE, decimals: 18, symbol: 'WETH' },
  DAI: { address: DAI_BASE, decimals: 18, symbol: 'DAI' },
  cbETH: { address: CBETH_BASE, decimals: 18, symbol: 'cbETH' },
  USDbC: { address: USDbC_BASE, decimals: 6, symbol: 'USDbC' },
  AERO: { address: AERO_BASE, decimals: 18, symbol: 'AERO' },
};

const CHAINLINK_ETH_USD = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70';
const CHAINLINK_USDC_USD = '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B';

const DANGEROUS_OPCODES = {
  'ff': 'SELFDESTRUCT',
  'f4': 'DELEGATECALL',
  'f2': 'CALLCODE',
  '3b': 'EXTCODESIZE',
  '3c': 'EXTCODECOPY',
  '3f': 'EXTCODEHASH',
  '55': 'SSTORE',
  'f0': 'CREATE',
  'f5': 'CREATE2',
};

const KNOWN_MIXERS_BRIDGES = {
  '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b': { name: 'Tornado Cash Router', type: 'mixer', risk: 'critical' },
  '0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc': { name: 'Tornado Cash 0.1 ETH', type: 'mixer', risk: 'critical' },
  '0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936': { name: 'Tornado Cash 1 ETH', type: 'mixer', risk: 'critical' },
  '0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF': { name: 'Tornado Cash 10 ETH', type: 'mixer', risk: 'critical' },
  '0xA160cdAB225685dA1d56aa342Ad8841c3b53f291': { name: 'Tornado Cash 100 ETH', type: 'mixer', risk: 'critical' },
  '0x3ee18B2214AFF97000D974cf647E7C347E8fa585': { name: 'Wormhole Bridge', type: 'bridge', risk: 'medium' },
  '0x49048044D57e1C92A77f79988d21Fa8fAF36f97B': { name: 'Base Bridge (Official)', type: 'bridge', risk: 'low' },
  '0x3154Cf16ccdb4C6d922629664174b904d80F2C35': { name: 'Base Portal', type: 'bridge', risk: 'low' },
  '0x866E82a600A1414e583f7F13623F1aC5d58b0Afa': { name: 'Across Bridge', type: 'bridge', risk: 'low' },
  '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE': { name: 'LI.FI Diamond', type: 'aggregator', risk: 'low' },
  '0x2B0d36FACD61B71CC05ab8F3D2B3EE0B5d4793fe': { name: 'Nomad Bridge (Exploited)', type: 'bridge', risk: 'critical' },
  '0x0000000000A39bb272e79075ade125fd351887Ac': { name: 'Blender.io', type: 'mixer', risk: 'critical' },
};

const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const KNOWN_DEX_ROUTERS = {
  '0x2626664c2603336E57B271c5C0b26F421741e481': 'Uniswap V3 Router',
  '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD': 'Uniswap Universal Router',
  '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43': 'Aerodrome Router',
  '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5': 'KyberSwap',
  '0x1111111254EEB25477B68fb85Ed929f73A960582': '1inch Router',
  '0xDef1C0ded9bec7F1a1670819833240f027b25EfF': '0x Exchange Proxy',
};

async function executeTask(taskType, input) {
  const startTime = Date.now();

  try {
    let result;
    switch (taskType) {
      case 'contract_analysis':
        result = await analyzeContract(input);
        break;
      case 'token_lookup':
        result = await tokenLookup(input);
        break;
      case 'wallet_check':
        result = await walletCheck(input);
        break;
      case 'gas_estimate':
        result = await gasEstimate(input);
        break;
      case 'block_info':
        result = await blockInfo(input);
        break;
      case 'tx_trace':
        result = await txTrace(input);
        break;
      case 'fund_trace':
        result = await fundTrace(input);
        break;
      case 'hack_analysis':
        result = await hackAnalysis(input);
        break;
      case 'whale_alert':
        result = await whaleAlert(input);
        break;
      case 'security_audit':
        result = await securityAudit(input);
        break;
      case 'mixer_check':
        result = await mixerCheck(input);
        break;
      default:
        result = {
          status: 'completed',
          output: `Task type "${taskType}" executed`,
          input: input || '',
          note: `Supported types: contract_analysis, token_lookup, wallet_check, gas_estimate, block_info, tx_trace, fund_trace, hack_analysis, whale_alert, security_audit, mixer_check`,
        };
    }
    result.duration_ms = Date.now() - startTime;
    result.executedAt = new Date().toISOString();
    return result;
  } catch (err) {
    return {
      status: 'failed',
      error: err.message,
      input: input || '',
      executedAt: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
    };
  }
}

async function getUsdcBalance(address) {
  try {
    const paddedAddr = address.slice(2).toLowerCase().padStart(64, '0');
    const callData = '0x70a08231' + paddedAddr;
    const result = await rpcCall('eth_call', [{ to: USDC_BASE, data: callData }, 'latest']);
    if (result && result !== '0x') {
      return Number(BigInt(result)) / 1e6;
    }
  } catch {}
  return null;
}

async function analyzeContract(address) {
  if (!address || !address.startsWith('0x')) {
    address = USDC_BASE;
  }

  const [code, balance, txCount, block] = await Promise.all([
    rpcCall('eth_getCode', [address, 'latest']),
    rpcCall('eth_getBalance', [address, 'latest']),
    rpcCall('eth_getTransactionCount', [address, 'latest']),
    rpcCall('eth_blockNumber'),
  ]);

  const isContract = code && code !== '0x' && code.length > 2;
  const codeSize = isContract ? (code.length - 2) / 2 : 0;

  let tokenInfo = null;
  if (isContract) {
    try {
      const [nameResult, symbolResult, decimalsResult, supplyResult] = await Promise.all([
        rpcCall('eth_call', [{ to: address, data: '0x06fdde03' }, 'latest']).catch(() => null),
        rpcCall('eth_call', [{ to: address, data: '0x95d89b41' }, 'latest']).catch(() => null),
        rpcCall('eth_call', [{ to: address, data: '0x313ce567' }, 'latest']).catch(() => null),
        rpcCall('eth_call', [{ to: address, data: '0x18160ddd' }, 'latest']).catch(() => null),
      ]);

      const name = decodeString(nameResult);
      const symbol = decodeString(symbolResult);
      const decimals = decimalsResult && decimalsResult !== '0x' ? parseInt(decimalsResult, 16) : null;
      const totalSupplyRaw = supplyResult && supplyResult !== '0x' ? BigInt(supplyResult) : null;
      let totalSupply = null;
      if (totalSupplyRaw !== null && decimals !== null) {
        totalSupply = (Number(totalSupplyRaw / BigInt(10 ** Math.max(0, decimals - 2))) / 100).toLocaleString();
      } else if (totalSupplyRaw !== null) {
        totalSupply = totalSupplyRaw.toString();
      }

      if (name || symbol) {
        tokenInfo = {};
        if (name) tokenInfo.name = name;
        if (symbol) tokenInfo.symbol = symbol;
        if (decimals !== null) tokenInfo.decimals = decimals;
        if (totalSupply) tokenInfo.total_supply = totalSupply;
      }
    } catch {}
  }

  const detectedSelectors = [];
  if (isContract) {
    for (const [sel, fn] of Object.entries(KNOWN_SELECTORS)) {
      if (code.includes(sel)) {
        detectedSelectors.push(fn);
      }
    }
  }

  const isErc20 = detectedSelectors.includes('transfer(address,uint256)') && detectedSelectors.includes('balanceOf(address)');

  const result = {
    status: 'completed',
    chain: 'Base Mainnet',
    address,
    type: isContract ? (isErc20 ? 'ERC-20 Token Contract' : 'Smart Contract') : 'EOA (Wallet)',
    bytecode_size: isContract ? `${codeSize.toLocaleString()} bytes` : 'N/A',
    eth_balance: `${weiToEth(balance).toFixed(6)} ETH`,
    transaction_count: hexToDecimal(txCount),
    block_analyzed: hexToDecimal(block),
  };

  if (tokenInfo) {
    result.token_name = tokenInfo.name || 'Unknown';
    result.token_symbol = tokenInfo.symbol || 'Unknown';
    if (tokenInfo.decimals !== undefined) result.token_decimals = tokenInfo.decimals;
    if (tokenInfo.total_supply) result.token_total_supply = tokenInfo.total_supply;
  }

  if (detectedSelectors.length > 0) {
    result.detected_functions = detectedSelectors;
    result.function_count = detectedSelectors.length;
  }

  result.is_erc20 = isErc20;
  result.basescan = `https://basescan.org/address/${address}`;

  return result;
}

async function tokenLookup(input) {
  let address = input;
  if (!address || !address.startsWith('0x')) {
    const tokenMap = {
      'usdc': USDC_BASE,
      'weth': WETH_BASE,
      'eth': WETH_BASE,
    };
    address = tokenMap[(input || '').toLowerCase()] || USDC_BASE;
  }

  const [nameResult, symbolResult, decimalsResult, supplyResult, code, balance] = await Promise.all([
    rpcCall('eth_call', [{ to: address, data: '0x06fdde03' }, 'latest']).catch(() => null),
    rpcCall('eth_call', [{ to: address, data: '0x95d89b41' }, 'latest']).catch(() => null),
    rpcCall('eth_call', [{ to: address, data: '0x313ce567' }, 'latest']).catch(() => null),
    rpcCall('eth_call', [{ to: address, data: '0x18160ddd' }, 'latest']).catch(() => null),
    rpcCall('eth_getCode', [address, 'latest']).catch(() => null),
    rpcCall('eth_getBalance', [address, 'latest']).catch(() => '0x0'),
  ]);

  const name = decodeString(nameResult);
  const symbol = decodeString(symbolResult);
  const decimals = decimalsResult && decimalsResult !== '0x' ? parseInt(decimalsResult, 16) : null;
  const totalSupplyRaw = supplyResult && supplyResult !== '0x' ? BigInt(supplyResult) : null;
  let totalSupply = null;
  if (totalSupplyRaw !== null && decimals !== null) {
    totalSupply = (Number(totalSupplyRaw / BigInt(10 ** Math.max(0, decimals - 2))) / 100).toLocaleString();
  } else if (totalSupplyRaw !== null) {
    totalSupply = totalSupplyRaw.toString();
  }

  const isContract = code && code !== '0x' && code.length > 2;
  const codeSize = isContract ? (code.length - 2) / 2 : 0;

  const detectedFns = [];
  if (isContract) {
    for (const [sel, fn] of Object.entries(KNOWN_SELECTORS)) {
      if (code.includes(sel)) detectedFns.push(fn);
    }
  }

  const isErc20 = detectedFns.includes('transfer(address,uint256)') && detectedFns.includes('balanceOf(address)');
  const hasPermit = detectedFns.includes('permit(address,address,uint256,uint256,uint8,bytes32,bytes32)');

  const result = {
    status: 'completed',
    chain: 'Base Mainnet',
    address,
    name: name || 'Unknown',
    symbol: symbol || 'Unknown',
    decimals,
    total_supply: totalSupply,
    is_erc20: isErc20,
    has_permit: hasPermit,
    contract_size: `${codeSize.toLocaleString()} bytes`,
    eth_balance: `${weiToEth(balance).toFixed(6)} ETH`,
    function_count: detectedFns.length,
    basescan: `https://basescan.org/token/${address}`,
  };

  return result;
}

async function walletCheck(address) {
  if (!address || !address.startsWith('0x')) {
    return { status: 'failed', error: 'Provide a valid wallet address starting with 0x' };
  }

  const [balance, txCount, code] = await Promise.all([
    rpcCall('eth_getBalance', [address, 'latest']),
    rpcCall('eth_getTransactionCount', [address, 'latest']),
    rpcCall('eth_getCode', [address, 'latest']),
  ]);

  const usdcBalance = await getUsdcBalance(address);
  const isContract = code && code !== '0x' && code.length > 2;

  return {
    status: 'completed',
    chain: 'Base Mainnet',
    address,
    type: isContract ? 'Smart Contract / Smart Wallet' : 'EOA (Regular Wallet)',
    eth_balance: `${weiToEth(balance).toFixed(6)} ETH`,
    usdc_balance: usdcBalance !== null ? `${usdcBalance.toFixed(2)} USDC` : 'unable to fetch',
    transaction_count: hexToDecimal(txCount),
    basescan: `https://basescan.org/address/${address}`,
  };
}

async function gasEstimate(input) {
  const [gasPrice, block] = await Promise.all([
    rpcCall('eth_gasPrice'),
    rpcCall('eth_getBlockByNumber', ['latest', false]),
  ]);

  const gasPriceGwei = Number(BigInt(gasPrice)) / 1e9;
  const baseFee = block.baseFeePerGas ? Number(BigInt(block.baseFeePerGas)) / 1e9 : null;

  const transferGas = 21000;
  const erc20Gas = 65000;
  const swapGas = 180000;
  const nftMint = 120000;

  const costEth = (gas) => (gasPriceGwei * gas / 1e9).toFixed(8);

  const utilization = (hexToDecimal(block.gasUsed) / hexToDecimal(block.gasLimit)) * 100;

  return {
    status: 'completed',
    chain: 'Base Mainnet',
    block_number: hexToDecimal(block.number),
    timestamp: new Date(hexToDecimal(block.timestamp) * 1000).toISOString(),
    gas_price: `${gasPriceGwei.toFixed(4)} Gwei`,
    base_fee: baseFee ? `${baseFee.toFixed(4)} Gwei` : null,
    cost_estimates: {
      eth_transfer: `${costEth(transferGas)} ETH (${transferGas.toLocaleString()} gas)`,
      erc20_transfer: `${costEth(erc20Gas)} ETH (${erc20Gas.toLocaleString()} gas)`,
      nft_mint: `${costEth(nftMint)} ETH (${nftMint.toLocaleString()} gas)`,
      dex_swap: `${costEth(swapGas)} ETH (${swapGas.toLocaleString()} gas)`,
    },
    block_gas_used: hexToDecimal(block.gasUsed).toLocaleString(),
    block_gas_limit: hexToDecimal(block.gasLimit).toLocaleString(),
    utilization: `${utilization.toFixed(1)}%`,
    txns_in_block: block.transactions.length,
  };
}

async function blockInfo(input) {
  let blockTag = 'latest';
  if (input && /^\d+$/.test(input)) {
    blockTag = '0x' + parseInt(input).toString(16);
  }

  const block = await rpcCall('eth_getBlockByNumber', [blockTag, false]);

  const gasUsed = hexToDecimal(block.gasUsed);
  const gasLimit = hexToDecimal(block.gasLimit);

  return {
    status: 'completed',
    chain: 'Base Mainnet',
    block_number: hexToDecimal(block.number),
    hash: block.hash,
    parent_hash: block.parentHash,
    timestamp: new Date(hexToDecimal(block.timestamp) * 1000).toISOString(),
    transaction_count: block.transactions.length,
    gas_used: gasUsed.toLocaleString(),
    gas_limit: gasLimit.toLocaleString(),
    utilization: `${((gasUsed / gasLimit) * 100).toFixed(1)}%`,
    base_fee: block.baseFeePerGas ? `${(Number(BigInt(block.baseFeePerGas)) / 1e9).toFixed(4)} Gwei` : null,
    miner: block.miner,
    basescan: `https://basescan.org/block/${hexToDecimal(block.number)}`,
  };
}

async function txTrace(txHash) {
  if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
    return { status: 'failed', error: 'Provide a valid transaction hash (0x... 66 chars)' };
  }

  const [tx, receipt] = await Promise.all([
    rpcCall('eth_getTransactionByHash', [txHash]),
    rpcCall('eth_getTransactionReceipt', [txHash]),
  ]);

  if (!tx) return { status: 'failed', error: 'Transaction not found on Base Mainnet' };

  const value = tx.value ? weiToEth(tx.value) : 0;
  const gasUsed = receipt ? hexToDecimal(receipt.gasUsed) : null;
  const gasPrice = tx.gasPrice ? Number(BigInt(tx.gasPrice)) / 1e9 : null;
  const fee = gasUsed && gasPrice ? (gasUsed * gasPrice / 1e9) : null;

  const inputSize = tx.input ? (tx.input.length - 2) / 2 : 0;
  let methodSig = null;
  if (tx.input && tx.input.length >= 10) {
    const selector = tx.input.slice(2, 10);
    methodSig = KNOWN_SELECTORS[selector] || `0x${selector}`;
  }

  return {
    status: 'completed',
    chain: 'Base Mainnet',
    tx_hash: txHash,
    from: tx.from,
    to: tx.to || 'Contract Creation',
    value: `${value.toFixed(6)} ETH`,
    method: methodSig || (inputSize === 0 ? 'ETH Transfer' : 'Contract Call'),
    gas_used: gasUsed ? gasUsed.toLocaleString() : null,
    gas_price: gasPrice ? `${gasPrice.toFixed(4)} Gwei` : null,
    fee: fee ? `${fee.toFixed(8)} ETH` : null,
    block_number: tx.blockNumber ? hexToDecimal(tx.blockNumber) : null,
    success: receipt ? (receipt.status === '0x1' ? 'Yes' : 'No (Reverted)') : 'Pending',
    logs_count: receipt ? receipt.logs.length : null,
    input_data: `${inputSize.toLocaleString()} bytes`,
    basescan: `https://basescan.org/tx/${txHash}`,
  };
}

async function fundTrace(address) {
  if (!address || !address.startsWith('0x') || address.length !== 42) {
    return { status: 'failed', error: 'Provide a valid address (0x... 42 chars)' };
  }

  const currentBlock = await rpcCall('eth_blockNumber');
  const currentBlockNum = hexToDecimal(currentBlock);
  const fromBlock = '0x' + Math.max(0, currentBlockNum - 5000).toString(16);

  const paddedAddr = '0x' + address.slice(2).toLowerCase().padStart(64, '0');
  const [outgoingLogs, incomingLogs, ethBalance, txCount] = await Promise.all([
    rpcCall('eth_getLogs', [{ fromBlock, toBlock: 'latest', topics: [TRANSFER_EVENT_TOPIC, paddedAddr, null] }]).catch(() => []),
    rpcCall('eth_getLogs', [{ fromBlock, toBlock: 'latest', topics: [TRANSFER_EVENT_TOPIC, null, paddedAddr] }]).catch(() => []),
    rpcCall('eth_getBalance', [address, 'latest']),
    rpcCall('eth_getTransactionCount', [address, 'latest']),
  ]);

  const outflows = {};
  const inflows = {};
  let totalOutValue = 0n;
  let totalInValue = 0n;
  const suspiciousDestinations = [];

  for (const log of outgoingLogs) {
    const to = '0x' + log.topics[2].slice(26);
    const value = BigInt(log.data || '0x0');
    if (!outflows[to]) outflows[to] = { count: 0, totalValue: 0n, tokens: new Set() };
    outflows[to].count++;
    outflows[to].totalValue += value;
    outflows[to].tokens.add(log.address.toLowerCase());
    totalOutValue += value;

    const mixerInfo = KNOWN_MIXERS_BRIDGES[to] || KNOWN_MIXERS_BRIDGES[to.toLowerCase()];
    if (mixerInfo && mixerInfo.risk === 'critical') {
      suspiciousDestinations.push({ address: to, ...mixerInfo, tx: log.transactionHash });
    }
  }

  for (const log of incomingLogs) {
    const from = '0x' + log.topics[1].slice(26);
    const value = BigInt(log.data || '0x0');
    if (!inflows[from]) inflows[from] = { count: 0, totalValue: 0n, tokens: new Set() };
    inflows[from].count++;
    inflows[from].totalValue += value;
    inflows[from].tokens.add(log.address.toLowerCase());
    totalInValue += value;
  }

  const topOutflows = Object.entries(outflows)
    .sort((a, b) => Number(b[1].totalValue - a[1].totalValue))
    .slice(0, 10)
    .map(([addr, d]) => ({
      address: addr,
      transfers: d.count,
      unique_tokens: d.tokens.size,
      label: KNOWN_MIXERS_BRIDGES[addr]?.name || KNOWN_DEX_ROUTERS[addr] || null,
      risk: KNOWN_MIXERS_BRIDGES[addr]?.risk || 'unknown',
    }));

  const topInflows = Object.entries(inflows)
    .sort((a, b) => Number(b[1].totalValue - a[1].totalValue))
    .slice(0, 10)
    .map(([addr, d]) => ({
      address: addr,
      transfers: d.count,
      unique_tokens: d.tokens.size,
      label: KNOWN_MIXERS_BRIDGES[addr]?.name || KNOWN_DEX_ROUTERS[addr] || null,
    }));

  const riskScore = suspiciousDestinations.length > 0 ? 'HIGH' :
    Object.keys(outflows).length > 50 ? 'MEDIUM' : 'LOW';

  return {
    status: 'completed',
    chain: 'Base Mainnet',
    address,
    eth_balance: `${weiToEth(ethBalance).toFixed(6)} ETH`,
    total_transactions: hexToDecimal(txCount),
    blocks_scanned: 5000,
    scan_range: `${currentBlockNum - 5000} → ${currentBlockNum}`,
    outgoing_transfers: outgoingLogs.length,
    incoming_transfers: incomingLogs.length,
    unique_outflow_addresses: Object.keys(outflows).length,
    unique_inflow_addresses: Object.keys(inflows).length,
    top_outflows: topOutflows,
    top_inflows: topInflows,
    suspicious_destinations: suspiciousDestinations.length > 0 ? suspiciousDestinations : 'none detected',
    risk_assessment: riskScore,
    risk_factors: suspiciousDestinations.length > 0
      ? `Interacted with ${suspiciousDestinations.length} known mixer/flagged contract(s)`
      : Object.keys(outflows).length > 50
        ? 'High volume of unique outflow addresses (possible fund dispersal)'
        : 'No known risk factors detected',
    basescan: `https://basescan.org/address/${address}`,
  };
}

async function hackAnalysis(txHash) {
  if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
    return { status: 'failed', error: 'Provide a valid transaction hash (0x... 66 chars)' };
  }

  const [tx, receipt] = await Promise.all([
    rpcCall('eth_getTransactionByHash', [txHash]),
    rpcCall('eth_getTransactionReceipt', [txHash]),
  ]);

  if (!tx) return { status: 'failed', error: 'Transaction not found on Base Mainnet' };

  const value = tx.value ? weiToEth(tx.value) : 0;
  const gasUsed = receipt ? hexToDecimal(receipt.gasUsed) : null;
  const gasPrice = tx.gasPrice ? Number(BigInt(tx.gasPrice)) / 1e9 : null;
  const fee = gasUsed && gasPrice ? (gasUsed * gasPrice / 1e9) : null;
  const success = receipt ? receipt.status === '0x1' : null;

  let methodSig = null;
  if (tx.input && tx.input.length >= 10) {
    const selector = tx.input.slice(2, 10);
    methodSig = KNOWN_SELECTORS[selector] || `0x${selector}`;
  }

  const tokenTransfers = [];
  const suspiciousTransfers = [];
  const uniqueRecipients = new Set();

  if (receipt && receipt.logs) {
    for (const log of receipt.logs) {
      if (log.topics[0] === TRANSFER_EVENT_TOPIC && log.topics.length >= 3) {
        const from = '0x' + log.topics[1].slice(26);
        const to = '0x' + log.topics[2].slice(26);
        const rawValue = BigInt(log.data || '0x0');
        uniqueRecipients.add(to.toLowerCase());

        const transfer = {
          token: log.address,
          from: from,
          to: to,
          raw_value: rawValue.toString(),
        };

        const mixerInfo = KNOWN_MIXERS_BRIDGES[to] || KNOWN_MIXERS_BRIDGES[to.toLowerCase()];
        if (mixerInfo) {
          transfer.destination_label = mixerInfo.name;
          transfer.destination_type = mixerInfo.type;
          transfer.risk = mixerInfo.risk;
          suspiciousTransfers.push(transfer);
        }

        const dexInfo = KNOWN_DEX_ROUTERS[to] || KNOWN_DEX_ROUTERS[to.toLowerCase()];
        if (dexInfo) transfer.destination_label = dexInfo;

        tokenTransfers.push(transfer);
      }
    }
  }

  const attackPatterns = [];
  const inputSize = tx.input ? (tx.input.length - 2) / 2 : 0;

  if (inputSize > 2000) attackPatterns.push('Large calldata (possible exploit payload)');
  if (tokenTransfers.length > 5) attackPatterns.push(`Multiple token transfers (${tokenTransfers.length}) in single tx`);
  if (uniqueRecipients.size > 3) attackPatterns.push(`Funds dispersed to ${uniqueRecipients.size} unique addresses`);
  if (value > 1) attackPatterns.push(`Large ETH value transferred: ${value.toFixed(4)} ETH`);
  if (!success) attackPatterns.push('Transaction REVERTED — possible failed exploit attempt');
  if (suspiciousTransfers.length > 0) attackPatterns.push(`${suspiciousTransfers.length} transfer(s) to known mixers/flagged contracts`);
  if (gasUsed && gasUsed > 500000) attackPatterns.push(`High gas consumption: ${gasUsed.toLocaleString()} (complex internal execution)`);
  if (tx.to === null) attackPatterns.push('Contract deployment in this tx (possible attack contract creation)');

  const fromCode = await rpcCall('eth_getCode', [tx.from, 'latest']).catch(() => '0x');
  const isContractCaller = fromCode && fromCode !== '0x' && fromCode.length > 2;
  if (isContractCaller) attackPatterns.push('Caller is a smart contract (bot/automated attack)');

  const threatLevel = suspiciousTransfers.length > 0 ? 'CRITICAL' :
    attackPatterns.length >= 4 ? 'HIGH' :
      attackPatterns.length >= 2 ? 'MEDIUM' : 'LOW';

  const postTxBalance = await rpcCall('eth_getBalance', [tx.from, 'latest']).catch(() => '0x0');

  return {
    status: 'completed',
    chain: 'Base Mainnet',
    tx_hash: txHash,
    threat_level: threatLevel,
    success: success ? 'Yes' : 'No (Reverted)',
    from: tx.from,
    from_type: isContractCaller ? 'Smart Contract (Bot/Automated)' : 'EOA (Human Wallet)',
    to: tx.to || 'Contract Creation',
    value: `${value.toFixed(6)} ETH`,
    method: methodSig || (inputSize === 0 ? 'ETH Transfer' : 'Contract Call'),
    calldata_size: `${inputSize.toLocaleString()} bytes`,
    gas_used: gasUsed ? gasUsed.toLocaleString() : null,
    fee: fee ? `${fee.toFixed(8)} ETH` : null,
    block: tx.blockNumber ? hexToDecimal(tx.blockNumber) : null,
    token_transfers_count: tokenTransfers.length,
    token_transfers: tokenTransfers.slice(0, 15),
    suspicious_transfers: suspiciousTransfers.length > 0 ? suspiciousTransfers : 'none',
    unique_recipients: uniqueRecipients.size,
    attack_patterns: attackPatterns.length > 0 ? attackPatterns : ['No suspicious patterns detected'],
    attacker_current_balance: `${weiToEth(postTxBalance).toFixed(6)} ETH`,
    event_logs_count: receipt ? receipt.logs.length : 0,
    basescan: `https://basescan.org/tx/${txHash}`,
  };
}

async function whaleAlert(input) {
  const blocksToScan = Math.min(parseInt(input) || 20, 50);
  const currentBlock = await rpcCall('eth_blockNumber');
  const currentBlockNum = hexToDecimal(currentBlock);

  const largeEthTransfers = [];
  const largeTokenTransfers = [];
  const blockPromises = [];

  for (let i = 0; i < blocksToScan; i++) {
    const blockNum = '0x' + (currentBlockNum - i).toString(16);
    blockPromises.push(rpcCall('eth_getBlockByNumber', [blockNum, true]).catch(() => null));
  }

  const blocks = await Promise.all(blockPromises);

  for (const block of blocks) {
    if (!block || !block.transactions) continue;
    for (const tx of block.transactions) {
      if (tx.value) {
        const ethValue = weiToEth(tx.value);
        if (ethValue >= 1.0) {
          largeEthTransfers.push({
            tx_hash: tx.hash,
            from: tx.from,
            to: tx.to || 'Contract Creation',
            value: `${ethValue.toFixed(4)} ETH`,
            block: hexToDecimal(block.number),
            timestamp: new Date(hexToDecimal(block.timestamp) * 1000).toISOString(),
            from_label: KNOWN_MIXERS_BRIDGES[tx.from]?.name || KNOWN_DEX_ROUTERS[tx.from] || null,
            to_label: KNOWN_MIXERS_BRIDGES[tx.to]?.name || KNOWN_DEX_ROUTERS[tx.to] || null,
          });
        }
      }
    }
  }

  const usdcFromBlock = '0x' + (currentBlockNum - blocksToScan).toString(16);
  const usdcLogs = await rpcCall('eth_getLogs', [{
    fromBlock: usdcFromBlock,
    toBlock: 'latest',
    address: USDC_BASE,
    topics: [TRANSFER_EVENT_TOPIC],
  }]).catch(() => []);

  for (const log of usdcLogs) {
    if (log.topics.length >= 3) {
      const rawValue = BigInt(log.data || '0x0');
      const usdcValue = Number(rawValue) / 1e6;
      if (usdcValue >= 10000) {
        const from = '0x' + log.topics[1].slice(26);
        const to = '0x' + log.topics[2].slice(26);
        largeTokenTransfers.push({
          tx_hash: log.transactionHash,
          token: 'USDC',
          from,
          to,
          value: `${usdcValue.toLocaleString()} USDC`,
          block: hexToDecimal(log.blockNumber),
          from_label: KNOWN_MIXERS_BRIDGES[from]?.name || KNOWN_DEX_ROUTERS[from] || null,
          to_label: KNOWN_MIXERS_BRIDGES[to]?.name || KNOWN_DEX_ROUTERS[to] || null,
        });
      }
    }
  }

  largeEthTransfers.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
  largeTokenTransfers.sort((a, b) => {
    const aVal = parseFloat(a.value.replace(/,/g, ''));
    const bVal = parseFloat(b.value.replace(/,/g, ''));
    return bVal - aVal;
  });

  const suspiciousWhales = [...largeEthTransfers, ...largeTokenTransfers]
    .filter(t => t.to_label && (KNOWN_MIXERS_BRIDGES[t.to]?.risk === 'critical'));

  return {
    status: 'completed',
    chain: 'Base Mainnet',
    blocks_scanned: blocksToScan,
    scan_range: `${currentBlockNum - blocksToScan} → ${currentBlockNum}`,
    large_eth_transfers: largeEthTransfers.slice(0, 20),
    large_eth_count: largeEthTransfers.length,
    large_usdc_transfers: largeTokenTransfers.slice(0, 20),
    large_usdc_count: largeTokenTransfers.length,
    suspicious_whale_movements: suspiciousWhales.length > 0 ? suspiciousWhales : 'none detected',
    alert_level: suspiciousWhales.length > 0 ? 'WARNING' : 'NORMAL',
    total_eth_volume: `${largeEthTransfers.reduce((s, t) => s + parseFloat(t.value), 0).toFixed(4)} ETH`,
  };
}

async function securityAudit(address) {
  if (!address || !address.startsWith('0x')) {
    address = USDC_BASE;
  }

  const [code, balance, txCount] = await Promise.all([
    rpcCall('eth_getCode', [address, 'latest']),
    rpcCall('eth_getBalance', [address, 'latest']),
    rpcCall('eth_getTransactionCount', [address, 'latest']),
  ]);

  if (!code || code === '0x' || code.length <= 2) {
    return { status: 'completed', chain: 'Base Mainnet', address, verdict: 'Not a contract (EOA wallet)', risk: 'N/A' };
  }

  const bytecodeHex = code.slice(2).toLowerCase();
  const codeSize = bytecodeHex.length / 2;
  const vulnerabilities = [];
  const warnings = [];
  const info = [];

  for (const [opcode, name] of Object.entries(DANGEROUS_OPCODES)) {
    let count = 0;
    for (let i = 0; i < bytecodeHex.length - 1; i += 2) {
      if (bytecodeHex.slice(i, i + 2) === opcode) count++;
    }
    if (count > 0) {
      if (name === 'SELFDESTRUCT') {
        vulnerabilities.push({ opcode: name, count, severity: 'CRITICAL', detail: 'Contract can be destroyed, funds at risk' });
      } else if (name === 'DELEGATECALL') {
        vulnerabilities.push({ opcode: name, count, severity: 'HIGH', detail: 'Proxy pattern or possible storage collision attack vector' });
      } else if (name === 'CALLCODE') {
        vulnerabilities.push({ opcode: name, count, severity: 'HIGH', detail: 'Deprecated opcode, potential reentrancy vector' });
      } else if (name === 'CREATE2') {
        warnings.push({ opcode: name, count, severity: 'MEDIUM', detail: 'Deterministic deployment — can redeploy different bytecode at same address' });
      } else if (name === 'CREATE') {
        warnings.push({ opcode: name, count, severity: 'LOW', detail: 'Creates child contracts' });
      } else {
        info.push({ opcode: name, count });
      }
    }
  }

  const detectedFns = [];
  for (const [sel, fn] of Object.entries(KNOWN_SELECTORS)) {
    if (bytecodeHex.includes(sel)) detectedFns.push(fn);
  }

  const hasOwner = detectedFns.includes('owner()');
  const hasTransferOwnership = detectedFns.includes('transferOwnership(address)');
  const hasRenounceOwnership = detectedFns.includes('renounceOwnership()');
  const hasPaused = detectedFns.includes('paused()');
  const hasPermit = detectedFns.includes('permit(address,address,uint256,uint256,uint8,bytes32,bytes32)');

  if (hasOwner && !hasRenounceOwnership) {
    warnings.push({ pattern: 'Centralized Ownership', severity: 'MEDIUM', detail: 'Owner can control contract but cannot renounce ownership' });
  }
  if (hasPaused) {
    warnings.push({ pattern: 'Pausable', severity: 'LOW', detail: 'Contract can be paused by admin, freezing user funds' });
  }
  if (hasPermit) {
    info.push({ pattern: 'EIP-2612 Permit', detail: 'Supports gasless approvals — verify permit implementation is correct' });
  }

  const isProxy = vulnerabilities.some(v => v.opcode === 'DELEGATECALL') && codeSize < 1000;
  if (isProxy) {
    warnings.push({ pattern: 'Proxy Contract', severity: 'MEDIUM', detail: 'Likely a proxy — implementation can be changed by admin' });
  }

  if (codeSize > 24576) {
    warnings.push({ pattern: 'Large Contract', severity: 'LOW', detail: `${codeSize.toLocaleString()} bytes — near or exceeds EIP-170 limit (24,576 bytes)` });
  }

  const riskScore = vulnerabilities.length > 0 ? 'HIGH' :
    warnings.filter(w => w.severity === 'MEDIUM' || w.severity === 'HIGH').length >= 2 ? 'MEDIUM' : 'LOW';

  let ownerAddress = null;
  if (hasOwner) {
    try {
      const ownerResult = await rpcCall('eth_call', [{ to: address, data: '0x8da5cb5b' }, 'latest']);
      if (ownerResult && ownerResult.length >= 66) {
        ownerAddress = '0x' + ownerResult.slice(26);
      }
    } catch {}
  }

  return {
    status: 'completed',
    chain: 'Base Mainnet',
    address,
    contract_size: `${codeSize.toLocaleString()} bytes`,
    eth_balance: `${weiToEth(balance).toFixed(6)} ETH`,
    risk_score: riskScore,
    is_proxy: isProxy,
    owner: ownerAddress || 'N/A',
    has_ownership_control: hasOwner,
    can_renounce_ownership: hasRenounceOwnership,
    is_pausable: hasPaused,
    has_permit: hasPermit,
    vulnerabilities: vulnerabilities.length > 0 ? vulnerabilities : 'none detected',
    warnings: warnings.length > 0 ? warnings : 'none',
    info,
    detected_functions: detectedFns,
    function_count: detectedFns.length,
    verdict: vulnerabilities.length > 0
      ? `CAUTION: ${vulnerabilities.length} critical/high vulnerability pattern(s) detected`
      : warnings.length > 0
        ? `${warnings.length} warning(s) found — review recommended`
        : 'No known vulnerability patterns detected',
    basescan: `https://basescan.org/address/${address}`,
  };
}

async function mixerCheck(address) {
  if (!address || !address.startsWith('0x') || address.length !== 42) {
    return { status: 'failed', error: 'Provide a valid address (0x... 42 chars)' };
  }

  const currentBlock = await rpcCall('eth_blockNumber');
  const currentBlockNum = hexToDecimal(currentBlock);
  const fromBlock = '0x' + Math.max(0, currentBlockNum - 10000).toString(16);
  const paddedAddr = '0x' + address.slice(2).toLowerCase().padStart(64, '0');

  const [outgoingLogs, incomingLogs, ethBalance, txCount, code] = await Promise.all([
    rpcCall('eth_getLogs', [{ fromBlock, toBlock: 'latest', topics: [TRANSFER_EVENT_TOPIC, paddedAddr, null] }]).catch(() => []),
    rpcCall('eth_getLogs', [{ fromBlock, toBlock: 'latest', topics: [TRANSFER_EVENT_TOPIC, null, paddedAddr] }]).catch(() => []),
    rpcCall('eth_getBalance', [address, 'latest']),
    rpcCall('eth_getTransactionCount', [address, 'latest']),
    rpcCall('eth_getCode', [address, 'latest']),
  ]);

  const isContract = code && code !== '0x' && code.length > 2;

  const mixerInteractions = [];
  const bridgeInteractions = [];
  const dexInteractions = [];
  const allCounterparties = new Set();

  const checkAddress = (addr, log, direction) => {
    allCounterparties.add(addr.toLowerCase());
    const mixerInfo = KNOWN_MIXERS_BRIDGES[addr] || KNOWN_MIXERS_BRIDGES[addr.toLowerCase()];
    if (mixerInfo) {
      const entry = {
        address: addr,
        name: mixerInfo.name,
        type: mixerInfo.type,
        risk: mixerInfo.risk,
        direction,
        tx: log.transactionHash,
        block: hexToDecimal(log.blockNumber),
      };
      if (mixerInfo.type === 'mixer') mixerInteractions.push(entry);
      else bridgeInteractions.push(entry);
    }
    const dexInfo = KNOWN_DEX_ROUTERS[addr] || KNOWN_DEX_ROUTERS[addr.toLowerCase()];
    if (dexInfo) {
      dexInteractions.push({
        address: addr,
        name: dexInfo,
        direction,
        tx: log.transactionHash,
        block: hexToDecimal(log.blockNumber),
      });
    }
  };

  for (const log of outgoingLogs) {
    if (log.topics.length >= 3) {
      const to = '0x' + log.topics[2].slice(26);
      checkAddress(to, log, 'outgoing');
    }
  }
  for (const log of incomingLogs) {
    if (log.topics.length >= 3) {
      const from = '0x' + log.topics[1].slice(26);
      checkAddress(from, log, 'incoming');
    }
  }

  const rapidTransfers = [];
  const txsByBlock = {};
  for (const log of [...outgoingLogs, ...incomingLogs]) {
    const block = hexToDecimal(log.blockNumber);
    if (!txsByBlock[block]) txsByBlock[block] = [];
    txsByBlock[block].push(log);
    if (txsByBlock[block].length >= 3) {
      rapidTransfers.push({ block, transfer_count: txsByBlock[block].length });
    }
  }

  const laundering_patterns = [];
  if (mixerInteractions.length > 0) {
    laundering_patterns.push({
      pattern: 'Mixer Usage',
      severity: 'CRITICAL',
      detail: `${mixerInteractions.length} interaction(s) with known mixing services`,
      instances: mixerInteractions,
    });
  }

  const uniqueOut = new Set(outgoingLogs.map(l => '0x' + l.topics[2]?.slice(26))).size;
  if (uniqueOut > 20) {
    laundering_patterns.push({
      pattern: 'Fund Dispersal (Fan-out)',
      severity: 'HIGH',
      detail: `Funds sent to ${uniqueOut} unique addresses — possible laundering dispersal`,
    });
  }

  const uniqueIn = new Set(incomingLogs.map(l => '0x' + l.topics[1]?.slice(26))).size;
  if (uniqueIn > 20 && uniqueOut <= 3) {
    laundering_patterns.push({
      pattern: 'Fund Aggregation (Fan-in)',
      severity: 'HIGH',
      detail: `Received from ${uniqueIn} addresses but only sent to ${uniqueOut} — possible aggregation before laundering`,
    });
  }

  if (rapidTransfers.length > 0) {
    laundering_patterns.push({
      pattern: 'Rapid Sequential Transfers',
      severity: 'MEDIUM',
      detail: `${rapidTransfers.length} block(s) with 3+ transfers — automated movement pattern`,
    });
  }

  if (bridgeInteractions.length > 2) {
    laundering_patterns.push({
      pattern: 'Multi-Bridge Usage',
      severity: 'MEDIUM',
      detail: `${bridgeInteractions.length} bridge interactions — possible cross-chain laundering`,
    });
  }

  const riskLevel = mixerInteractions.length > 0 ? 'CRITICAL' :
    laundering_patterns.some(p => p.severity === 'HIGH') ? 'HIGH' :
      laundering_patterns.length > 0 ? 'MEDIUM' : 'LOW';

  return {
    status: 'completed',
    chain: 'Base Mainnet',
    address,
    address_type: isContract ? 'Smart Contract' : 'EOA (Wallet)',
    eth_balance: `${weiToEth(ethBalance).toFixed(6)} ETH`,
    total_transactions: hexToDecimal(txCount),
    blocks_scanned: 10000,
    scan_range: `${currentBlockNum - 10000} → ${currentBlockNum}`,
    total_token_transfers: outgoingLogs.length + incomingLogs.length,
    unique_counterparties: allCounterparties.size,
    risk_level: riskLevel,
    mixer_interactions: mixerInteractions.length > 0 ? mixerInteractions : 'none detected',
    bridge_interactions: bridgeInteractions.length > 0 ? bridgeInteractions : 'none detected',
    dex_interactions: dexInteractions.length > 0 ? dexInteractions.slice(0, 10) : 'none detected',
    laundering_patterns: laundering_patterns.length > 0 ? laundering_patterns : 'no suspicious patterns detected',
    verdict: riskLevel === 'CRITICAL'
      ? 'FLAGGED: Direct mixer interaction detected — high probability of illicit fund movement'
      : riskLevel === 'HIGH'
        ? 'SUSPICIOUS: Fund dispersal/aggregation patterns consistent with laundering'
        : riskLevel === 'MEDIUM'
          ? 'MONITOR: Some suspicious patterns detected — further investigation recommended'
          : 'CLEAN: No known laundering patterns detected in scanned range',
    basescan: `https://basescan.org/address/${address}`,
  };
}

module.exports = { executeTask };
