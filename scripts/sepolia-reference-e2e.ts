// Hand-run Base Sepolia proof for the reference-matching path.
// Not part of the app. The app never signs or holds a key. This file does, from a throwaway
// key that must stay outside the repository (default /tmp/agorapay-sepolia-e2e.key).
//
// Reads and the broadcast both use https://sepolia.base.org only. Chain id 8453 is refused.
//
//   npm run sepolia:reference-e2e
//
// Skip-clean (exit 0, no evidence write, no transaction):
//   - no SEPOLIA_PAYER_KEY and no key file (a key is not created unless SEPOLIA_E2E_CREATE_KEY=1)
//   - key present but test EURC or Base Sepolia ETH cannot cover the sale and gas
// SEPOLIA_E2E_RECORD_BLOCKED=1 keeps the older behaviour: write run.json and exit 2 when unfunded.
//
// Evidence, only after a real attempt or a recorded block: docs/evidence/sepolia-e2e-<UTC date>/run.json
// If run.json is already there, a later attempt writes run-<timestamp>.json and leaves the first file in place.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createPublicClient, createWalletClient, defineChain, http, parseAbi, type Address, type Hex, type TransactionReceipt } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createChainReader, PUBLIC_RPC, TRANSFER_TOPIC, type FetchLike } from '../src/lib/chainReader'
import { CHAINS, formatUsdc, toAtomicEurc, type OpenRequest } from '../src/lib/chainRequest'
import { type PaymentState } from '../src/lib/confirmation'
import { bindLiveClaim, describeState, openLiveRequest, refreshLive } from '../src/lib/liveSession'
import { createReference } from '../src/lib/reference'
import { parseRequestLink, walletTransferUri } from '../src/lib/requestLink'
import { assertKeyFileOutsideRepo, assertNoSecrets, assertSepoliaChainId, assertSepoliaRpc, decideAfterBalances, decideHarnessStart, ethForTransfers, SEPOLIA_CHAIN_ID, SEPOLIA_RPC } from './sepoliaE2eGuard'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EURC = CHAINS.baseSepolia.tokens.EURC as Address
const ERC20 = parseAbi([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
])
const baseSepolia = defineChain({
  id: SEPOLIA_CHAIN_ID,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [SEPOLIA_RPC] } },
})

const READ_ONLY = new Set(['eth_blockNumber', 'eth_getLogs', 'eth_getBlockByNumber', 'eth_getTransactionReceipt'])

function pacedReaderFetch(): FetchLike {
  let last = 0
  return async (url, init) => {
    assertSepoliaRpc(url)
    const method = (JSON.parse(init.body) as { method?: string }).method
    if (!method || !READ_ONLY.has(method)) throw new Error(`Harness reader blocked method ${String(method)}`)
    const wait = 150 - (Date.now() - last)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    last = Date.now()
    return fetch(url, init)
  }
}

function loadPayerKey(): Hex {
  const fromEnv = process.env.SEPOLIA_PAYER_KEY?.trim()
  if (fromEnv) return normalizeKey(fromEnv)
  const keyFile = process.env.SEPOLIA_PAYER_KEY_FILE?.trim() || '/tmp/agorapay-sepolia-e2e.key'
  assertKeyFileOutsideRepo(keyFile, repoRoot)
  if (!existsSync(keyFile)) {
    const created = generatePrivateKey()
    writeFileSync(keyFile, created + '\n', { mode: 0o600 })
    process.stderr.write(`Created throwaway key at ${keyFile} (not in the repo).\n`)
    return created
  }
  return normalizeKey(readFileSync(keyFile, 'utf8'))
}

function normalizeKey(raw: string): Hex {
  const trimmed = raw.trim()
  const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) throw new Error('Payer key must be 32 bytes of hex. It was not loaded.')
  return withPrefix as Hex
}

function serializeState(state: PaymentState) {
  return { ...state, line: describeState(state) }
}

function serializeRequest(req: OpenRequest) {
  return {
    orderId: req.orderId,
    chain: req.chain,
    token: req.token,
    merchant: req.merchant,
    atomic: req.atomic.toString(),
    baseAtomic: req.baseAtomic.toString(),
    tag: req.tag,
    reference: req.reference ?? null,
    formatted: formatUsdc(req.atomic) + ' ' + req.token,
  }
}

function transferLogs(receipt: TransactionReceipt) {
  return receipt.logs
    .filter((log) => log.address.toLowerCase() === EURC.toLowerCase() && log.topics[0]?.toLowerCase() === TRANSFER_TOPIC)
    .map((log) => ({
      address: log.address,
      topics: log.topics,
      data: log.data,
      blockNumber: Number(log.blockNumber),
      logIndex: log.logIndex,
      transactionHash: log.transactionHash,
    }))
}

function safe(error: unknown, secret: string): string {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.split(secret).join('[redacted]').split(secret.slice(2)).join('[redacted]')
}

async function main() {
  if (PUBLIC_RPC.baseSepolia !== SEPOLIA_RPC) throw new Error('App Sepolia RPC constant changed; refusing to run')
  assertSepoliaRpc(SEPOLIA_RPC)
  const keyFile = process.env.SEPOLIA_PAYER_KEY_FILE?.trim() || '/tmp/agorapay-sepolia-e2e.key'
  const hasKey = Boolean(process.env.SEPOLIA_PAYER_KEY?.trim()) || existsSync(keyFile)
  const start = decideHarnessStart({ hasKey, createKey: process.env.SEPOLIA_E2E_CREATE_KEY === '1' })
  if (start.action === 'skip') {
    process.stderr.write(`SKIP ${start.reason}\n`)
    process.exitCode = start.exitCode
    return
  }
  const recordBlocked = process.env.SEPOLIA_E2E_RECORD_BLOCKED === '1'
  const secret = loadPayerKey()
  const payer = privateKeyToAccount(secret)
  const merchant = privateKeyToAccount(generatePrivateKey()).address
  if (merchant.toLowerCase() === payer.address.toLowerCase()) throw new Error('Merchant and payer must differ')

  const transport = http(SEPOLIA_RPC)
  const publicClient = createPublicClient({ chain: baseSepolia, transport })
  const walletClient = createWalletClient({ account: payer, chain: baseSepolia, transport })
  const reader = createChainReader({ fetchFn: pacedReaderFetch(), rpcUrl: SEPOLIA_RPC, maxRange: 501, maxCalls: 800, retries: 5 })

  const evidence: Record<string, unknown> = {
    product: 'Agora Pay',
    harness: 'scripts/sepolia-reference-e2e.ts',
    generatedAt: new Date().toISOString(),
    rpc: SEPOLIA_RPC,
    chainIdExpected: SEPOLIA_CHAIN_ID,
    mainnetEnabled: false,
    payer: payer.address,
    merchant,
    token: { symbol: 'EURC', address: EURC, chain: 'baseSepolia' },
    outcome: 'incomplete',
  }

  const day = evidence.generatedAt as string
  const outDir = join(repoRoot, 'docs/evidence', `sepolia-e2e-${day.slice(0, 10)}`)
  const write = () => {
    assertNoSecrets(evidence)
    const json = JSON.stringify(evidence, null, 2)
    if (json.toLowerCase().includes(secret.toLowerCase()) || json.toLowerCase().includes(secret.slice(2).toLowerCase())) {
      throw new Error('Refusing to write evidence that contains the payer key')
    }
    mkdirSync(outDir, { recursive: true })
    let outFile = join(outDir, 'run.json')
    if (existsSync(outFile)) {
      const stamp = String(evidence.generatedAt).replace(/[:.]/g, '-')
      outFile = join(outDir, `run-${stamp}.json`)
    }
    writeFileSync(outFile, json + '\n')
    return outFile
  }

  try {
    const chainId = await publicClient.getChainId()
    assertSepoliaChainId(chainId)
    evidence.chainId = chainId
    const [symbol, decimals, eth, eurc, gasPrice, headNow] = await Promise.all([
      publicClient.readContract({ address: EURC, abi: ERC20, functionName: 'symbol' }),
      publicClient.readContract({ address: EURC, abi: ERC20, functionName: 'decimals' }),
      publicClient.getBalance({ address: payer.address }),
      publicClient.readContract({ address: EURC, abi: ERC20, functionName: 'balanceOf', args: [payer.address] }),
      publicClient.getGasPrice(),
      reader.headBlock(),
    ])
    evidence.token = { symbol, decimals, address: EURC, chain: 'baseSepolia' }
    evidence.balancesBefore = { ethWei: eth.toString(), eurcAtomic: eurc.toString(), eurc: formatUsdc(eurc) }
    evidence.gasPriceWei = gasPrice.toString()
    evidence.headBefore = headNow.head

    let mainnetError = ''
    try {
      await openLiveRequest(reader, { orderId: 'mainnet-must-fail', chain: 'base', merchant, eurAmount: 0.1 }, [], () => 0)
    } catch (error) {
      mainnetError = safe(error, secret)
    }
    evidence.mainnetGuard = mainnetError
    if (!/Mainnet is disabled/.test(mainnetError)) throw new Error(`Mainnet guard did not trip: ${mainnetError}`)

    const saleFloor = toAtomicEurc(0.1)
    const minEth = ethForTransfers(gasPrice, 1)
    if (!recordBlocked && (eurc < saleFloor || eth < minEth)) {
      const early = decideAfterBalances({ eurcAtomic: eurc, saleAtomic: saleFloor, ethWei: eth, gasPriceWei: gasPrice, recordBlocked: false })
      if (early.action !== 'skip') throw new Error('An unfunded payer must skip without sending')
      process.stderr.write(`SKIP ${early.reason}\n`)
      process.exitCode = early.exitCode
      return
    }

    const inbound = await reader.transfers({
      chain: 'baseSepolia',
      token: 'EURC',
      merchant: payer.address,
      fromBlock: Math.max(0, headNow.head - 8_000),
      toBlock: headNow.head,
    })
    const inboundRows = []
    for (const log of inbound.logs) {
      const receipt = await reader.transfersInTransaction({ chain: 'baseSepolia', token: 'EURC', txHash: log.txHash })
      inboundRows.push({
        txHash: log.txHash,
        from: log.from,
        to: log.to,
        valueAtomic: log.value.toString(),
        value: formatUsdc(log.value),
        blockNumber: log.blockNumber,
        blockHash: log.blockHash,
        logIndex: log.logIndex,
        receiptTransferCount: receipt.logs.length,
        explorer: `https://sepolia.basescan.org/tx/${log.txHash}`,
      })
    }
    evidence.inboundEurc = inboundRows

    process.stderr.write('Opening a live Sepolia sale (24h history read)...\n')
    const live = await openLiveRequest(
      reader,
      { orderId: `sepolia-e2e-${Date.now()}`, chain: 'baseSepolia', merchant, eurAmount: 0.1, ttlSeconds: 3600 },
      [],
      Math.random,
    )
    const walletUri = walletTransferUri(live.uri)
    const parsed = parseRequestLink(live.uri)
    if (!live.request.reference || !live.uri.endsWith(`#ref=${live.request.reference}`)) throw new Error('Share link is missing #ref=')
    if (walletUri.includes('ref=') || walletUri.includes('#')) throw new Error('Wallet link must be a plain transfer')
    if (parsed.chain !== 'baseSepolia' || parsed.atomic !== live.request.atomic || parsed.reference !== live.request.reference) {
      throw new Error('Parsed share link does not match the sale')
    }
    const unpaid = await refreshLive(reader, live)
    const panels: unknown[] = [{ step: 'created-unpaid', state: serializeState(unpaid) }]
    evidence.sale = {
      request: serializeRequest(live.request),
      window: live.window,
      shareLink: live.uri,
      walletLink: walletUri,
      referenceOnFragment: true,
      walletLinkOmitsReference: true,
    }
    evidence.panels = panels

    const atomic = live.request.atomic
    const plan = decideAfterBalances({ eurcAtomic: eurc, saleAtomic: atomic, ethWei: eth, gasPriceWei: gasPrice, recordBlocked })
    if (plan.ethNeedWei === undefined) throw new Error('Funding plan did not compute a gas buffer')
    evidence.ethNeedWei = plan.ethNeedWei.toString()
    if (plan.action === 'skip') {
      process.stderr.write(`SKIP ${plan.reason}\n`)
      process.exitCode = plan.exitCode
      return
    }
    if (plan.action === 'blocked') {
      evidence.outcome = 'blocked'
      evidence.blocker = plan.reason
      evidence.nextUnlock = eurc < atomic
        ? `Fund ${payer.address} with test EURC at ${EURC} on Base Sepolia (chain 84532), then re-run npm run sepolia:reference-e2e. Do not use mainnet.`
        : `Fund ${payer.address} with Base Sepolia ETH for gas (testnet only; do not send mainnet ETH or flip any mainnet flag), then re-run npm run sepolia:reference-e2e. The sale above was created and left unpaid.`
      const blockedFile = write()
      process.stderr.write(`BLOCKED ${plan.reason}\nWrote ${blockedFile}\n`)
      process.exitCode = plan.exitCode
      return
    }
    const transfersWanted = plan.transfers

    process.stderr.write(`Sending ${transfersWanted} EURC transfer(s) of ${formatUsdc(atomic)} to ${merchant}...\n`)
    const sent: Array<{ hash: Hex; receipt: TransactionReceipt }> = []
    for (let i = 0; i < transfersWanted; i++) {
      const hash = await walletClient.writeContract({ address: EURC, abi: ERC20, functionName: 'transfer', args: [merchant, atomic] })
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
      sent.push({ hash, receipt })
      process.stderr.write(`tx${i + 1} ${hash} status ${receipt.status}\n`)
    }
    evidence.payments = sent.map((item) => ({
      txHash: item.hash,
      status: item.receipt.status,
      blockNumber: Number(item.receipt.blockNumber),
      from: item.receipt.from,
      to: item.receipt.to,
      explorer: `https://sepolia.basescan.org/tx/${item.hash}`,
      transferLogs: transferLogs(item.receipt),
    }))
    if (sent.some((item) => item.receipt.status !== 'success')) throw new Error('A transfer receipt was not successful')

    if (transfersWanted === 2) {
      const ambiguous = await refreshLive(reader, live)
      panels.push({ step: 'two-equal-amounts-no-hash', state: serializeState(ambiguous) })
    }
    const missedLive = bindLiveClaim(live, '0x' + 'ab'.repeat(32))
    const missed = await refreshLive(reader, missedLive)
    panels.push({ step: 'unknown-hash', state: serializeState(missed) })

    const paymentHash = sent[0].hash
    const bound = bindLiveClaim(live, paymentHash)
    let state = await refreshLive(reader, bound)
    panels.push({ step: 'hash-bound', state: serializeState(state) })
    const deadline = Date.now() + 180_000
    while (state.status !== 'confirmed' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000))
      const next = await refreshLive(reader, bound, state)
      if (next.status !== state.status || ('confirmations' in next && 'confirmations' in state && next.confirmations !== state.confirmations)) {
        panels.push({ step: 'poll', state: serializeState(next) })
      }
      state = next
    }
    panels.push({ step: 'final-poll', state: serializeState(state) })

    const otherRef = createReference((bytes) => bytes.fill(0x5a))
    let secondClaim = 'did not throw'
    try {
      bindLiveClaim(
        { ...live, request: { ...live.request, orderId: 'other-sale', reference: otherRef } },
        paymentHash,
        [{ reference: live.request.reference!, txHash: paymentHash }],
      )
    } catch (error) {
      secondClaim = safe(error, secret)
    }
    evidence.sameHashSecondReference = secondClaim

    const via = state.status === 'pending' || state.status === 'confirmed' ? state.via : null
    evidence.outcome = state.status === 'confirmed' && via === 'reference'
      ? 'confirmed'
      : state.status === 'pending' && via === 'reference'
        ? 'pending'
        : 'incomplete'
    evidence.matched = state.status === 'pending' || state.status === 'confirmed'
      ? { status: state.status, via: state.via, confirmations: state.confirmations, final: state.status === 'confirmed' ? state.final : false, txHash: state.seen.txHash }
      : null
    const wrote = write()
    process.stderr.write(`Wrote ${wrote} outcome ${String(evidence.outcome)}\n`)
    if (evidence.outcome === 'incomplete') process.exitCode = 1
  } catch (error) {
    evidence.outcome = 'error'
    evidence.error = safe(error, secret)
    try { write() } catch (writeError) { process.stderr.write(safe(writeError, secret) + '\n') }
    process.stderr.write(safe(error, secret) + '\n')
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
