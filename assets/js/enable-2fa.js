// enable-2fa.js
import { fetchWithAuth } from "./auth.js";
import { showToast }    from "./util.js";

document.addEventListener("DOMContentLoaded", async () => {
  const imgEl = document.getElementById("qrImage");
  if (!imgEl) return;  // only run on the 2FA page

  try {
    const setupResp = await fetchWithAuth("/api/2fa/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!setupResp.ok) throw new Error(`Status ${setupResp.status}`);
    const { qr, secret } = await setupResp.json();

    // 1) Show the QR
    imgEl.src = qr;

    // 2) Unhide & fill the secret field
    const secretContainer = document.getElementById("secret-container");
    const secretInput     = document.getElementById("otp-secret");
    const copyBtn         = document.getElementById("copy-secret-btn");

    secretInput.value = secret;
    secretContainer.style.display = "block";

    // 3) Wire up the copy button
    copyBtn.addEventListener("click", () => {
      navigator.clipboard
        .writeText(secret)
        .then(() => showToast("Secret copied!", "success"))
        .catch(() => showToast("Copy failed", "error"));
    });
  } catch (err) {
    console.error("2FA setup error:", err);
    showToast("Failed to start 2FA setup", "error");
  }
});
