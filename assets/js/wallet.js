import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.min.js";
import { showToast } from "./util.js";

// Global walletData
window.walletData = {
  connectedWallet: null, 
  address:         null,
  balance:         null,
  cryptoType:      null,
};

// Cache settings
const CACHE_KEY = "walletData";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const walletBtn      = document.getElementById("wallet-btn");
  const walletModal    = document.getElementById("wallet-modal");
  const closeBtn       = document.getElementById("close-btn");
  const ethBtn         = document.getElementById("connect-eth");
  const solBtn         = document.getElementById("connect-sol");
  const walletInfo     = document.getElementById("wallet-info");
  const disconnectBtn  = document.getElementById("disconnect-btn");
  const walletAddressE = document.getElementById("wallet-address");
  const walletBalanceE = document.getElementById("wallet-balance");
  const walletHeading  = document.querySelector("#wallet-modal h2");

  // ————————— RESTORE / EXPIRE CACHE —————————
  function restoreFromCache() {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    try {
      const cached = JSON.parse(raw);
      if (Date.now() - cached.connectedAt > CACHE_TTL) {
        // expired
        localStorage.removeItem(CACHE_KEY);
        return false;
      }
      // valid: populate global & UI
      window.walletData = { ...cached };
      updateWalletUI(cached);
      return true;
    } catch {
      localStorage.removeItem(CACHE_KEY);
      return false;
    }
  }

  function cacheWalletData(data) {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...data, connectedAt: Date.now() })
    );
  }

  // ————————— UI HELPERS —————————
  function shortenAddress(address, chars = 5) {
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
  }

  function updateWalletUI({ address, balance, cryptoType }) {
    // address
    const short = shortenAddress(address);
    walletAddressE.innerHTML = `
    <span style="display: flex; align-items: center; gap: 8px;">
      <span style="color: rgb(48, 47, 47);">Wallet Address:</span>
      <span id="short-address" style="font-weight: 500;">${short}</span>
      <button id="copy-address" title="Copy" 
        style="background: none; border: none; cursor: pointer; font-size: 1rem; padding: 0; line-height: 1;">
        📋
      </button>
    </span>
  `;
    document.getElementById("copy-address").onclick = () =>
      navigator.clipboard
        .writeText(address)
        .then(() => showToast("Address copied!", "success"));

    // balance
    const unit = cryptoType === "ETH" ? "ETH" : "SOL";
    walletBalanceE.innerHTML = `
      <span style="display:flex;align-items:center;gap:8px;">
        <span style="color: rgb(48, 47, 47);">Balance:</span>
        <span style="font-weight:500;">${balance} ${unit}</span>
      </span>
    `;
    walletInfo.style.display    = "block";
    disconnectBtn.style.display = "inline-block";
    walletHeading.textContent = cryptoType === "ETH" ? "Ethereum Wallet Connected" : cryptoType === "SOL" ? "Solana Wallet Connected" : "Wallet Connected";
  }

  // ————————— CHECK AVAILABILITY —————————
  function checkWalletAvailability() {
    ethBtn.disabled = !window.ethereum;
    solBtn.disabled = !(window.solana && window.solana.isPhantom);
    if (!window.ethereum) showToast("Ethereum wallet not installed", "info");
    if (!(window.solana && window.solana.isPhantom))
      showToast("Solana wallet not installed", "info");
  }

  // ————————— BALANCE REFRESH —————————
  async function refreshBalance() {
    const wd = window.walletData;
    if (!wd.address) return;
    try {
      if (wd.connectedWallet === "eth") {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const bn = await provider.getBalance(wd.address);
        wd.balance = ethers.utils.formatEther(bn);
      } else {
        const conn = new solanaWeb3.Connection(
          solanaWeb3.clusterApiUrl("mainnet-beta")
        );
        const pk = new solanaWeb3.PublicKey(wd.address);
        const lamports = await conn.getBalance(pk);
        wd.balance = (lamports / 1e9).toFixed(4);
      }
      cacheWalletData(wd);
      updateWalletUI(wd);
    } catch (err) {
      console.warn("Balance refresh failed", err);
    }
  }

  // ————————— INITIALIZE —————————
  restoreFromCache();

  // ————————— MODAL BEHAVIOR —————————
  walletBtn.addEventListener("click", () => {
    walletModal.style.display = "block";
    checkWalletAvailability();
    if (window.walletData.address) {
      // always fetch the freshest balance
      refreshBalance();
    }
  });
  closeBtn.addEventListener("click", () => (walletModal.style.display = "none"));
  window.addEventListener("click", e => {
    if (e.target === walletModal) walletModal.style.display = "none";
  });

  // ————————— CONNECT ETH —————————
  ethBtn.addEventListener("click", async () => {
    try {
      let provider;
  
      if (window.ethereum) {
        // Injected wallet 
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
      } else {
        // WalletConnect fallback
        const wcProvider = new WalletConnectProvider.default({
          rpc: {
            1: "a770b1df902d41ada583c9ec87cb133c"
          },
          qrcode: true,
        });
        await wcProvider.enable();
        provider = new ethers.providers.Web3Provider(wcProvider);
      }
  
      const signer = provider.getSigner();
      const acct   = await signer.getAddress();
      const bn     = await provider.getBalance(acct);
      const bal    = ethers.utils.formatEther(bn);
  
      const data = {
        connectedWallet: "eth",
        address:         acct,
        balance:         bal,
        cryptoType:      "ETH",
      };
      window.walletData = data;
      cacheWalletData(data);
      updateWalletUI(data);
      walletHeading.textContent = "Ethereum Wallet Connected";
      showToast("Ethereum wallet connected", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to connect Ethereum wallet", "error");
    }
  });
  

  // ————————— CONNECT SOLANA —————————
  solBtn.addEventListener("click", async () => {
    if (!(window.solana && window.solana.isPhantom))
      return showToast("Solana wallet not found", "error");
    try {
      const resp      = await window.solana.connect();
      const addr      = resp.publicKey.toString();
      const conn      = new solanaWeb3.Connection(
        solanaWeb3.clusterApiUrl("mainnet-beta")
      );
      const lamports  = await conn.getBalance(resp.publicKey);
      const bal       = (lamports / 1e9).toFixed(4);

      const data = {
        connectedWallet: "sol",
        address:         addr,
        balance:         bal,
        cryptoType:      "SOL",
      };
      window.walletData = data;
      cacheWalletData(data);
      updateWalletUI(data);
      walletHeading.textContent = "Solana Wallet Connected";
      showToast("Solana wallet connected", "success");
    } catch {
      showToast("Failed to connect Solana wallet", "error");
    }
  });

  // ————————— DISCONNECT —————————
  disconnectBtn.addEventListener("click", () => {
    if (window.walletData.connectedWallet === "sol" && window.solana.isConnected) {
      window.solana.disconnect();
    }
    localStorage.removeItem(CACHE_KEY);
    window.walletData = {
      connectedWallet: null, address: null, balance: null, cryptoType: null
    };
    walletAddressE.textContent = "Wallet Address: Not Connected";
    walletBalanceE.textContent = "Balance: 0";
    walletInfo.style.display = "none";
    disconnectBtn.style.display = "none";
    walletHeading.textContent = "Connect Your Wallet";
    showToast("Wallet disconnected", "info");
  });
});

