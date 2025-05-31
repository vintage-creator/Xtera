// recentTx.js

const ETHERSCAN_API_KEY = "DH4MXSXX71H9T3W2E7JDJUGHA3RZCEJFZ6"; 

async function fetchEthHistory(addr) {
    const provider = new ethers.providers.EtherscanProvider(
      "homestead",
      ETHERSCAN_API_KEY 
    );
    return provider.getHistory(addr);
  }
  
  function shortAddr(a) {
    return a.slice(0,6) + '…' + a.slice(-4);
  }
  
  async function fetchSwapHistory() {
    const raw = localStorage.getItem("authToken");
    if (!raw) return [];
    const token = JSON.parse(raw).token;
    const res = await fetch("/api/swap", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return [];
    return res.json();
  }
  
  async function fetchTxs(limit = 5) {
    const addr = window.walletData?.address;
    if (!addr) return [];
  
    const [ ethTxs, swaps ] = await Promise.all([
      fetchEthHistory(addr).catch(()=>[]),
      fetchSwapHistory().catch(()=>[])
    ]);
  
    const onchain = ethTxs.map(tx => ({
      key:  tx.hash,
      type: "ETH",
      desc: tx.from.toLowerCase() === addr.toLowerCase()
        ? `Sent ${ethers.utils.formatEther(tx.value)} ETH to ${shortAddr(tx.to)}`
        : `Received ${ethers.utils.formatEther(tx.value)} ETH from ${shortAddr(tx.from)}`,
      time: new Date(tx.timestamp * 1000)
    }));
  
    const offchain = swaps.map(s => ({
      key:  s.txHash,
      type: "SWAP",
      desc: `${s.fromAmount} ${s.fromToken} → ${s.toAmount} ${s.toToken}`,
      time: new Date(s.createdAt)
    }));
  
    return [...offchain, ...onchain]
      .sort((a,b) => b.time - a.time)
      .slice(0, limit);
  }
  
  async function renderRecentTransactions() {
    const list = document.getElementById("recent-tx-list");
    if (!list) return;
  
    const txs = await fetchTxs(2);
    if (!txs.length) {
      list.innerHTML = `<p style="padding:1rem;color:#666; font-size:1.2rem;">No recent transactions</p>`;
      return;
    }
  
    list.innerHTML = txs.map(tx => `
      <div class="transaction">
        <div class="service">
          <div class="icon ${tx.type === "SWAP" ? "bg-primary-light" : "bg-success-light"}">
            <span class="material-symbols-sharp">
              ${ tx.type === "SWAP" ? "swap_horiz" : "currency_bitcoin" }
            </span>
          </div>
          <div class="details">
            <h4>${tx.type}</h4>
            <p>${tx.time.toLocaleDateString()}</p>
          </div>
        </div>
        <div class="details" style="flex:1;text-align:right">
          <small>${tx.desc}</small>
        </div>
      </div>
    `).join("");
  }
  
  document.addEventListener("DOMContentLoaded", () => {
    renderRecentTransactions();
  
    const moreLink = document.getElementById("recent-more");
    if (moreLink) {
      moreLink.addEventListener("click", e => {
        e.preventDefault();
        document.getElementById("tx-link")?.click();
      });
    }
  });
  