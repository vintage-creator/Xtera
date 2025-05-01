import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.min.js";
import { showToast } from "./util.js";

const TOKEN_DECIMALS = {
  DAI: 18,
  USDC: 6,
  WETH: 18,
  // add others as needed…
};

const TOKEN_ADDRESSES = {
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  USDC: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  // …add any others you let users swap
};

// ————————— SWAP INTEGRATION —————————
document.addEventListener("DOMContentLoaded", () => {
  const swapLink = document.getElementById("swapCryptoLink");
  const swapModal = document.getElementById("swapCryptoModal");
  const swapClose = document.querySelector("[data-swap-close]");
  const getQuoteBtn = document.getElementById("getSwapQuoteBtn");
  const execBtn = document.getElementById("executeSwapBtn");
  const quoteInfo = document.getElementById("swapQuoteInfo");
  const swapForm = document.getElementById("swapForm");

  let lastSwapQuote = null;

  // disable by default:
  const disableSwapButton = () => {
    getQuoteBtn.disabled = true;
    getQuoteBtn.style.opacity = 0.5;
    getQuoteBtn.style.cursor = "not-allowed";
  };
  const enableSwapButton = () => {
    getQuoteBtn.disabled = false;
    getQuoteBtn.style.opacity = 1;
    getQuoteBtn.style.cursor = "pointer";
  };

  disableSwapButton();

  // open/close modal
  swapLink.addEventListener("click", () => {
    if (window.walletData?.address) enableSwapButton();
    else disableSwapButton();
    swapModal.style.display = "block";
  });
  swapClose.addEventListener("click", () => (swapModal.style.display = "none"));
  window.addEventListener("click", (e) => {
    if (e.target === swapModal) swapModal.style.display = "none";
  });

  // 1) Get quote from 0x
  getQuoteBtn.addEventListener("click", async () => {
    if (!window.walletData.address) {
      enableSwapButton();
      return showToast("Connect wallet first", "warning");
    }

    getQuoteBtn.innerText = "Please wait...";
    getQuoteBtn.disabled = true;

    // Let the DOM update before proceeding
    await new Promise(requestAnimationFrame);

    const sellSymbol = document.getElementById("sellToken").value;
    const buySymbol = document.getElementById("buyToken").value;
    const rawAmount = document.getElementById("sellAmount").value;

    if (!rawAmount || isNaN(rawAmount) || Number(rawAmount) <= 0) {
      getQuoteBtn.innerText = "Get Quote";
      getQuoteBtn.disabled = false;
      return showToast("Enter a valid amount you want to swap.", "warning");
    }

    // look up the on-chain addresses
    const sellAddress = TOKEN_ADDRESSES[sellSymbol];
    const buyAddress = TOKEN_ADDRESSES[buySymbol];

    if (!sellAddress || !buyAddress) {
      return showToast("Unsupported token selected", "error");
    }
    const sellDecimals = TOKEN_DECIMALS[sellSymbol] || 18;
    const sellAmount = ethers.utils
      .parseUnits(rawAmount, sellDecimals)
      .toString();

    const params = new URLSearchParams({
      sellToken: sellAddress,
      buyToken: buyAddress,
      sellAmount,
      takerAddress: window.walletData.address,
      swapFeeRecipient: "0xA78f11603A1997B98D6e96D4Ed760Bfad34BdD77", // ← your commission wallet
      swapFeeBps: "20", // ← e.g. 0.20% fee
      swapFeeToken: sellAddress,
    });

    try {
      const res = await fetch(
        `http://localhost:3000/api/quote?${params.toString()}`
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(
          `0x quote failed: ${err.reason || err.description || res.status}`
        );
      }

      const quote = await res.json();
      if (quote.code)
        throw new Error(quote.reason || quote.validationErrors?.[0]?.reason);

      lastSwapQuote = quote;
      // format amounts back to human
      const decimalsBuy = TOKEN_DECIMALS[buySymbol] || 18;
      const decimalsSell = TOKEN_DECIMALS[sellSymbol] || 18;
      const bought = ethers.utils.formatUnits(quote.buyAmount, decimalsBuy);
      const feeAmt = ethers.utils.formatUnits(
        quote.fees.integratorFee.amount,
        decimalsSell
      );

      quoteInfo.innerHTML = `
          <strong>Receive:</strong> ${bought} ${buySymbol}<br>
          <strong>Your Fee:</strong> ${feeAmt} ${sellSymbol}
        `;
      getQuoteBtn.style.display = "none";
      execBtn.style.display = "inline-block";
    } catch (err) {
      getQuoteBtn.innerText = "Get Quote";
      getQuoteBtn.disabled = false;
      showToast("Quote failed: " + err.message, "error");
    }

    swapForm.addEventListener("submit", (e) => {
      e.preventDefault();
    });
  });

  const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
  ];

  // make sure the router can pull your tokens
  async function ensureApproval(tokenAddress, spender, amount, signer) {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const owner = await signer.getAddress();
    const current = await token.allowance(owner, spender);
    if (current.lt(amount)) {
      const tx = await token.approve(spender, amount);
      await tx.wait();
    }
  }

  // 2) Execute the swap
  execBtn.addEventListener("click", async () => {
    if (!lastSwapQuote) return;
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      await ensureApproval(
        lastSwapQuote.sellToken, // the token you’re selling
        lastSwapQuote.transaction.to, // 0x router address
        lastSwapQuote.sellAmount, // base‐units amount
        signer
      );

      const tx = await signer.sendTransaction({
        to: lastSwapQuote.transaction.to,
        data: lastSwapQuote.transaction.data,
        value: lastSwapQuote.transaction.value || "0",
      });

      showToast("Swapping… TX sent: " + tx.hash, "info");
      await tx.wait();
      showToast("Swap complete!", "success");
      swapModal.style.display = "none";
      execBtn.style.display = "none";
      quoteInfo.innerHTML = "";
      getQuoteBtn.style.display = "inline-block";
    } catch (err) {
      showToast("Swap failed: " + err.message, "error");
    }
  });
});
