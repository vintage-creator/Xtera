"use strict";

/**
 * Attach an event listener to one element or a collection of elements.
 *
 * @param {Element|NodeList|Array<Element>} elems
 * @param {string} type
 * @param {Function} callback
 */

function addEventOnElem(elems, type, callback) {
  // NodeList or Array → loop
  if (NodeList.prototype.isPrototypeOf(elems) || Array.isArray(elems)) {
    elems.forEach((el) => {
      if (el && typeof el.addEventListener === "function") {
        el.addEventListener(type, callback);
      }
    });
  }
  // Single element → attach directly
  else if (elems && typeof elems.addEventListener === "function") {
    elems.addEventListener(type, callback);
  } else {
    console.warn("addEventOnElem: invalid element(s) passed", elems);
  }
}

// All DOM queries and event hooks in one place
document.addEventListener("DOMContentLoaded", () => {
  let showAll = false;
  const PAGE_SIZE = 20;
  const seeAllBtn = document.querySelector(".btn-link");

  function updateSeeAllText() {
    seeAllBtn.textContent = showAll ? "Show Top 20" : "See All Coins";
  }

  addEventOnElem(seeAllBtn, "click", (e) => {
    e.preventDefault();
    showAll = !showAll;
    updateSeeAllText();
    loadTickers();
  });

  //
  // ———————————————— TICKER ROLLING PRICES ————————————————
  //
  const tickerEl = document.getElementById("ticker");
  if (!tickerEl) {
    console.error("Ticker element not found!");
  } else {
    async function fetchPrices() {
      try {
        const resp = await fetch("/api/tickers");
        const data = await resp.json();
        if (data && data.tickers) {
          const tickers = data.tickers.slice(0, 15);
          const formatted = tickers.map(
            (t) =>
              `${t.pair}: ${parseFloat(t.last).toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}`
          );
          tickerEl.innerHTML = formatted.join(
            "&nbsp;&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;&nbsp;"
          );
        } else {
          throw new Error("Invalid data format");
        }
      } catch {
        tickerEl.innerHTML = "Failed to load prices...";
      }
    }
    fetchPrices();
    setInterval(fetchPrices, 60000);
  }

  //
  // ———————————————— MARKET TABLE ————————————————
  //
  async function loadTickers() {
    try {
      const resp = await fetch(`/api/tickers?t=${Date.now()}`);
      const { tickers } = await resp.json();
      const tbody = document.querySelector(".market-table .table-body");
      if (!tbody) return;
      tbody.innerHTML = "";
  
      const coinsToShow = showAll
        ? tickers.slice(0, 50)
        : tickers.slice(0, PAGE_SIZE);
  
      coinsToShow.forEach((coin, i) => {
        const canvasId = `sparkline-${i}`;
        const tr = document.createElement("tr");
        tr.className = "table-row";
        tr.innerHTML = `
          <td class="table-data">
            <button class="add-to-fav" aria-label="Add to favourite" data-add-to-fav>
              <ion-icon name="star-outline" class="icon-outline"></ion-icon>
              <ion-icon name="star" class="icon-fill"></ion-icon>
            </button>
          </td>
          <th class="table-data rank" scope="row">${i + 1}</th>
          <td class="table-data">
            <div class="wrapper">
              <img src="${coin.image}" width="20" height="20" alt="${coin.name} logo" class="img" />
              <h3>
                <a href="#" class="coin-name">
                  ${coin.name} <span class="span">${coin.symbol}</span>
                </a>
              </h3>
            </div>
          </td>
          <td class="table-data last-price">$${coin.last.toLocaleString()}</td>
          <td class="table-data last-update ${coin.change24h >= 0 ? "green" : "red"}">
            ${coin.change24h.toFixed(2)}%
          </td>
          <td class="table-data market-cap">$${coin.marketCap.toLocaleString()}</td>
          <td class="table-data">
            <canvas id="${canvasId}" width="100" height="40"></canvas>
          </td>
        `;
        tbody.appendChild(tr);
  
        const ctx = document.getElementById(canvasId).getContext("2d");
        new Chart(ctx, {
          type: "line",
          data: {
            labels: coin.sparkline7d.map((_, index) => index),
            datasets: [{
              data: coin.sparkline7d,
              borderColor: coin.change24h >= 0 ? "#4CAF50" : "#F44336",
              borderWidth: 1,
              tension: 0.4,
              fill: false,
              pointRadius: 0
            }]
          },
          options: {
            responsive: false,
            plugins: {
              legend: { display: false },
              tooltip: { enabled: false }
            },
            scales: {
              x: { display: false },
              y: { display: false }
            }
          }
        });
      });
  
      addEventOnElem(
        document.querySelectorAll("[data-add-to-fav]"),
        "click",
        function () {
          this.classList.toggle("active");
        }
      );
    } catch (err) {
      console.error("Error in loadTickers:", err);
    }
  }
  loadTickers();
  setInterval(loadTickers, 60000);

  //                                               //
  // ———————————————— TREND CARDS ————————————————//
  //                                             //
  async function loadTrendCards() {
    try {
      // 1) fetch tickers
      const resp = await fetch("/api/tickers?t=" + Date.now());
      const { tickers } = await resp.json();

      // 2) pick the first 4 (you could sort by volume or change if you prefer)
      const topFour = tickers.slice(0, 4);

      // 3) find the <ul class="tab-content"> inside the trend section
      const container = document.getElementById('tab-content');
      if(!container) return;
      container.innerHTML = "";

      // 4) for each coin, build the <li>
      topFour.forEach((coin, idx) => {
        // decide badge color
        const change = coin.change24h;
        const badgeClass = change >= 0 ? "green" : "red";
        const badgeText = (change >= 0 ? "+" : "") + change.toFixed(2) + "%";

        // build the LI
        const li = document.createElement("li");
        li.innerHTML = `
        <div class="trend-card ${idx === 1 ? "active" : ""}">
          <div class="card-title-wrapper">
            <img src="${coin.image}" width="24" height="24" alt="${
          coin.name
        } logo"/>
            <a href="#" class="card-title">
              ${coin.name} <span class="span">${coin.symbol}/USD</span>
            </a>
          </div>
          <data class="card-value" value="${coin.last}">
            USD ${coin.last.toLocaleString()}
          </data>
          <div class="card-analytics">
            <data class="current-price" value="${coin.last}">
              ${coin.last.toLocaleString()}
            </data>
            <div class="badge ${badgeClass}">${badgeText}</div>
          </div>
        </div>
      `;
        container.appendChild(li);
      });
    } catch (err) {
      console.error("Error loading trend cards:", err);
    }
  }

  const trendSection = document.querySelector(".section.trend");
  if (trendSection) {
    const container = trendSection.querySelector(".tab-content");
    loadTrendCards(container);
    setInterval(() => loadTrendCards(container), 60000);
  }

  //
  // ———————————————— NAVBAR TOGGLE ————————————————
  //
  const navbar = document.querySelector("[data-navbar]");
  const navToggler = document.querySelector("[data-nav-toggler]");
  const navbarLinks = document.querySelectorAll("[data-nav-link]");

  function toggleNavbar() {
    navbar.classList.toggle("active");
    navToggler.classList.toggle("active");
    document.body.classList.toggle("active");
  }
  function closeNavbar() {
    navbar.classList.remove("active");
    navToggler.classList.remove("active");
    document.body.classList.remove("active");
  }

  addEventOnElem(navToggler, "click", toggleNavbar);
  addEventOnElem(navbarLinks, "click", closeNavbar);

  //
  // ———————————————— HEADER SHADOW ON SCROLL ————————————————
  //
  const header = document.querySelector("[data-header]");
  function activeHeader() {
    if (window.scrollY > 300) header.classList.add("active");
    else header.classList.remove("active");
  }
  addEventOnElem(window, "scroll", activeHeader);

  //
  // ———————————————— SECTION SCROLL REVEAL ————————————————
  //
  const sections = document.querySelectorAll("[data-section]");
  function scrollReveal() {
    sections.forEach((sec) => {
      if (sec.getBoundingClientRect().top < window.innerHeight / 1.5)
        sec.classList.add("active");
      else sec.classList.remove("active");
    });
  }
  scrollReveal();
  addEventOnElem(window, "scroll", scrollReveal);
  updateSeeAllText();
});

