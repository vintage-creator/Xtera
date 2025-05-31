import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.min.js";
import { getValidAuthToken } from "./auth.js"
import { showToast } from "./util.js";
import { restoreWalletDataOnDashboard } from "./dashboard.js"
const INFURA_KEY = "a770b1df902d41ada583c9ec87cb133c";

const walletModal = document.getElementById("wallet-modal");

// Global walletData
window.walletData = {
  connectedWallet: null,
  address: null,
  balance: null,
  cryptoType: null,
};

// Cache settings
const CACHE_KEY = "walletData";
const CACHE_TTL = 60 * 60 * 1000;

 async function ensureRegistered(address) {
  const token = getValidAuthToken();
  // If we have a token, use the protected endpoint:
  let url = "/api/status";
  let headers = {};
  if (token) {
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  } else {
    // No token yet: just ask by address
    url = `/api/status?address=${address}`;
  }

  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    console.error("Status check failed", resp.status);
    return false;
  }

  const { registered, message } = await resp.json();
  if (!registered) {
    showToast(
      message === "Email not verified"
        ? "Please verify your email first."
        : "Please create an account first.",
      "warning",
      () => (window.location.href = "/create-account.html")
    );
    return false;
  }

  return true;
}

async function walletLogin(address, signature, chain = "ETH", personId = null) {
  // Build the request payload
  const payload =
    chain === "SOL" ? { address, signature, chain } : { address, signature };

    if (personId) payload.personId = personId;

  // Call your login API
  const resp = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Handle errors
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(errBody.error || `Login failed (status ${resp.status})`);
  }
  const { token, message } = await resp.json();

  if (message) {
    showToast(message, "info");
  }

  const expiresAt = Date.now() + 60 * 60 * 1000;
  localStorage.setItem("authToken", JSON.stringify({ token, expiresAt }));
  showToast("✅ Logged in!");

  window.location.href = "/enable-2fa.html";
}


// — Helpers for caching & restoring —
export function cacheWalletData(data) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, connectedAt: Date.now() }));
}

function restoreFromCache() {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return false;
  try {
    const cached = JSON.parse(raw);
    if (Date.now() - cached.connectedAt > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return false;
    }
    window.walletData = { ...cached };
    updateWalletUI(cached);
    return true;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return false;
  }
}

// — UI helper to show address & balance —
export function updateWalletUI({ address, balance, cryptoType }) {
  const walletInfo    = document.getElementById("wallet-info");
  const walletAddress = document.getElementById("wallet-address");
  const walletBalance = document.getElementById("wallet-balance");
  const walletHeading = document.querySelector("#wallet-modal h3");

  if (!walletAddress || !walletBalance || !walletHeading) return;

  const short = address
    ? address.slice(0,6) + "…" + address.slice(-6)
    : "Not connected";

  walletHeading.textContent = address
    ? cryptoType === "ETH" ? "Ethereum Connected" : "Solana Connected"
    : "Connect Your Wallet";

    walletAddress.innerHTML = `
    <span style="display: flex; align-items: center; gap: 8px;">
      <span style="color: rgb(48, 47, 47);">Wallet Address:</span>
      <span id="short-address" style="font-weight: 500;">${short}</span>
      <button id="copy-address-btn" title="Copy" 
        style="background: none; border: none; cursor: pointer; font-size: 1rem; padding: 0; line-height: 1;">
        📋
      </button>
    </span>
  `;
  walletBalance.innerHTML = `
      <span style="display:flex;align-items:center;gap:8px;">
        <span style="color: rgb(48, 47, 47);">Balance:</span>
        <span style="font-weight:500;">${balance || 0} ${cryptoType||""}</span>
      </span>
    `;
  walletInfo && (walletInfo.style.display = address ? "block" : "none");

  // hook up “copy” if present
  const copyBtn = document.getElementById("copy-address-btn");
  if (copyBtn && address) {
    copyBtn.onclick = () =>
      navigator.clipboard.writeText(address)
        .then(() => showToast("Address copied!", "success"))
        .catch(() => showToast("Copy failed", "error"));
  }
}

// — Check whether wallets are available —
export function checkWalletAvailability() {
  const ethBtn = document.getElementById("connect-eth");
  const solBtn = document.getElementById("connect-sol");
  if (ethBtn) ethBtn.disabled = !window.ethereum;
  if (solBtn) solBtn.disabled = !(window.solana && window.solana.isPhantom);
}

// — Refresh on-chain balance —
export async function refreshBalance() {
  const wd = window.walletData || {};
  if (!wd.address) return;
  try {
    if (wd.connectedWallet === "eth") {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const bn = await provider.getBalance(wd.address);
      wd.balance = ethers.utils.formatEther(bn);
    } else {
      const conn     = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl("mainnet-beta"));
      const lamports = await conn.getBalance(new solanaWeb3.PublicKey(wd.address));
      wd.balance    = (lamports / 1e9).toFixed(4);
    }
    cacheWalletData(wd);
    updateWalletUI(wd);
  } catch (err) {
    console.warn("Balance refresh failed", err);
  }
}

export function openWalletModal() {
  if (!walletModal) return;
  walletModal.style.display = "block";
  // Re-disable wallets if needed
  checkWalletAvailability();
  // If a wallet was previously connected, refresh its balance
  if (window.walletData.address) {
    refreshBalance();
  }
}

// — Connect Ethereum wallet —
export async function connectEthWallet(e) {
  if (e?.preventDefault) e.preventDefault();

  let provider;
  try {
    if (window.ethereum) {
      provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
    } else {
      const wc = new WalletConnectProvider({ rpc: { 1: `https://mainnet.infura.io/v3/${INFURA_KEY}` }, qrcode: true });
      await wc.enable();
      provider = new ethers.providers.Web3Provider(wc);
    }
  } catch {
    return showToast("No Ethereum wallet found", "error");
  }

  const signer  = provider.getSigner();
  const address = (await signer.getAddress()).toLowerCase();
  const personId     = localStorage.getItem("personId");
  const hasJWT       = Boolean(getValidAuthToken());
  const justRegister = personId && !hasJWT;
  if (!justRegister && !(await ensureRegistered(address))) return;

  const balWei  = await provider.getBalance(address);
  const balance = ethers.utils.formatEther(balWei);

  const data = { connectedWallet: "eth", address, balance, cryptoType: "ETH" };
  window.walletData = data;
  cacheWalletData(data);
  updateWalletUI(data);
  showToast("✅ ETH connected", "success");

  // login & redirect
  const token = getValidAuthToken();
  if (!token) {
    const { message } = await (await fetch(`/api/nonce/${address}`)).json();
    const sig = await signer.signMessage(message);
    await walletLogin(address, sig, "ETH", personId);
    window.location.href = "/enable-2fa.html";
  } else {
    window.location.href = "/dashboard.html";
  }
}

// — Connect Solana wallet —
export async function connectSolWallet(e) {
  if (e?.preventDefault) e.preventDefault();
  if (!(window.solana && window.solana.isPhantom)) {
    showToast("Solana wallet not found", "error");
    return;
  }

  const resp    = await window.solana.connect();
  const address = resp.publicKey.toString().toLowerCase();
  const personId     = localStorage.getItem("personId");
  const hasJWT       = Boolean(getValidAuthToken());
  const justRegister = personId && !hasJWT;
  if (!justRegister && !(await ensureRegistered(address))) return;

  const conn     = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl("mainnet-beta"));
  const lamports = await conn.getBalance(resp.publicKey);
  const balance  = (lamports / 1e9).toFixed(4);

  const data = { connectedWallet: "sol", address, balance, cryptoType: "SOL" };
  window.walletData = data;
  cacheWalletData(data);
  updateWalletUI(data);
  showToast("✅ SOL connected", "success");

  // login & redirect
  const { message } = await (await fetch(`/api/nonce/${address}`)).json();
  const encoded     = new TextEncoder().encode(message);
  const signed      = await window.solana.signMessage(encoded, "utf8");
  const signature   = Buffer.from(signed.signature).toString("base64");

  await walletLogin(address, signature, "SOL", personId);
  window.location.href = "/enable-2fa.html";
}

// — Disconnect wallet —
export function disconnectWallet() {
  if (window.walletData?.connectedWallet === "sol" && window.solana.isConnected) {
    window.solana.disconnect();
  }
  localStorage.removeItem(CACHE_KEY);
  window.walletData = { connectedWallet: null, address: null, balance: null, cryptoType: null };
  updateWalletUI(window.walletData);
  showToast("🔌 Wallet disconnected", "info");
}

// — DOM wiring & modal logic —————————
document.addEventListener("DOMContentLoaded", () => {
  restoreWalletDataOnDashboard();
  
  // connection buttons & disconnect
  const closeBtn    = document.getElementById("close-btn");
  const ethBtn = document.getElementById("connect-eth");
  const solBtn = document.getElementById("connect-sol");
  const connectEthButtons = document.querySelectorAll(".connect-eth-btn");
  const connectSolButtons = document.querySelectorAll(".connect-sol-btn");
  const disBtn = document.getElementById("disconnect-btn");

  // try to restore existing walletData
  restoreFromCache();

  // disable unavailable wallets
  checkWalletAvailability();

  // if already connected, refresh on-chain balance
  if (window.walletData.address) {
    refreshBalance();
  }

  if (closeBtn && walletModal) {
    closeBtn.addEventListener("click", () => (walletModal.style.display = "none"));
    window.addEventListener("click", (e) => {
      if (e.target === walletModal) walletModal.style.display = "none";
    });
  }

  // wire connect/disconnect
  if (ethBtn) ethBtn.addEventListener("click", connectEthWallet);
  if (solBtn) solBtn.addEventListener("click", connectSolWallet);
  if (connectEthButtons) connectEthButtons.forEach(btn => btn.addEventListener("click", connectEthWallet));
  if (connectSolButtons) connectSolButtons.forEach(btn => btn.addEventListener("click", connectSolWallet));
  if (disBtn) disBtn.addEventListener("click", disconnectWallet);
});