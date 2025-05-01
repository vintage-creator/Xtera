
document.addEventListener("DOMContentLoaded", () => {
  // ———————————— SELL MODAL ELEMENTS ————————————
  const sellCryptoLink   = document.getElementById("sellCryptoLink");
  const sellModal        = document.getElementById("sellCryptoModal");
  const sellCloseBtn     = sellModal.querySelector("[data-sell-close]");
  const sellCryptoForm   = document.getElementById("sellCryptoForm");
  const sellButton       = document.getElementById("sellButton");

   // Helper function to enable the "Buy Now" button
   const enableSellButton = () => {
    sellButton.disabled = false;
    sellButton.style.opacity = 1;
    sellButton.style.cursor = "pointer";
  };

  // Helper to open/close
  const openSellModal = () => {
    sellModal.style.display = "block";
    if (window.walletData?.address) {
      enableSellButton();
    }
  };
  const closeSellModal = () => (sellModal.style.display = "none");

  sellCryptoLink.addEventListener("click", e => {
    e.preventDefault();
    openSellModal();
  });

  sellCloseBtn.addEventListener("click", closeSellModal);

  window.addEventListener("click", e => {
    if (e.target === sellModal) closeSellModal();
  });

   // Enable "Buy Now" button if wallet is connected
   if (window.walletData?.address) {
    enableSellButton();
  }
    sellCryptoForm.addEventListener("submit", (e) => {
      e.preventDefault();
      closeSellModal();
  });
});

