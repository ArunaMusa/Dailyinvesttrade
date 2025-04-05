// Initial variables
let currentPrice = generateRandomPrice();
let userBalance = parseFloat(localStorage.getItem('userBalance')) || 0; // Retrieve from local storage
let trades = []; // Array to store trade history
let marketOpen = false; // Initialize market status
let totalProfit = 0;
let totalLoss = 0;
let priceTrendInterval; // Variable to hold the price trend interval
let marketOpeningTimer; // Variable to hold the market opening timer

// Constants
const MAX_WITHDRAWAL_AMOUNT = 200; 
const MIN_WITHDRAWAL_AMOUNT = 40; // Minimum withdrawal amount
const MAX_WITHDRAWALS_PER_WEEK = 2;
let withdrawalCountThisWeek = 0;
const priceTrendIntervalDuration = 90 * 1000; // Price trend interval duration
const TRADE_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const MAX_TRADES_PER_SESSION = 6;
let currentTradeCount = 0;
let tradeSessionStartTime = null;

// Market schedule configuration
const marketSchedule = {
    days: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
    hours: [
        { start: '09:00', end: '12:00' },
        { start: '15:00', end: '18:00' },
        { start: '21:00', end: '23:59' }
    ]
};

// Function to format currency as NLE
function formatCurrency(amount) {
    return `NLE ${amount.toFixed(2)}`;
}

// Initialize Chart.js
const ctx = document.getElementById("priceChart").getContext("2d");
const priceChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Price (Le)',
                data: [],
                borderColor: 'green',
                fill: false,
            },
            {
                label: 'Buy',
                data: [],
                backgroundColor: 'blue',
                borderColor: 'blue',
                pointRadius: 5,
                showLine: false
            },
            {
                label: 'Sell',
                data: [],
                backgroundColor: 'red',
                borderColor: 'red',
                pointRadius: 5,
                showLine: false
            }
        ]
    },
    options: {
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value) => formatCurrency(value)
                }
            }
        }
    }
});

// Function to generate a random price
function generateRandomPrice() {
    return parseFloat((Math.random() * 100).toFixed(2));
}

// Generate systematic price trend
function generatePriceTrend() {
    priceTrendInterval = setInterval(() => {
        if (!isMarketOpen()) {
            clearInterval(priceTrendInterval); // Stop updating price if the market is closed
            return;
        }

        const trend = Math.random() < 0.5 ? -1 : 1;
        currentPrice = Math.max(0, Math.min(100, currentPrice + trend * (Math.random() * 2).toFixed(2)));
        updatePrice();
    }, priceTrendIntervalDuration);
}

// Update the price on the chart
function updatePrice() {
    const now = new Date();
    const timeLabel = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    priceChart.data.labels.push(timeLabel);
    priceChart.data.datasets[0].data.push(currentPrice);
    priceChart.update();
}

// Update user balance
function updateBalance(newBalance) {
    userBalance = newBalance;
    localStorage.setItem('userBalance', userBalance.toString());
    document.getElementById("balance").innerText = `Balance: ${formatCurrency(userBalance)}`;
}

// Check if the market is open
function isMarketOpen() {
    const now = new Date();
    const day = now.toLocaleString('en-US', { weekday: 'long' });
    const time = now.toTimeString().slice(0, 5); // Get HH:MM format

    if (marketSchedule.days.includes(day)) {
        return marketSchedule.hours.some(period => time >= period.start && time <= period.end);
    }
    return false;
}

// Update market status and start price trend generation
function updateMarketStatus() {
    marketOpen = isMarketOpen();
    document.getElementById("marketStatus").innerText = marketOpen
        ? `Market Status: Open | Current Price: ${formatCurrency(currentPrice)}`
        : `Market Status: Closed`;

    if (marketOpen) {
        generatePriceTrend(); // Start generating price trend when market opens
        clearMarketOpeningTimer(); // Clear timer if market is open
    } else {
        clearInterval(priceTrendInterval); // Stop updating price if the market is closed
        startMarketOpeningTimer(); // Start countdown to the next market opening
    }
}

// Start the countdown to the next market opening
function startMarketOpeningTimer() {
    clearMarketOpeningTimer(); // Clear any existing timer
    marketOpeningTimer = setInterval(() => {
        const nextOpenTime = getNextMarketOpeningTime();
        const timeRemaining = nextOpenTime - new Date();

        if (timeRemaining <= 0) {
            clearMarketOpeningTimer();
            document.getElementById("nextMarketOpen").innerText = "Market is now open!";
            updateMarketStatus(); // Refresh market status
            return;
        }

        const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

        document.getElementById("nextMarketOpen").innerText = `Next market opens in: ${hours}h ${minutes}m ${seconds}s`;
    }, 1000);
}

// Clear the market opening timer
function clearMarketOpeningTimer() {
    clearInterval(marketOpeningTimer);
}

// Get the next market opening time
function getNextMarketOpeningTime() {
    const now = new Date();
    const day = now.toLocaleString('en-US', { weekday: 'long' });
    const nextMarketDay = marketSchedule.days.find(d => {
        const nextDate = new Date(now);
        nextDate.setDate(now.getDate() + (marketSchedule.days.indexOf(d) >= marketSchedule.days.indexOf(day) ? 0 : 1));
        return nextDate;
    });

    const nextOpenTime = marketSchedule.hours.map(period => {
        const [startHour, startMinute] = period.start.split(':').map(Number);
        const nextOpeningDate = new Date(now);
        nextOpeningDate.setDate(now.getDate() + (nextMarketDay === day ? 0 : 1));
        nextOpeningDate.setHours(startHour, startMinute, 0, 0);
        return nextOpeningDate;
    }).find(openingTime => openingTime > now);

    return nextOpenTime || new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0); // Default to next Monday at 9 AM
}

// Handle trading
function handleTrade(tradeType) {
    if (!marketOpen) {
        alert("Market is closed. Please try again during trading hours.");
        return;
    }

    if (currentTradeCount >= MAX_TRADES_PER_SESSION) {
        alert("Maximum trade limit reached for this session.");
        return;
    }

    if (tradeSessionStartTime === null) {
        tradeSessionStartTime = new Date(); // Start the session timer
    } else if (new Date() - tradeSessionStartTime > TRADE_TIMEOUT) {
        // If the trade times out, mark all buy trades as losses
        trades.forEach(trade => {
            if (trade.type === 'buy' && trade.status === 'active') {
                trade.status = 'loss';
                totalLoss += currentPrice; // Add to total loss
            }
        });
        alert("Trade session has timed out. All active buy trades are now marked as losses.");
        resetTradeSession();
        updateProfitLossDisplay();
        return;
    }

    if (tradeType === 'buy') {
        // Check if the user has sufficient balance
        if (userBalance < currentPrice) {
            alert("Insufficient funds to buy at this price, get a deposit code and try again.");
            return;
        }

        // Handle buy trade
        userBalance -= currentPrice;
        updateBalance(userBalance);
        trades.push({ type: 'buy', price: currentPrice, status: 'active' });

        const now = new Date();
        const timeLabel = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
        priceChart.data.datasets[1].data.push(currentPrice);
        priceChart.data.labels.push(timeLabel);
        priceChart.update();

        // Notify user of successful buy
        alert(`Bought at ${formatCurrency(currentPrice)}. Your current balance is ${formatCurrency(userBalance)}.`);
    } else if (tradeType === 'sell') {
        // Handle sell trade
        const lastBuyTrade = trades.find(trade => trade.type === 'buy' && trade.status === 'active');
        if (!lastBuyTrade) {
            alert("No available buy trades to sell!");
            return;
        }

        userBalance += currentPrice;
        updateBalance(userBalance);

        // Calculate profit or loss
        const profitOrLoss = currentPrice - lastBuyTrade.price;
        if (profitOrLoss > 0) {
            totalProfit += profitOrLoss;
            lastBuyTrade.status = 'profit';
        } else {
            totalLoss += Math.abs(profitOrLoss);
            lastBuyTrade.status = 'loss';
        }

        const now = new Date();
        const timeLabel = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
        priceChart.data.datasets[2].data.push(currentPrice);
        priceChart.data.labels.push(timeLabel);
        priceChart.update();

        // Notify user of successful sell
        alert(`Sold at ${formatCurrency(currentPrice)}. Your current balance is ${formatCurrency(userBalance)}.`);
    }

    currentTradeCount++;
    updateProfitLossDisplay(); // Update the display after trade
}

// Update profit and loss display
function updateProfitLossDisplay() {
    document.getElementById("totalProfit").innerText = `Total Profit: ${formatCurrency(totalProfit)}`;
    document.getElementById("totalLoss").innerText = `Total Loss: ${formatCurrency(totalLoss)}`;
}

// Function to handle withdrawals
function handleWithdrawal() {
    const username = document.getElementById("username").value;
    const address = document.getElementById("address").value;
    const telephone = document.getElementById("telephone").value;
    const withdrawAmount = parseFloat(document.getElementById("withdrawAmount").value);

    // Validate withdrawal information
    if (!validateWithdrawalInfo(username, address, telephone, withdrawAmount)) return;

    if (withdrawalCountThisWeek >= MAX_WITHDRAWALS_PER_WEEK) {
        alert("You have reached the maximum number of withdrawals for this week.");
        return;
    }

    if (withdrawAmount > userBalance) {
        alert("Insufficient balance for withdrawal.");
        return;
    }

    // Deduct the amount from user balance
    userBalance -= withdrawAmount;
    updateBalance(userBalance);
    withdrawalCountThisWeek++;
    alert(`Withdrawal of ${formatCurrency(withdrawAmount)} processed successfully.`);

    // Generate QR code after successful withdrawal
    const withdrawalInfo = {
        username: username,
        address: address,
        telephone: telephone,
        withdrawAmount: withdrawAmount,
        timestamp: new Date().toISOString(),
        lastDepositAmount: getLastDepositAmount() // Replace with actual retrieval function
    };
    generateQRCode(withdrawalInfo);
}

// Validate withdrawal information
function validateWithdrawalInfo(username, address, telephone, withdrawAmount) {
    const telephoneRegex = /^\+232\d{8}$/;
    const idNumberRegex = /^SL\d{17}$/;

    if (!username || !address || !telephone || !withdrawAmount) {
        alert("All fields are required.");
        return false;
    }

    if (withdrawAmount < MIN_WITHDRAWAL_AMOUNT) {
        alert(`Minimum withdrawal amount is NLE ${MIN_WITHDRAWAL_AMOUNT}.`);
        return false;
    }

    if (withdrawAmount > MAX_WITHDRAWAL_AMOUNT) {
        alert(`Maximum withdrawal amount is NLE ${MAX_WITHDRAWAL_AMOUNT}.`);
        return false;
    }

    if (!telephoneRegex.test(telephone)) {
        alert("Invalid telephone number format. Please use +232XXXXXXXX.");
        return false;
    }

    return true;
}

// Generate QR code
function generateQRCode(withdrawalInfo) {
    const qrCodeData = `Username: ${withdrawalInfo.username}\nAddress: ${withdrawalInfo.address}\nTelephone: ${withdrawalInfo.telephone}\nAmount Withdrawn: ${withdrawalInfo.withdrawAmount}\nTime and Date: ${withdrawalInfo.timestamp}\nLast Deposit Amount Made: ${withdrawalInfo.lastDepositAmount}`;
    const qrCodeCanvas = document.getElementById("qrCodeCanvas");

    QRCode.toCanvas(qrCodeCanvas, qrCodeData, function (error) {
        if (error) {
            console.error(error);
            alert("An error occurred while generating the QR code.");
            return;
        }

        qrCodeCanvas.style.display = 'block'; // Show QR code
        alert("QR code generated successfully! Please screenshot it and submit for payment.");
        // Convert QR code canvas to a downloadable link
        const qrCodeDataUrl = qrCodeCanvas.toDataURL();
        const link = document.createElement('a');
        link.href = qrCodeDataUrl;
        link.download = 'withdrawal_qr_code.png';
        link.innerText = 'Download QR Code';
        document.body.appendChild(link); // Add link to the document
    });
}

// Retrieve the last deposit amount (Placeholder function)
function getLastDepositAmount() {
    return localStorage.getItem('lastDepositAmount') || 0; // Replace with actual retrieval logic
}

// Attach event listeners
document.getElementById("withdrawButton").addEventListener("click", handleWithdrawal);

// Initialize
updateMarketStatus(); // Check market status on load
updateBalance(userBalance); // Display initial balance
// Array to hold demo deposit codes
const demoDepositCodes = [];

// Function to generate 100 demo deposit codes
function generateDemoCodes(count) {
    for (let i = 0; i < count; i++) {
        const code = 'DPT' + String(i + 1).padStart(3, '0'); // Example: DPT001, DPT002, etc.
        demoDepositCodes.push(code);
    }
}

// Call to generate demo codes
generateDemoCodes(100);

// Retrieve balance and trade activities from local storage
let balance = parseFloat(localStorage.getItem('userBalance')) || 0;
let tradeActivities = JSON.parse(localStorage.getItem('tradeActivities')) || [];

// Function to update the displayed balance
function updateBalanceDisplay() {
    document.getElementById('balance').textContent = `Balance: NLE ${balance.toFixed(2)}`;
}

// Function to save trade activities to local storage
function saveTradeActivities() {
    localStorage.setItem('tradeActivities', JSON.stringify(tradeActivities));
}

// Function to handle withdrawals
function handleWithdrawal() {
    const username = document.getElementById("username").value;
    const address = document.getElementById("address").value;
    const telephone = document.getElementById("telephone").value;
    const withdrawAmount = parseFloat(document.getElementById("withdrawAmount").value);

    // Validate withdrawal information
    if (!validateWithdrawalInfo(username, address, telephone, withdrawAmount)) return;

    if (withdrawalCountThisWeek >= MAX_WITHDRAWALS_PER_WEEK) {
        alert("You have reached the maximum number of withdrawals for this week.");
        return;
    }

    if (withdrawAmount > userBalance) {
        alert("Insufficient balance for withdrawal.");
        return;
    }

    // Deduct the amount from user balance
    userBalance -= withdrawAmount;
    updateBalance(userBalance);
    withdrawalCountThisWeek++;
    alert(`Withdrawal of ${formatCurrency(withdrawAmount)} processed successfully.`);

    // Generate QR code after successful withdrawal
    const withdrawalInfo = {
        username: username,
        address: address,
        telephone: telephone,
        withdrawAmount: withdrawAmount,
        timestamp: new Date().toISOString(),
        lastDepositAmount: getLastDepositAmount() // Replace with actual retrieval function
    };
    generateQRCode(withdrawalInfo);
}

// Generate QR code with downloadable link
function generateQRCode(withdrawalInfo) {
    const qrCodeData = `Username: ${withdrawalInfo.username}\nAddress: ${withdrawalInfo.address}\nTelephone: ${withdrawalInfo.telephone}\nAmount Withdrawn: ${withdrawalInfo.withdrawAmount}\nTime and Date: ${withdrawalInfo.timestamp}\nLast Deposit Amount Made: ${withdrawalInfo.lastDepositAmount}`;
    const qrCodeCanvas = document.getElementById("qrCodeCanvas");

    QRCode.toCanvas(qrCodeCanvas, qrCodeData, function (error) {
        if (error) {
            console.error(error);
            alert("An error occurred while generating the QR code.");
            return;
        }

        qrCodeCanvas.style.display = 'block'; // Show QR code
        alert("QR code generated successfully! Please screenshot it and submit for payment.");

        // Convert QR code canvas to a downloadable link
        const qrCodeDataUrl = qrCodeCanvas.toDataURL("image/png");
        const link = document.createElement('a');
        link.href = qrCodeDataUrl;
        link.download = 'withdrawal_qr_code.png';
        link.innerText = 'Download QR Code';
        link.style.display = 'block';
        document.getElementById("notification").appendChild(link); // Display link for download
    });
}
// Ensure deposit codes are used only once by keeping track of used codes in localStorage
const usedDepositCodes = JSON.parse(localStorage.getItem('usedDepositCodes')) || [];

// Deposit functionality
document.getElementById('depositButton').addEventListener('click', function() {
    const enteredCode = document.getElementById('depositCode').value.trim();

    if (demoDepositCodes.includes(enteredCode) && !usedDepositCodes.includes(enteredCode)) {
        const depositAmount = 20; // Fixed deposit amount

        // Update balance and save it to local storage
        balance += depositAmount;
        localStorage.setItem('userBalance', balance); 
        localStorage.setItem('lastDepositAmount', depositAmount); // Save last deposit amount
        updateBalanceDisplay();

        // Log trade activity
        tradeActivities.push({
            type: 'Deposit',
            amount: depositAmount,
            time: new Date().toLocaleString(),
            balanceAfter: balance
        });
        saveTradeActivities();

        alert(`Deposit successful! NLE ${depositAmount} added to your account.`);

        // Mark the code as used and save to local storage
        usedDepositCodes.push(enteredCode);
        localStorage.setItem('usedDepositCodes', JSON.stringify(usedDepositCodes));
        
        // Remove the used code from demoDepositCodes array
        const index = demoDepositCodes.indexOf(enteredCode);
        if (index > -1) {
            demoDepositCodes.splice(index, 1);
        }
    } else {
        alert("Invalid or already used deposit code.");
    }
});

// Function to update the displayed balance
function updateBalanceDisplay() {
    document.getElementById('balance').textContent = `Balance: NLE ${balance.toFixed(2)}`;
}

// Initialize
updateBalanceDisplay(); // Display initial balance on page load