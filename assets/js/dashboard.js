import { fetchWithAuth } from "./auth.js";
import { connectEthWallet, connectSolWallet } from "./wallet.js";
const MOBILE_BREAKPOINT = 768;

export function showPanel(panelId, linkEl) {
  document
    .querySelectorAll("main > section.middle")
    .forEach((sec) => (sec.style.display = "none"));
  document
    .querySelectorAll("aside .sidebar a")
    .forEach((a) => a.classList.remove("active"));

  const panel = document.getElementById(panelId);
  if (panel) panel.style.display = "block";

  if (linkEl) linkEl.classList.add("active");

  localStorage.setItem("activePanel", panelId);
  window.dispatchEvent(new CustomEvent("panelShown", { detail: { panelId } }));
}

function disableQuoteBtn() {
  const btn = document.getElementById("getSwapQuoteBtn");
  if (!btn) return;
  btn.disabled = true;
  btn.style.opacity = 0.5;
  btn.style.cursor = "not-allowed";
}

function enableQuoteBtn() {
  const btn = document.getElementById("getSwapQuoteBtn");
  if (!btn) return;
  btn.disabled = false;
  btn.style.opacity = 1;
  btn.style.cursor = "pointer";
}

function showToast(message, type = "info", onClick = null) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-message">${message}</span>`;

  if (onClick) {
    toast.style.cursor = "pointer";
    toast.addEventListener("click", () => {
      onClick();
      toast.remove();
    });
  } else {
    setTimeout(() => toast.classList.add("fade-out"), 4000);
    setTimeout(() => toast.remove(), 4300);
  }

  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 50);
}

export function restoreWalletDataOnDashboard() {
  const raw = localStorage.getItem("walletData");
  if (!raw) return;
  try {
    const cached = JSON.parse(raw);
    // optionally check if Date.now() - cached.connectedAt <= TTL
    window.walletData = { ...cached };
  } catch {}
}

function renderWalletPanel() {
  const container = document.getElementById("wallet-content");
  if (!container) return;

  // build our card wrapper
  container.innerHTML = `
    <div class="wallet-card" id="wallet-card">
      <header class="wallet-card__header">
      
        <h2 class="wallet-card__title">---</h2>
      </header>
      <div class="wallet-card__body">
        <p class="wallet-card__line">
          <span class="wallet-card__label">Address:</span>
          <span class="wallet-card__value" id="anim-address">—</span>
          <button class="copy-btn" id="copy-address-btn" title="Copy">📋</button>
        </p>
        <p class="wallet-card__line">
          <span class="wallet-card__label">Balance:</span>
          <span class="wallet-card__value" id="anim-balance">—</span>
          <button class="balance-toggle" id="balance-toggle-btn" title="Show/Hide balance">
          <span class="material-symbols-sharp" id="balance-icon">visibility</span>
        </button>
        </p>
        <div id="wallet-cta"></div>
      </div>
    </div>
  `;

  const card = document.getElementById("wallet-card");
  const addressEl = document.getElementById("anim-address");
  const balanceEl = document.getElementById("anim-balance");
  const ctaWrapper = document.getElementById("wallet-cta");
  const balEl = balanceEl;
  const icon = document.getElementById("balance-icon");
  const toggle = document.getElementById("balance-toggle-btn");

  toggle.addEventListener("click", () => {
    const hidden = balEl.dataset.hidden === "true";
    if (hidden) {
      // currently hidden → show
      balEl.textContent = `${window.walletData.balance} ${window.walletData.cryptoType}`;
      balEl.dataset.hidden = "false";
      icon.textContent = "visibility";
    } else {
      // currently shown → hide
      balEl.textContent = "••••••";
      balEl.dataset.hidden = "true";
      icon.textContent = "visibility_off";
    }
  });

  // reset animation state
  card.classList.remove("show");
  addressEl.textContent = "—";
  balanceEl.textContent = "—";
  ctaWrapper.innerHTML = "";

  // fill in after a tiny delay so CSS transition fires
  setTimeout(() => {
    if (!window.walletData?.address) {
      // no wallet → show connect buttons
      addressEl.textContent = "Not connected";
      balanceEl.textContent = "0";

      // build button HTML
      const solButtonHTML = !(window.solana && window.solana.isPhantom)
        ? `<button id="connect-sol" class="wallet-icon-btn" disabled>Solana Not Available</button>`
        : `<button id="connect-sol" class="wallet-icon-btn">Connect SOL Wallet</button>`;

      const ethButtonHTML = `<button id="connect-eth" class="wallet-icon-btn">Connect ETH Wallet</button>`;

      // wrap in one container
      const groupHTML = `
        <div class="wallet-button-group">
          ${ethButtonHTML}
          ${solButtonHTML}
        </div>
      `;
      ctaWrapper.insertAdjacentHTML("beforeend", groupHTML);

      // wire up ETH
      document
        .getElementById("connect-eth")
        .addEventListener("click", async () => {
          try {
            await connectEthWallet();
            showToast("Ethereum wallet connected", "success");
            renderWalletPanel();
          } catch (err) {
            console.error(err);
            showToast("Ethereum connect failed", "error");
          }
        });

      // wire up SOL (only if available)
      const solBtn = document.getElementById("connect-sol");
      if (solBtn) {
        solBtn.addEventListener("click", async () => {
          try {
            await connectSolWallet();
            showToast("Solana wallet connected", "success");
            renderWalletPanel();
          } catch (err) {
            console.error(err);
            showToast("Solana connect failed", "error");
          }
        });
      }
    } else {
      // wallet is connected → show short address + balance + disconnect
      const { address, balance, cryptoType } = window.walletData;
      addressEl.textContent = address.slice(0, 9) + "…" + address.slice(-4);
      balanceEl.textContent = `${balance} ${cryptoType}`;

      ctaWrapper.insertAdjacentHTML(
        "beforeend",
        `<button class="disconnect-btn" id="disconnect-btn">Disconnect</button>`
      );

      // copy-address
      document
        .getElementById("copy-address-btn")
        .addEventListener("click", () => {
          navigator.clipboard
            .writeText(address)
            .then(() => showToast("Address copied!", "success"))
            .catch(() => showToast("Copy failed", "error"));
        });

      // disconnect
      document
        .getElementById("disconnect-btn")
        .addEventListener("click", () => {
          localStorage.removeItem("walletData");
          window.walletData = {
            connectedWallet: null,
            address: null,
            balance: null,
            cryptoType: null,
          };
          showToast("Wallet disconnected", "info");
          renderWalletPanel();
        });
    }

    // trigger the CSS entrance animation
    card.classList.add("show");
  }, 50);
}

document.addEventListener("DOMContentLoaded", () => {
  restoreWalletDataOnDashboard();

  //Show or hide sidebar
  const menuBtn = document.querySelector("#menu-btn");
  const closeBtn = document.querySelector("#close-btn");
  const sidebar = document.querySelector("aside");

  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", () => {
      sidebar.style.display = "block";
    });
  }
  if (closeBtn && sidebar) {
    closeBtn.addEventListener("click", () => {
      sidebar.style.display = "none";
    });
  }

  if (window.innerWidth < MOBILE_BREAKPOINT) {
    document.querySelectorAll("aside .sidebar a").forEach((link) => {
      link.addEventListener("click", () => {
        sidebar.style.display = "none";
      });
    });
  }

  //Change theme
  // const themeBtn = document.querySelector(".theme-btn");
  // themeBtn.addEventListener("click", () => {
  //   document.body.classList.toggle("dark-theme");
  //   themeBtn.querySelector("span:first-child").classList.toggle("active");
  //   themeBtn.querySelector("span:last-child").classList.toggle("active");
  // });

  // — Helpers —
  function getAuthToken() {
    try {
      return JSON.parse(localStorage.getItem("authToken")).token;
    } catch {
      return null;
    }
  }

  // — Sections —
  const overviewSection = document.getElementById("overview");
  const profileSection = document.getElementById("profile-panel");
  const walletSection = document.getElementById("wallet-panel");
  const buySection = document.getElementById("buy-panel");
  const sellSection = document.getElementById("sell-panel");
  const swapSection = document.getElementById("swap-panel");
  const helpSection = document.getElementById("help-panel");

  // — Sidebar links —
  const overviewLink = document.getElementById("overview-link");
  const profileLink = document.getElementById("profile-link");
  const walletLink = document.getElementById("wallet-link");
  const buyLink = document.getElementById("buy-link");
  const sellLink = document.getElementById("sell-link");
  const swapLink = document.getElementById("swap-link");
  const helpLink = document.getElementById("help-link");
  const signOutLink = document.getElementById("signout-link");

  // — Single hideAll() for all panels —
  function hideAll() {
    [
      overviewSection,
      profileSection,
      walletSection,
      buySection,
      sellSection,
      swapSection,
      helpSection,
    ].forEach((sec) => (sec.style.display = "none"));
    [
      overviewLink,
      profileLink,
      walletLink,
      buyLink,
      sellLink,
      swapLink,
      helpLink,
    ].forEach((link) => link.classList.remove("active"));
  }

  window.hideAll = hideAll;

  // — Overview handler —
  if (overviewLink) {
    overviewLink.addEventListener("click", (e) => {
      e.preventDefault();
      showPanel("overview", overviewLink);
      overviewLink.classList.add("active");
      const overviewSection = document.getElementById("overview");
      if (overviewSection) overviewSection.style.display = "block";
    });
  }

  // — Profile handler —
  async function loadAndRenderProfile() {
    const token = getAuthToken();
    if (!token) {
      showToast("Not logged in", "warning");
      return (window.location.href = "/");
    }
    const resp = await fetchWithAuth("/api/user/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      showToast("Failed to load profile", "error");
      return;
    }
    const p = await resp.json();
    const container = document.getElementById("profile-content");
    container.innerHTML = `
      <form id="profileForm" class="profile-form">
        <div class="button-row">
          <button type="button" id="editBtn">Edit</button>
          <button type="button" id="cancelBtn" style="display:none;">Cancel</button>
        </div>
        <label>First Name</label>
        <input name="firstName" value="${p.firstName}" readonly />
        <label>Last Name</label>
        <input name="lastName" value="${p.lastName}" readonly />
        <label>Email</label>
        <input name="email" value="${p.email}" readonly />
        <label>Mobile Number</label>
        <input name="mobileNumber" value="${p.mobileNumber}" readonly />
        <label>Date of Birth</label>
        <input type="date" name="dateOfBirth"
               value="${p.dateOfBirth.split("T")[0]}" readonly />
        <fieldset class="address-fieldset">
          <legend>Address</legend>
          <label>Line 1</label>
          <input name="addressLine1" value="${
            p.address.addressLine1
          }" readonly/>
          <label style="margin-top: 1rem;">Line 2</label>
          <input name="addressLine2" value="${
            p.address.addressLine2 || ""
          }" readonly/>
          <label style="margin-top: 1rem;">Country</label>
          <input name="countryCode" value="${p.address.countryCode}" readonly/>
          <label style="margin-top: 1rem;">City</label>
          <input name="city" value="${p.address.city}" readonly/>
          <label style="margin-top: 1rem;">State</label>
          <input name="state" value="${p.address.state}" readonly/>
          <label style="margin-top: 1rem;">Postal Code</label>
          <input name="postalCode" value="${p.address.postalCode}" readonly/>
        </fieldset>
      </form>
    `;

    // Wire up edit/save/cancel
    const form = document.getElementById("profileForm");
    const editBtn = document.getElementById("editBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const inputs = Array.from(form.elements).filter(
      (el) => el.tagName === "INPUT"
    );

    const originalValues = {};
    inputs.forEach((i) => (originalValues[i.name] = i.value));

    editBtn.addEventListener("click", async () => {
      if (editBtn.textContent === "Edit") {
        inputs
          .filter((i) => !["email", "dateOfBirth"].includes(i.name))
          .forEach((i) => i.removeAttribute("readonly"));
        editBtn.textContent = "Save";
        cancelBtn.style.display = "inline-block";
      } else {
        const data = Object.fromEntries(new FormData(form).entries());
        const res = await fetchWithAuth("/api/user/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return showToast(err.error || res.statusText, "error");
        }
        showToast("Profile updated!", "success");
        loadAndRenderProfile();
      }
    });

    cancelBtn.addEventListener("click", () => {
      inputs.forEach((i) => {
        i.value = originalValues[i.name] || "";
        i.setAttribute("readonly", true);
      });
      cancelBtn.style.display = "none";
      editBtn.textContent = "Edit";
    });
  }

  const profileBtn = document.getElementById("profile-btn");
  if (profileBtn && profileLink) {
    profileBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // hide all other panels and mark profileLink active
      hideAll();
      showPanel("profile-panel", profileLink);
      profileLink.classList.add("active");
      profileSection.style.display = "block";
      // load profile data if necessary:
      loadAndRenderProfile();
    });
  }

  profileLink.addEventListener("click", (e) => {
    e.preventDefault();
    hideAll();
    showPanel("profile-panel", profileLink);
    profileLink.classList.add("active");
    profileSection.style.display = "block";
    loadAndRenderProfile();
  });

  // — Wallet handler —
  walletLink.addEventListener("click", (e) => {
    e.preventDefault();
    showPanel("wallet-panel", walletLink);
    hideAll();
    walletLink.classList.add("active");
    walletSection.style.display = "block";
    if (!window.walletData?.address) {
      showToast("Please connect your wallet first", "warning");
    }
    renderWalletPanel();
  });

  // — Buy handler —
  buyLink.addEventListener("click", (e) => {
    e.preventDefault();
    showPanel("buy-panel", buyLink);
    hideAll();
    buyLink.classList.add("active");
    buySection.style.display = "block";
    if (typeof window.initBuyCrypto === "function") {
      window.initBuyCrypto();
    }
  });

  // — Sell handler —
  sellLink.addEventListener("click", (e) => {
    e.preventDefault();
    showPanel("sell-panel", sellLink);
    hideAll();
    sellLink.classList.add("active");
    sellSection.style.display = "block";
    if (typeof window.initSellCrypto === "function") {
      window.initSellCrypto();
    }
  });

  // — Swap handler —
  swapLink.addEventListener("click", (e) => {
    e.preventDefault();
    showPanel("swap-panel", swapLink);
    hideAll();
    swapLink.classList.add("active");
    swapSection.style.display = "block";

    if (window.walletData?.address) {
      enableQuoteBtn();
    } else {
      disableQuoteBtn();
    }

    if (typeof window.initSwapCrypto === "function") {
      window.initSwapCrypto();
    }
  });

  // — Help Center handler —
  helpLink.addEventListener("click", (e) => {
    e.preventDefault();
    showPanel("help-panel", helpLink);
    hideAll();
    helpLink.classList.add("active");
    helpSection.style.display = "block";
  });

  signOutLink.addEventListener("click", (e) => {
    e.preventDefault();

    localStorage.removeItem("authToken");
    localStorage.removeItem("walletData");
    if (typeof window.disconnectWallet === "function") {
      window.disconnectWallet();
    }
    window.location.href = "/";
  });

  // // Kick off on Overview
  const txLink = document.getElementById("tx-link");
  const last = localStorage.getItem("activePanel") || "overview";
  const linkMap = {
    overview: overviewLink,
    "profile-panel": profileLink,
    "wallet-panel": walletLink,
    "buy-panel": buyLink,
    "sell-panel": sellLink,
    "swap-panel": swapLink,
    "help-panel": helpLink,
    "tx-panel": txLink,
  };
  const link = linkMap[last] || overviewLink;
  showPanel(last, link);
  // load data if needed:
  if (last === "profile-panel") loadAndRenderProfile();
  if (last === "wallet-panel") renderWalletPanel();
  if (last === "buy-panel") window.initBuyCrypto?.();
  if (last === "sell-panel") window.initSellCrypto?.();
  if (last === "swap-panel") window.initSwapCrypto?.();
  if (last === "tx-panel") window.loadAndRenderTxs?.();
});
