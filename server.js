require("dotenv").config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require("path");
const app = express();
const PORT = 3000;

app.use(cors());

app.use(express.static(path.join(__dirname)));

app.get("/favicon.svg", (req, res) => {
  res.sendFile(path.join(__dirname, "favicon.svg"));
});

// Serve index.html for the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Endpoint to fetch crypto prices using CoinGecko API
app.get('/api/tickers', async (req, res) => {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        per_page: 50,
        page: 1  
      }
    });
    
    const data = response.data;
    
    // Example of how to structure the response
    const tickers = data.map(coin => ({
      pair: coin.id.toUpperCase(),  // e.g., bitcoin, ethereum
      last: coin.current_price,     // Last price
      high: coin.high_24h,          // 24h high
      low: coin.low_24h,            // 24h low
      volume: coin.total_volume,    // 24h volume
    }));

    res.json({ tickers });
  } catch (error) {
    console.error("Error fetching prices:", error.message);
    res.status(500).json({ error: 'Error fetching prices' });
  }
});

// =============================
// 0x Swap Quote Proxy Route
// =============================
app.get('/api/quote', async (req, res) => {

  try {
    const {
      sellToken,
      buyToken,
      sellAmount,
      takerAddress
    } = req.query;

    // Validate required parameters
    if (!sellToken || !buyToken || !sellAmount || !takerAddress) {
      return res.status(400).json({ error: 'Missing query parameters' });
    }

    // Build 0x API query params
    const params = new URLSearchParams({
      chainId:         '1', 
      sellToken,
      buyToken,
      sellAmount,
      taker:            takerAddress,
      swapFeeRecipient: takerAddress,    // or your own fee address
      swapFeeBps:       '20',            // 0.20% fee
      swapFeeToken:     sellToken,
    });

    // Fetch quote from 0x Swap API
    const url = `https://api.0x.org/swap/permit2/quote?${params}`;
    const headers = {
     '0x-api-key': process.env.ZEROEX_API_KEY,
     '0x-version':  'v2'
    };
    const quoteResponse = await axios.get(url, { headers });
    // Forward the 0x API response to the client
    res.status(quoteResponse.status).json(quoteResponse.data);
  } catch (error) {
    console.error('Error fetching 0x quote:', error.response ? error.response.data : error.message);
    const status = error.response ? error.response.status : 500;
    const message = error.response && error.response.data ? error.response.data : { error: error.message };
    res.status(status).json(message);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
