'use strict';


// Fetch and Update Ticker Content
const tickerEl = document.getElementById('ticker');

if (!tickerEl) {
  console.error('Ticker element not found!');
}

// Fetch prices and display them
async function fetchPrices() {
  try {
    // Fetch data from the backend API
    const response = await fetch('https://judex.onrender.com/api/tickers');
    const data = await response.json();

    // Check if data.tickers exists
    if (data && data.tickers) {
      // Get the top 15 tickers (or all tickers if you prefer)
      const tickers = data.tickers.slice(0, 15);

      // Format the prices into a readable format
      const formattedPrices = tickers.map(ticker => {
        const price = parseFloat(ticker.last).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD' 
        });
        return `${ticker.pair}: ${price}`;
      });

      // Join the formatted prices with a separator and update the ticker element
      tickerEl.innerHTML =formattedPrices.join('&nbsp;&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;&nbsp;');

    } else {
      throw new Error('Invalid data format from API');
    }
  } catch (error) {
    tickerEl.innerHTML = 'Failed to load prices...';
    // console.error('Error fetching prices:', error);
  }
}

// Call fetchPrices immediately
fetchPrices();

// Optionally, refresh the prices every 60 seconds
setInterval(fetchPrices, 60000);





/**
 * add event on element
 */

const addEventOnElem = function (elem, type, callback) {
  if (elem.length > 1) {
    for (let i = 0; i < elem.length; i++) {
      elem[i].addEventListener(type, callback);
    }
  } else {
    elem.addEventListener(type, callback);
  }
}



/**
 * navbar toggle
 */

const navbar = document.querySelector("[data-navbar]");
const navbarLinks = document.querySelectorAll("[data-nav-link]");
const navToggler = document.querySelector("[data-nav-toggler]");

const toggleNavbar = function () {
  navbar.classList.toggle("active");
  navToggler.classList.toggle("active");
  document.body.classList.toggle("active");
}

addEventOnElem(navToggler, "click", toggleNavbar);

const closeNavbar = function () {
  navbar.classList.remove("active");
  navToggler.classList.remove("active");
  document.body.classList.remove("active");
}

addEventOnElem(navbarLinks, "click", closeNavbar);



/**
 * header active
 */

const header = document.querySelector("[data-header]");

const activeHeader = function () {
  if (window.scrollY > 300) {
    header.classList.add("active");
  } else {
    header.classList.remove("active");
  }
}

addEventOnElem(window, "scroll", activeHeader);



/**
 * toggle active on add to fav
 */

const addToFavBtns = document.querySelectorAll("[data-add-to-fav]");

const toggleActive = function () {
  this.classList.toggle("active");
}

addEventOnElem(addToFavBtns, "click", toggleActive);



/**
 * scroll revreal effect
 */

const sections = document.querySelectorAll("[data-section]");

const scrollReveal = function () {
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].getBoundingClientRect().top < window.innerHeight / 1.5) {
      sections[i].classList.add("active");
    } else {
      sections[i].classList.remove("active");
    }
  }
}

scrollReveal();

addEventOnElem(window, "scroll", scrollReveal);