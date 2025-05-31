async function fetchCryptoNews() {
  const ul = document.getElementById("newsList");
  ul.innerHTML = "<li>Loading latest news…</li>";

  try {
    const res = await fetch("/api/news"); 
    if (!res.ok) throw new Error(res.statusText);
    const { items } = await res.json();

    ul.innerHTML = ""; 
    items.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `
          <a href="${item.link}" target="_blank" rel="noopener">
            ${item.title}<br>
            <small style="color:#56555e;font-weight:600;">${new Date(item.pubDate).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            </small>
          </a>
        `;
      ul.appendChild(li);
    });
  } catch (err) {
    console.error("News fetch error", err);
    ul.innerHTML = "<li>Failed to load news.</li>";
  }
}

// ——— Top Market Movers ———
async function fetchMarketMovers() {
    const ul = document.getElementById("moversList");
    ul.innerHTML = "<li>Loading movers…</li>";
  
    try {
      const res = await fetch("/api/tickers");
      if (!res.ok) throw new Error(res.statusText);
      const { tickers } = await res.json();
  
      // sort full list descending by 24h%
      const sortedDesc = [...tickers].sort((a, b) => b.change24h - a.change24h);
      const topGainers = sortedDesc.slice(0, 5);
  
      // sort ascending for losers
      const sortedAsc  = [...tickers].sort((a, b) => a.change24h - b.change24h);
      const topLosers  = sortedAsc.slice(0, 5);
  
      ul.innerHTML = "";
  
      // section header
      const headerG = document.createElement("li");
      headerG.innerHTML = `<strong>🔼 Top 5 Gainers</strong>`;
      ul.appendChild(headerG);
  
      topGainers.forEach((coin) => {
        const percent = coin.change24h.toFixed(2);
        const cls     = coin.change24h >= 0 ? "percent-gain" : "percent-loss";
        const desc    = getDescriptor(coin.change24h);
  
        const li = document.createElement("li");
        li.innerHTML = `
        <a href="https://www.coingecko.com/en/coins/${coin.id}"
            target="_blank" rel="noopener">
            <div class="mover-row">
            <span class="coin-symbol">${coin.symbol}</span>
            <span class="percent ${cls}">${percent}%</span>
            </div>
            <div class="description">${desc}</div>
        </a>
        `;

        ul.appendChild(li);
      });
  
      const headerL = document.createElement("li");
      headerL.innerHTML = `
        <strong style="display:block; margin-top:1rem;">
            🔻 Top 5 Losers
        </strong>
        `;

      ul.appendChild(headerL);
  
      topLosers.forEach((coin) => {
        const percent = coin.change24h.toFixed(2);
        const cls     = coin.change24h < 0 ? "percent-loss" : "percent-gain";
        const desc    = getDescriptor(coin.change24h);
      
        const li = document.createElement("li");
        li.innerHTML = `
          <a href="https://www.coingecko.com/en/coins/${coin.id}"
             target="_blank" rel="noopener">
            <div class="mover-row">
              <span class="coin-symbol">${coin.symbol}</span>
              <span class="percent ${cls}">${percent}%</span>
            </div>
            <div class="description">${desc}</div>
          </a>
        `;
        ul.appendChild(li);
      });
    } catch (err) {
      console.error("Movers fetch error", err);
      ul.innerHTML = "<li>Failed to load movers.</li>";
    }
  }
  
  // helper to categorize the move
  function getDescriptor(change) {
    const abs = Math.abs(change);
    if (abs >= 10) return change > 0 ? "🚀 Explosive gain" : "📉 Heavy drop";
    if (abs >= 5)  return change > 0 ? "📈 Strong move up" : "🔻 Notable dip";
    if (abs >= 1)  return change > 0 ? "↗️ Mild uptick" : "↘️ Mild downturn";
    return change > 0 ? "🐢 Small uptick" : "🐌 Small down";
  }
  
  

document.addEventListener("DOMContentLoaded", () => {
  fetchCryptoNews();
  fetchMarketMovers();

  document
    .getElementById("refreshNews")
    .addEventListener("click", fetchCryptoNews);
  document
    .getElementById("refreshMovers")
    .addEventListener("click", fetchMarketMovers);
});
