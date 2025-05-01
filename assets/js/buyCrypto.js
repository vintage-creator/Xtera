import { showToast } from "./util.js";

document.addEventListener("DOMContentLoaded", () => {
  // Select elements
  const buyCryptoLink = document.getElementById("buyCryptoLink");
  const modal = document.getElementById("buyCryptoModal");
  const closeModalButton = document.querySelector(".close-icon");
  const buyButton = document.getElementById("buyButton");
  const fiatCurrencySelect = document.getElementById("fiatCurrency");
  const buyCryptoForm = document.getElementById("buyCryptoForm");
  const markupFeeDisplay = document.getElementById("markupFeeDisplay");
  const fiatAmountInput = document.getElementById("fiatAmount");

  // Helper function to enable the "Buy Now" button
  const enableBuyButton = () => {
    buyButton.disabled = false;
    buyButton.style.opacity = 1;
    buyButton.style.cursor = "pointer";
  };

  // Helper function to open modal
  const openModal = () => {
    modal.style.display = "block";
    if (window.walletData?.address) {
      enableBuyButton();
      checkUserBalanceAndSuggestSwap();
    }
  };

  // Helper function to close modal
  const closeModal = () => (modal.style.display = "none");

  buyCryptoLink?.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
  });

  closeModalButton?.addEventListener("click", closeModal);

  // Close modal if the user clicks outside of the modal box
  window.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Currency symbol map
  const currencySymbols = {
    eur: "€", // Euro
    gbp: "£", // British Pound
    inr: "₹", // Indian Rupee
    usd: "$", // US Dollar
    chf: "CHF", // Swiss Franc
    sek: "kr", // Swedish Krona
    pln: "zł", // Polish Zloty
    nok: "kr", // Norwegian Krone
    dkk: "kr", // Danish Krone
    nzd: "$", // New Zealand Dollar
    mxn: "$", // Mexican Peso
    cad: "$", // Canadian Dollar
    aud: "$", // Australian Dollar
    ars: "$", // Argentine Peso
    brl: "R$", // Brazilian Real
    clp: "$", // Chilean Peso
    crc: "₡", // Costa Rican Colon
    dop: "RD$", // Dominican Peso
    idr: "Rp", // Indonesian Rupiah
    ils: "₪", // Israeli Shekel
    jpy: "¥", // Japanese Yen
    krw: "₩", // South Korean Won
    myr: "RM", // Malaysian Ringgit
    pyg: "₲", // Paraguayan Guarani
    pen: "S/.", // Peruvian Sol
    php: "₱", // Philippine Peso
    sgd: "$", // Singapore Dollar
    fjd: "$", // Fiji Dollar
    huf: "Ft", // Forint
    kes: "KSh", // Kenyan Shilling
    mdl: "L", // Moldovan Leu
    bmd: "$", // Bermudian Dollar
    fkp: "£", // Falkland Islands Pound
    czk: "Kč", // Czech Koruna
    isk: "kr", // Iceland Krona
    ron: "lei", // Romanian Leu
    aoa: "Kz", // Kwanza
    bzd: "$", // Belize Dollar
    bnd: "$", // Brunei Dollar
    kmf: "CF", // Comoro Franc
    djf: "Fdj", // Djibouti Franc
    xcd: "$", // East Caribbean Dollar
    gel: "₾", // Lari
    gtq: "Q", // Quetzal
    hnl: "L", // Lempira
    hkd: "$", // Hong Kong Dollar
    kzt: "₸", // Tenge
    kgs: "лв", // Som
    mga: "Ar", // Malagasy Ariary
    mwk: "MK", // Kwacha
    mru: "MRU", // Ouguiya
    omr: "ر.ع.", // Rial Omani
    pgk: "K", // Kina
    rwf: "FRw", // Rwanda Franc
    stn: "Db", // Dobra
    scr: "₨", // Seychelles Rupee
    sbd: "$", // Solomon Islands Dollar
    srd: "$", // Surinam Dollar
    szl: "L", // Lilangeni
    tjs: "SM", // Somoni
    top: "T$", // Pa'anga
    tmt: "m", // Turkmenistan New Manat
    uyu: "$", // Peso Uruguayo
    cop: "$", // Colombian Peso
    twd: "NT$", // Taiwanese Dollar
    ghs: "₵", // Ghanaian Cedi
    khr: "៛", // Cambodian Riel
    rsd: "дин", // Serbian Dinar
    bhd: "د.ب", // Bahraini Dinar
    mkd: "ден", // Macedonian Denar
    kwd: "د.ك", // Kuwaiti Dinar
    amd: "դր.", // Armenian Dram
    ang: "ƒ", // Netherlands Antilles Guilder
    azn: "₼", // Azerbaijani Manat
    bsd: "$", // Bahamian Dollar
    kyd: "$", // Cayman Islands Dollar
    cve: "$", // Cape Verdean Escudo
    bam: "KM", // BH Convertible Mark
    jod: "د.ا", // Jordanian Dinar
    ttd: "$", // Trinidad & Tobago Dollar
    pab: "B/.", // Panamanian Balboa
    dzd: "د.ج", // Algerian Dinar
  };

  let symbol;
  symbol = currencySymbols[fiatCurrencySelect.value];

  // Handle fiat currency selection
  fiatCurrencySelect.addEventListener("change", (event) => {
    const selectedCurrency = event.target.value;
    symbol = currencySymbols[selectedCurrency];
    updateMarkupFee();
  });

  // Check if user has crypto balance and show a suggestion
  const checkUserBalanceAndSuggestSwap = () => {
    if (window.walletData?.balance > 0) {
      showToast(
        "You already have crypto in your wallet. Consider swapping instead.",
        "info"
      );
    }
  };

  // Handle Fiat Amount Input Change (update markup fee)
  const updateMarkupFee = () => {
    const fiat = parseFloat(fiatAmountInput.value);
    if (fiat > 0) {
      const serviceFeePercent = 0.02; // 2%
      const serviceFee = fiat * serviceFeePercent;
      markupFeeDisplay.innerText = `Service Fee (2%): ${symbol}${serviceFee.toFixed(
        2
      )}`;
    } else {
      markupFeeDisplay.innerText = "";
    }
  };

  // Handle Buy Crypto Form Submit
  const handleFormSubmit = (e) => {
    e.preventDefault();
    closeModal();
  };

  // Enable "Buy Now" button if wallet is connected
  if (window.walletData?.address) {
    enableBuyButton();
    checkUserBalanceAndSuggestSwap();
  }

  // Attach event listener for fiat amount input change
  fiatAmountInput.addEventListener("input", updateMarkupFee);

  // Attach form submit handler
  buyCryptoForm.addEventListener("submit", handleFormSubmit);
});
