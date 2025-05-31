// auth.js
import { showToast } from "./util.js";
import { disconnectWallet, openWalletModal } from "./wallet.js";

// ————————————————————————————————————————————————————————————
// 0) Read & expire the auth token
export function getStoredAuthTokenInfo() {
  const raw = localStorage.getItem("authToken");
  if (!raw) return null;
  try {
    return JSON.parse(raw); // { token, expiresAt }
  } catch {
    localStorage.clear();
    return null;
  }
}

export function isAuthTokenExpired() {
  const info = getStoredAuthTokenInfo();
  if (!info) return true;
  return Date.now() > info.expiresAt;
}

export function getValidAuthToken() {
  const info = getStoredAuthTokenInfo();
  if (!info || Date.now() > info.expiresAt) return null;
  return info.token;
}

// ————————————————————————————————————————————————————————————
// 1) Silent re-login: fetch new nonce, sign, swap for fresh JWT
async function silentReLogin() {
  try {
    const address = window.walletData?.address;
    if (!address) return false;

    // 1a) GET a fresh nonce
    const nonceRes = await fetch(`/api/nonce/${address}`);
    if (!nonceRes.ok) throw new Error("Failed to fetch nonce");
    const { message: nonce } = await nonceRes.json();

    // 1b) Ask the connected wallet to sign it
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const signature = await signer.signMessage(nonce);

    // 1c) Exchange signature for a new JWT
    const loginRes = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        signature,
        personId: localStorage.getItem("personId"),
      }),
    });
    if (!loginRes.ok) throw new Error("Login refresh failed");

    const { token } = await loginRes.json();

    // 1d) Store it with a full 1 hour TTL
    const expiresAt = Date.now() + 60 * 60 * 1000;
    localStorage.setItem("authToken", JSON.stringify({ token, expiresAt }));
    return true;
  } catch (err) {
    console.error("Silent re-login error:", err);
    return false;
  }
}

// ————————————————————————————————————————————————————————————
// 2) fetch wrapper that retries once on 401
export async function fetchWithAuth(input, init = {}) {
  // 1) If our JWT is already expired (by wall-clock), try silent re-login
  if (isAuthTokenExpired()) {
    const didRefresh = await silentReLogin();
    if (!didRefresh) {
      // Cannot refresh → force-logout
      localStorage.clear();
      window.location.href = "/";
      return new Response(null, { status: 401 });
    }
  }

  // 2) Grab (fresh) token
  const rawToken = getValidAuthToken();
  const headers = new Headers(init.headers || {});
  if (rawToken) {
    headers.set("Authorization", `Bearer ${rawToken}`);
  }

  // 3) Fire the request
  let res = await fetch(input, { ...init, headers });

  // 4) If we get a 401, decide whether to auto-refresh or let it bubble up
  if (res.status === 401) {
    // If this is *the verify-2fa endpoint*, do NOT auto-logout. 
    // Instead, just return the 401 to the caller so they can show a toast.
    if (input.endsWith("/api/2fa/verify")) {
      return res; 
    }

    // Otherwise, try silentReLogin one more time:
    const ok = await silentReLogin();
    if (!ok) {
      // Still 401 after attempting a refresh → real logout
      localStorage.clear();
      window.location.href = "/";
      return res;
    }
    // Re-attach new token & retry
    const fresh = getValidAuthToken();
    const retryHeaders = new Headers(init.headers || {});
    if (fresh) {
      retryHeaders.set("Authorization", `Bearer ${fresh}`);
    }
    res = await fetch(input, { ...init, headers: retryHeaders });

    // If it is still a 401 (and not verify-2fa), then logout:
    if (res.status === 401 && !input.endsWith("/api/2fa/verify")) {
      localStorage.clear();
      window.location.href = "/";
    }
  }

  return res;
}


// ————————————————————————————————————————————————————————————
// 3) DOM logic
document.addEventListener("DOMContentLoaded", () => {
  // Do NOT capture token once here for later use; 
  // instead, always call getValidAuthToken() or fetchWithAuth() when needed.
  const walletBtn = document.getElementById("wallet-btn");
  if (!walletBtn) return;

  // Style the button as Sign In vs Dashboard
  if (getValidAuthToken()) {
    walletBtn.textContent = "Dashboard";
    walletBtn.classList.replace("btn-outline", "btn-primary");
    walletBtn.dataset.view = "dashboard";
  } else {
    walletBtn.textContent = "Sign In";
    walletBtn.classList.replace("btn-primary", "btn-outline");
    walletBtn.dataset.view = "signin";
  }

  walletBtn.addEventListener("click", async () => {
    try {
      // ① Use fetchWithAuth for /api/status so we can auto-refresh if needed:
      const resp = await fetchWithAuth("/api/status", {
        headers: { "Content-Type": "application/json" },
      });

      if (resp.ok) {
        if (walletBtn.dataset.view === "dashboard") {
          return (window.location.href = "/dashboard.html");
        } else {
          return openWalletModal();
        }
      }

      // 400, 401, 404 → new user flow
      if ([400, 401, 404].includes(resp.status)) {
        // If they already have an account (401,404) we send to create-account,
        // but for 400 (no token & no address) we just open modal
        if (resp.status === 400) {
          return openWalletModal();
        } else {
          return (window.location.href = "/create-account.html");
        }
      }

      // 403 → not verified
      if (resp.status === 403) {
        showToast("Please verify your e-mail before continuing.", "warning");
        return;
      }

      throw new Error(`Unexpected status: ${resp.status}`);
    } catch (err) {
      console.error("Status check failed", err);
      // clear any stale wallet data & UI
      disconnectWallet();
      showToast("Network error—please try again.", "error");
    }
  });

  // — Signup form handler —
  const signupForm = document.getElementById("signupForm");
  const nextBtn    = document.getElementById("nextBtn");
  const prevBtn    = document.getElementById("prevBtn");

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(signupForm);
      const data = Object.fromEntries(formData.entries());

      try {
        const resp = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const result = await resp.json().catch(() => ({}));

        if (resp.status === 201) {
          if (result.personId) {
            localStorage.setItem("personId", result.personId);
          }
          showToast(
            "Registered! A confirmation link has been sent to your e-mail.",
            "info"
          );
          signupForm
            .querySelectorAll("input, select, textarea")
            .forEach((el) => {
              if (el.type === "checkbox" || el.type === "radio") {
                el.checked = false;
              } else {
                el.value = "";
              }
              el.classList.remove("touched");
            });
          Array.from(signupForm.elements).forEach((el) => (el.disabled = true));
          const notice = document.createElement("p");
          notice.textContent =
            "✅ Please check your inbox and click the confirmation link.";
          notice.style.marginTop = "1.5rem";
          signupForm.appendChild(notice);
        } else {
          nextBtn.disabled = false;
          prevBtn.disabled = false;
          nextBtn.textContent = "Submit";
          showToast(result.message || "Registration failed", "error");
        }
      } catch (err) {
        console.error("Signup error:", err);
        nextBtn.disabled = false;
        prevBtn.disabled = false;
        nextBtn.textContent = "Submit";
        showToast("Network error—please try again.", "error");
      }
    });
  }

  // 2) Only run 2FA setup/verify on enable-2fa.html
  if (window.location.pathname === "/enable-2fa.html") {
    // 2a) Ensure logged in or redirect (with toast delay)
    if (!getValidAuthToken()) {
      showToast("Not logged in (or session expired)", "warning");
      return setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    }

    // 2b) Fetch and display the QR code **via fetchWithAuth**:
    const imgEl = document.getElementById("qrImage");
    if (imgEl) {
      (async () => {
        try {
          const setupResp = await fetchWithAuth("/api/2fa/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // fetchWithAuth will add the Authorization header automatically
          });
          if (!setupResp.ok) throw new Error(`Status ${setupResp.status}`);
          const { qr } = await setupResp.json();
          imgEl.src = qr;
        } catch (err) {
          console.error("2FA setup error:", err);
          showToast("Failed to start 2FA setup", "error");
        }
      })();
    } else {
      console.error("Cannot find #qrImage");
    }

    // 2c) Wire up the Verify button **also via fetchWithAuth**:
    const verifyBtn = document.getElementById("verify-2fa-btn");
    const inputEl   = document.getElementById("2fa-code");
    const statusEl  = document.getElementById("statusMsg");

    if (verifyBtn && inputEl && statusEl) {
      verifyBtn.addEventListener("click", async () => {
        const code = inputEl.value.trim();
        if (!/^\d{6}$/.test(code)) {
          showToast("Enter a valid 6-digit code", "warning");
          return;
        }
        console.log("⏱ 2FA verify will send JWT:", getValidAuthToken());
        try {
          const verResp = await fetchWithAuth("/api/2fa/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: code }),
          });
          if (!verResp.ok) {
            const err = await verResp.json().catch(() => ({}));
            throw new Error(err.error || verResp.statusText);
          }
          showToast("2FA enabled! Redirecting…", "success");

          // Flip the wallet button if present
          if (walletBtn) {
            walletBtn.textContent = "Dashboard";
            walletBtn.classList.replace("btn-outline", "btn-primary");
          }
          statusEl.textContent = "✅ Two-factor authentication enabled.";
          setTimeout(() => (window.location.href = "/"), 1500);
        } catch (err) {
          console.error("2FA verification error:", err);
          showToast(err.message || "Invalid code", "error");
          statusEl.textContent = "❌ " + (err.message || "Invalid 2FA code");
        }
      });
    }
  }
});
