// tx.js

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.min.js";
import { getValidAuthToken } from "./auth.js";
import { showPanel } from "./dashboard.js";

const ETHERSCAN_API_KEY = "DH4MXSXX71H9T3W2E7JDJUGHA3RZCEJFZ6";

async function fetchEthHistory(addr) {
  const provider = new ethers.providers.EtherscanProvider(
    "homestead",
    ETHERSCAN_API_KEY
  );
  return provider.getHistory(addr);
}

async function fetchSwapHistory() {
  const token = getValidAuthToken();
  if (!token) return [];
  const resp = await fetch("/api/swap", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return [];
  return resp.json();
}

async function loadAndRenderTxs() {
  const txContainer = document.getElementById("tx-content");
  txContainer.innerHTML = `<p>Loading…</p>`;
  txContainer.style.fontSize = "1.2rem";

  const addr = window.walletData?.address;
  if (!addr) {
    txContainer.innerHTML = `<p>Please connect your wallet first.</p>`;
    return;
  }

  // Parallel fetch
  const [ethTxs, swaps] = await Promise.all([
    fetchEthHistory(addr).catch(() => []),
    fetchSwapHistory().catch(() => []),
  ]);

  const onchain = ethTxs.map(tx => ({
    key: tx.hash,
    type: "ETH",
    msg:
      tx.from.toLowerCase() === addr.toLowerCase()
        ? `Sent ${ethers.utils.formatEther(tx.value)} ETH to ${tx.to}`
        : `Received ${ethers.utils.formatEther(tx.value)} ETH from ${tx.from}`,
    time: new Date(tx.timestamp * 1000)
  }));

  const offchain = swaps.map(s => ({
    key: s.txHash,
    type: "SWAP",
    msg: `${s.fromAmount} ${s.fromToken} → ${s.toAmount} ${s.toToken}`,
    time: new Date(s.createdAt)
  }));

  const all = [...offchain, ...onchain].sort((a, b) => b.time - a.time);

  if (all.length === 0) {
    txContainer.innerHTML = `<p>No transactions yet.</p>`;
    return;
  }

  txContainer.innerHTML = all.map(tx => `
    <div class="tx-item ${tx.type === "SWAP" ? "swap" : ""}">
      <strong>${tx.type}</strong> ${tx.msg}
      <small>${tx.time.toLocaleString("en-US", {
        dateStyle: "short",
        timeStyle: "short"
      })}</small>
    </div>
  `).join("");
}

window.loadAndRenderTxs = loadAndRenderTxs;

document.addEventListener("DOMContentLoaded", () => {
  const txLink = document.getElementById("tx-link");
  if (!txLink) return;

  txLink.addEventListener("click", e => {
    e.preventDefault();
    showPanel("tx-panel", txLink);
    loadAndRenderTxs();
  });
});
