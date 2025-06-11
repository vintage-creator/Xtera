require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const connectDB = require("./config/database");
const xml2js  = require("xml2js"); 
const path = require("path");
const app = express();
const PORT = 3000;

async function startServer() {
  try {
    await connectDB();

    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname)));

    app.use("/api", require("./routes/2fa"));
    app.use('/api/swap', require('./routes/swap'));
    app.use("/api/user", require("./routes/user"));
    app.use("/api", require("./routes/solService"));
    app.use("/api/wallet", require("./routes/wallet"));

    let tickersCache = null;
    let tickersCacheTime = 0;

    const COINGECKO_CACHE_TTL = 60 * 1000;

    app.get("/favicon.svg", (req, res) => {
      res.sendFile(path.join(__dirname, "favicon.svg"));
    });

    // Serve index.html for the root route
    app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "index.html"));
    });

    // Endpoint to fetch crypto prices using CoinGecko API
    app.get("/api/tickers", async (req, res) => {
      try {
        const now = Date.now();
        if (tickersCache && now - tickersCacheTime < COINGECKO_CACHE_TTL) {
          return res.json({ tickers: tickersCache });
        }

        const response = await axios.get(
          "https://api.coingecko.com/api/v3/coins/markets",
          {
            params: {
              vs_currency: "usd",
              per_page: 50,
              page: 1,
              sparkline: true,
            },
          }
        );

        const data = response.data;

        const tickers = data.map((coin) => ({
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol.toUpperCase(),
          image: coin.image,
          change24h: coin.price_change_percentage_24h,
          marketCap: coin.market_cap,
          pair: `${coin.symbol.toUpperCase()}/USD`,
          last: coin.current_price,
          high: coin.high_24h,
          low: coin.low_24h,
          volume: coin.total_volume,
          sparkline7d: coin.sparkline_in_7d.price,
        }));

        tickersCache = tickers;
        tickersCacheTime = now;
        res.json({ tickers });
      } catch (error) {
        console.error("Error fetching prices:", error.message);
        res.status(502).json({ error: "Upstream API error" });
      }
    });

    // =============================
    // 0x Swap Quote Proxy Route
    // =============================
    app.get("/api/quote", async (req, res) => {
      try {
        const { sellToken, buyToken, sellAmount, takerAddress } = req.query;

        // Validate required parameters
        if (!sellToken || !buyToken || !sellAmount || !takerAddress) {
          return res.status(400).json({ error: "Missing query parameters" });
        }

        // Build 0x API query params
        const params = new URLSearchParams({
          chainId: "1",
          sellToken,
          buyToken,
          sellAmount,
          taker: takerAddress,
          swapFeeRecipient: takerAddress, // or your own fee address
          swapFeeBps: "20", // 0.20% fee
          swapFeeToken: sellToken,
        });

        // Fetch quote from 0x Swap API
        const url = `https://api.0x.org/swap/permit2/quote?${params}`;
        const headers = {
          "0x-api-key": process.env.ZEROEX_API_KEY,
          "0x-version": "v2",
        };
        const quoteResponse = await axios.get(url, { headers });
        // Forward the 0x API response to the client
        res.status(quoteResponse.status).json(quoteResponse.data);
      } catch (error) {
        console.error(
          "Error fetching 0x quote:",
          error.response ? error.response.data : error.message
        );
        const status = error.response ? error.response.status : 500;
        const message =
          error.response && error.response.data
            ? error.response.data
            : { error: error.message };
        res.status(status).json(message);
      }
    });

    app.get("/api/news", async (req, res) => {
      try {
        // 1) fetch the RSS XML (with outputType=xml)
        const rssUrl = "https://www.coindesk.com/arc/outboundfeeds/rss?outputType=xml";
        const xmlResp = await axios.get(rssUrl);
        const xmlData = xmlResp.data;

        // 2) parse with xml2js
        const parser = new xml2js.Parser({ explicitArray: false });
        const parsed = await parser.parseStringPromise(xmlData);

        // 3) normalize item(s) into an array
        let itemsRaw = parsed.rss.channel.item || [];
        if (!Array.isArray(itemsRaw)) {
          itemsRaw = [itemsRaw];
        }

        // 4) pick top 5 and map fields
        const items = itemsRaw.slice(0, 10).map(it => ({
          title:   it.title,
          link:    it.link,
          pubDate: it.pubDate
        }));

        res.json({ items });
      } catch (err) {
        console.error("Error in /api/news:", err.message);
        res.status(502).json({ error: "Failed to fetch or parse news feed" });
      }
    });
    

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
