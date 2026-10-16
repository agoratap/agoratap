/**
 * WalletConnect (Reown) for the payer's pay screen.
 * The project ID is a public, client-side identifier (not a secret). The provider is loaded
 * lazily on click so the pay-link stays light. Connecting only links the payer's wallet;
 * nothing is signed or sent without approval in that wallet.
 */
export const WALLETCONNECT_PROJECT_ID = 'fd55a87597107cf4eb73620aa7282416'
export const WC_OPTIONAL_CHAINS = [1, 8453, 42161, 56, 137, 43114] as const

export function walletConnectConfig(origin = typeof location !== 'undefined' ? location.origin : 'https://agoratap.github.io') {
  return {
    projectId: WALLETCONNECT_PROJECT_ID,
    optionalChains: [...WC_OPTIONAL_CHAINS] as [number, ...number[]],
    showQrModal: true,
    metadata: { name: 'Agora Pay', description: 'Pay with what you hold.', url: origin, icons: [`${origin}/agoratap/pwa-192.svg`] },
  }
}

export async function connectWalletConnect(): Promise<string[]> {
  const { EthereumProvider } = await import('@walletconnect/ethereum-provider')
  const provider = await EthereumProvider.init(walletConnectConfig())
  await provider.connect()
  return provider.accounts
}
