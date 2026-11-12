/*
 * Forge Your Coin - course structure (language-neutral).
 *
 * All human-readable text lives in locales/*.js. This file only describes
 * the order of levels, the steps inside each level, where the path branches,
 * and the glossary terms (which stay in English in every language).
 */
(function () {
  'use strict';
  const F = (window.FYC = window.FYC || {});

  // Step constructors
  const T = (k, terms, fig) => ({ t: 'theory', k, terms: terms || [], fig });
  const L = (lab) => ({ t: 'lab', lab });
  const Q = (k, a) => ({ t: 'quiz', k, a });
  const X = (k, key, opts) => ({ t: 'choice', k, key, opts });

  // `br: [stateKey, value]` marks a level that exists only on one branch.
  F.levels = [
    // Chapter 1 - Foundations
    { id: 'ledger', ch: 1, steps: [T('t1', ['ledger', 'doublespend']), L('ledger'), T('t2', ['decentralization']), Q('q1', 1)] },
    { id: 'hash', ch: 1, steps: [T('t1', ['hash', 'sha256']), L('hash'), T('t2'), Q('q1', 0)] },
    { id: 'block', ch: 1, steps: [T('t1', ['block', 'blockchain', 'genesis']), L('block'), T('t2', ['immutability']), Q('q1', 2)] },

    // Chapter 2 - Keys & Wallets
    { id: 'keys', ch: 2, steps: [T('t1', ['privkey', 'pubkey', 'ecc']), L('keys'), T('t2', ['address']), Q('q1', 2)] },
    { id: 'sign', ch: 2, steps: [T('t1', ['signature']), L('sign'), Q('q1', 1)] },
    { id: 'wallet', ch: 2, steps: [T('t1', ['wallet', 'seed', 'hd']), L('wallet'), T('t2', ['custodial', 'noncustodial', 'hot', 'cold']), Q('q1', 0)] },

    // Chapter 3 - Transactions
    { id: 'tx', ch: 3, steps: [T('t1', ['tx', 'txid', 'fee']), T('t2', ['mempool', 'rbf']), L('tx'), Q('q1', 1)] },
    { id: 'model', ch: 3, fork: true, steps: [T('t1', ['utxo', 'change']), T('t2', ['account', 'acctnonce']), X('c', 'model', ['utxo', 'account'])] },
    { id: 'utxo', ch: 3, br: ['model', 'utxo'], steps: [T('t1'), L('utxo'), Q('q1', 2)] },
    { id: 'account', ch: 3, br: ['model', 'account'], steps: [T('t1'), L('account'), Q('q1', 0)] },

    // Chapter 4 - Network & Consensus
    { id: 'nodes', ch: 4, steps: [T('t1', ['node', 'fullnode', 'p2p']), L('nodes'), T('t2', ['lightclient']), Q('q1', 1)] },
    { id: 'consensus', ch: 4, fork: true, steps: [T('t1', ['consensus', 'sybil']), T('t2', ['pow', 'pos', 'poa']), X('c', 'consensus', ['pow', 'pos', 'poa'])] },
    { id: 'mining', ch: 4, br: ['consensus', 'pow'], steps: [T('t1', ['mining', 'nonce', 'difficulty', 'hashrate']), L('mining'), Q('q1', 2)] },
    { id: 'staking', ch: 4, br: ['consensus', 'pos'], steps: [T('t1', ['validator', 'staking', 'slashing']), L('staking'), Q('q1', 0)] },
    { id: 'authority', ch: 4, br: ['consensus', 'poa'], steps: [T('t1', ['validator', 'bft']), L('authority'), Q('q1', 1)] },
    { id: 'finality', ch: 4, steps: [T('t1', ['fork', 'reorg', 'confirmations'], 'fork'), T((s) => 't2_' + (s.coin.consensus || 'pow'), ['finality', 'attack51']), L('finality'), Q('q1', 2), Q('q2', 0)] },

    // Chapter 5 - Your Currency
    { id: 'tokenomics', ch: 5, steps: [T('t1', ['tokenomics', 'supply', 'halving', 'inflation']), L('tokenomics')] },
    { id: 'contracts', ch: 5, steps: [T('t1', ['smartcontract', 'evm']), T('t2', ['gas', 'revert']), L('contracts'), T('t3', ['token', 'erc20', 'stablecoin']), Q('q1', 1), Q('q2', 2)] },
    { id: 'launch', ch: 5, fork: true, steps: [T('t1', ['mainnet', 'testnet', 'l1']), X('c', 'launch', ['l1', 'token'])] },
    { id: 'genesis', ch: 5, br: ['launch', 'l1'], steps: [T('t1', ['premine', 'bootnode']), L('genesis'), Q('q1', 0)] },
    { id: 'token', ch: 5, br: ['launch', 'token'], steps: [T('t1', ['sweep']), L('token'), Q('q1', 1)] },

    // Chapter 6 - Infrastructure
    { id: 'nodeops', ch: 6, steps: [T('t1', ['rpc', 'archive']), L('nodeops'), T('t2'), Q('q1', 2)] },
    { id: 'architecture', ch: 6, steps: [T('t1', ['indexer', 'explorer']), T('t2', [], 'cloud'), L('architecture'), Q('q1', 0)] },
    { id: 'keysec', ch: 6, steps: [T('t1', ['hsm', 'multisig', 'mpc']), L('keysec'), Q('q1', 1)] },

    // Chapter 7 - Payments
    { id: 'deposits', ch: 7, steps: [T('t1', ['xpub', 'sweep']), T((s) => (s.coin.launch === 'token' ? 't2_token' : 't2_' + (s.coin.model || 'utxo'))), L('deposits'), Q('q1', 2)] },
    { id: 'withdrawals', ch: 7, steps: [T('t1', ['batching', 'idempotency']), T('t2', ['cpfp']), Q('q1', 1), Q('q2', 0), Q('q3', 2)] },
    { id: 'incidents', ch: 7, steps: [T('t1', ['kyt', 'hardfork']), Q('q1', 0), Q('q2', 2), Q('q3', 1), Q('q4', 1), Q('q5', 2)] },

    // Finale
    { id: 'passport', ch: 8, steps: [{ t: 'passport' }] },
  ];

  // Glossary terms. Names are industry terms and are never translated;
  // their explanations come from the active locale (codex.<id>).
  F.terms = {
    ledger: 'Ledger', doublespend: 'Double-spend', decentralization: 'Decentralization',
    hash: 'Hash', sha256: 'SHA-256', block: 'Block', blockchain: 'Blockchain', genesis: 'Genesis block',
    immutability: 'Immutability', privkey: 'Private key', pubkey: 'Public key', ecc: 'secp256k1',
    address: 'Address', signature: 'Digital signature', wallet: 'Wallet', seed: 'Seed phrase',
    hd: 'HD wallet', custodial: 'Custodial wallet', noncustodial: 'Non-custodial wallet',
    hot: 'Hot wallet', cold: 'Cold wallet', tx: 'Transaction', txid: 'TXID', fee: 'Fee',
    mempool: 'Mempool', rbf: 'Replace-By-Fee (RBF)', utxo: 'UTXO', change: 'Change output',
    account: 'Account model', acctnonce: 'Account nonce', node: 'Node', fullnode: 'Full node',
    p2p: 'P2P / Gossip', lightclient: 'Light client', consensus: 'Consensus', sybil: 'Sybil attack',
    pow: 'Proof of Work (PoW)', pos: 'Proof of Stake (PoS)', poa: 'Proof of Authority (PoA)',
    mining: 'Mining', nonce: 'Nonce', difficulty: 'Difficulty', hashrate: 'Hashrate',
    validator: 'Validator', staking: 'Staking', slashing: 'Slashing', bft: 'BFT',
    fork: 'Fork', reorg: 'Reorg', confirmations: 'Confirmations', finality: 'Finality',
    attack51: '51% attack', tokenomics: 'Tokenomics', supply: 'Max supply', halving: 'Halving',
    inflation: 'Inflation', smartcontract: 'Smart contract', evm: 'EVM', gas: 'Gas', revert: 'Revert',
    token: 'Token', erc20: 'ERC-20', stablecoin: 'Stablecoin', mainnet: 'Mainnet', testnet: 'Testnet',
    l1: 'Layer 1 (L1)', premine: 'Premine', bootnode: 'Bootnode', rpc: 'RPC', archive: 'Archive node',
    indexer: 'Indexer', explorer: 'Block explorer', hsm: 'HSM', multisig: 'Multisig', mpc: 'MPC',
    xpub: 'Extended public key (xpub)', sweep: 'Sweep', batching: 'Batching', idempotency: 'Idempotency',
    cpfp: 'CPFP', kyt: 'KYT', hardfork: 'Hard fork',
  };

  // Coin Atlas: real networks to compare your design against.
  F.atlas = [
    { id: 'btc', name: 'Bitcoin', tkr: 'BTC', type: 'Coin (L1)', cons: 'PoW (SHA-256)', model: 'UTXO', time: '~10 min' },
    { id: 'eth', name: 'Ethereum', tkr: 'ETH', type: 'Coin (L1)', cons: 'PoS', model: 'Account', time: '12 s' },
    { id: 'usdt', name: 'Tether', tkr: 'USDT', type: 'Stablecoin token', cons: 'host chain', model: 'Contract balances', time: 'host chain' },
    { id: 'usdc', name: 'USD Coin', tkr: 'USDC', type: 'Stablecoin token', cons: 'host chain', model: 'Contract balances', time: 'host chain' },
    { id: 'bnb', name: 'BNB Chain', tkr: 'BNB', type: 'Coin (L1)', cons: 'PoSA', model: 'Account', time: '~1-3 s' },
    { id: 'sol', name: 'Solana', tkr: 'SOL', type: 'Coin (L1)', cons: 'PoS + PoH', model: 'Account', time: '~0.4 s' },
    { id: 'trx', name: 'Tron', tkr: 'TRX', type: 'Coin (L1)', cons: 'DPoS', model: 'Account', time: '3 s' },
    { id: 'xrp', name: 'XRP Ledger', tkr: 'XRP', type: 'Coin (L1)', cons: 'Federated consensus', model: 'Account', time: '3-5 s' },
    { id: 'ltc', name: 'Litecoin', tkr: 'LTC', type: 'Coin (L1)', cons: 'PoW (Scrypt)', model: 'UTXO', time: '2.5 min' },
    { id: 'doge', name: 'Dogecoin', tkr: 'DOGE', type: 'Coin (L1)', cons: 'PoW (Scrypt)', model: 'UTXO', time: '1 min' },
    { id: 'ada', name: 'Cardano', tkr: 'ADA', type: 'Coin (L1)', cons: 'PoS', model: 'eUTXO', time: '~20 s' },
  ];

  // XP rewards
  F.xp = { theory: 10, lab: 60, quiz: 30, quizRetry: 10, choice: 20, level: 50, passport: 100 };
  F.ranks = [0, 250, 700, 1300, 1900, 2600, 3300];

  // Achievement ids, in display order. Titles and descriptions are in the locale.
  F.achievements = [
    'avalanche', 'breaker', 'keymaster', 'forgery', 'backup', 'feesniper', 'gossip',
    'miner', 'staker', 'authority', 'survivor', 'minted', 'outofgas', 'launched',
    'chaos', 'lean', 'vault', 'reorgproof', 'oncall', 'sharp', 'scholar', 'polyglot',
    'genesis', 'explorer',
  ];
  F.scholarAt = 60;
})();
