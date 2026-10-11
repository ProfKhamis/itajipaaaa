const BASE_URL = 'https://api.derivws.com';
let accountList = [];
let optionsWebSocket = null;
let totalSessionProfit = 0;
const sessionProfitDisplay = document.getElementById("session-profit-display"); 
let activeTabId = 'tab-even-odd';
const edgeActiveContractIds = new Set();
const tnActiveContractIds = new Set();
let tnBatchOpenCount = 0;
const over2ActiveContractIds = new Set();
let over2BatchOpenCount = 0;
const patternOuActiveContractIds = new Set();
const patternO1U8ActiveContractIds = new Set();
let isAutoTradingPO18 = false;
let totalTradesExecutedPO18 = 0;
let patternO1U8Cooldown = false;
let recentDigitHistoryHG = []; // last 3 digits, own history for the Hedging Tool
let recentDigitHistoryPO18 = []; // own history so this tab never interferes with the other pattern tab

// Rise/Fall Signal tab state
const rfActiveContractIds = new Set();
let isAutoTradingRF = false;
let totalTradesExecutedRF = 0;
let rfCooldown = false;
let rfPriceHistory = []; // {price} objects, most recent last, reset whenever the symbol changes
const RF_MAX_POINTS = 120;
const RF_FAST_PERIOD = 5;
const RF_SLOW_PERIOD = 20;
const RF_RSI_PERIOD = 14;
let isAutoTradingEO = false;
let isAutoTradingOU = false;
let autoBulkCooldown = false; 
let totalTradesExecutedOU = 0; 
let ouPatternMatchLabel = null;

// --- Loading / async feedback helpers ---
function setButtonLoading(button, isLoading, loadingText) {
    if (!button) return;
    if (isLoading) {
        if (button.dataset.originalHtml === undefined) {
            button.dataset.originalHtml = button.innerHTML;
        }
        button.classList.add('is-loading');
        button.disabled = true;
        button.innerHTML = `<span class="btn-spinner"></span>${loadingText || 'Working...'}`;
    } else {
        button.classList.remove('is-loading');
        button.disabled = false;
        if (button.dataset.originalHtml !== undefined) {
            button.innerHTML = button.dataset.originalHtml;
            delete button.dataset.originalHtml;
        }
    }
}

// DOM Bindings - Core & UI elements
const btnFetch = document.getElementById('btn-fetch-accounts');
const btnResetBalance = document.getElementById('btn-reset-balance');
const btnToggleStream = document.getElementById('btn-toggle-stream');
const tokenInput = document.getElementById('api-token');
const appIdInput = document.getElementById('app-id');
const apiStatus = document.getElementById('api-status');
const dropdown = document.getElementById('account-dropdown');
const balanceText = document.getElementById('active-balance');
const currencyText = document.getElementById('active-currency');
const badge = document.getElementById('account-type-badge');
const logConsole = document.getElementById('log-console');

// DOM Bindings - Market Data
const marketPanel = document.getElementById('market-data-panel');
const marketDropdown = document.getElementById('market-dropdown');
const liveTickValue = document.getElementById('live-tick-value');
const liveDigitValue = document.getElementById('live-digit-value');


// DOM Bindings - Strategy 1 (EO)
const btnBuyEO = document.getElementById('btn-buy-eo');
const btnToggleAutoEO = document.getElementById('btn-toggle-auto-eo');
const tradeStakeEO = document.getElementById('trade-stake-eo');
const tradeDurationEO = document.getElementById('trade-duration-eo');
const strategyModeEO = document.getElementById('strategy-mode-eo');

// DOM Bindings - Strategy 2 (OU)
const btnBuyOU = document.getElementById('btn-buy-ou');
const btnToggleAutoOU = document.getElementById('btn-toggle-auto-ou');
const tradeStakeOU = document.getElementById('trade-stake-ou');
const tradeDurationOU = document.getElementById('trade-duration-ou');
const predOverInput = document.getElementById('pred-over');
const predUnderInput = document.getElementById('pred-under');
const maxTradesOUInput = document.getElementById('max-trades-ou');
const patternTriggerOUCheckbox = document.getElementById('pattern-trigger-ou');
const ouPatternStatus = document.getElementById('ou-pattern-status');
const ouPatternDigitHistoryDisplay = document.getElementById('ou-pattern-digit-history');
const ouPatternLastMatchDisplay = document.getElementById('ou-pattern-last-match');
const loopUntilTargetOUCheckbox = document.getElementById('loop-until-target-ou');
const ouLoopStatus = document.getElementById('ou-loop-status');
const ouLoopCycleCountDisplay = document.getElementById('ou-loop-cycle-count');
const ouLoopStatusText = document.getElementById('ou-loop-status-text');
let ouLoopCycleCount = 0;
const ledgerBody = document.getElementById('ledger-body');
const emptyRow = document.getElementById('ledger-empty-row');

// DOM Bindings - Strategy 6 (Bulk Only Ups/Only Downs)
const btnBuyOUD = document.getElementById('btn-buy-oud');
const btnToggleAutoOUD = document.getElementById('btn-toggle-auto-oud');
const tradeStakeOUD = document.getElementById('trade-stake-oud');
const tradeDurationOUD = document.getElementById('trade-duration-oud');
const maxTradesOUDInput = document.getElementById('max-trades-oud');
const loopUntilTargetOUDCheckbox = document.getElementById('loop-until-target-oud');
const oudLoopStatus = document.getElementById('oud-loop-status');
const oudLoopCycleCountDisplay = document.getElementById('oud-loop-cycle-count');
const oudLoopStatusText = document.getElementById('oud-loop-status-text');
let oudLoopCycleCount = 0;
let isAutoTradingOUD = false;
let autoBulkCooldownOUD = false;
let totalTradesExecutedOUD = 0;

// DOM Bindings - Strategy 5 (Pattern-Triggered Over/Under)
const btnToggleAutoPOU = document.getElementById('btn-toggle-auto-pou');
const tradeStakePOU = document.getElementById('trade-stake-pou');
const tradeDurationPOU = document.getElementById('trade-duration-pou');
const maxTradesPOUInput = document.getElementById('max-trades-pou');
const patternDigitHistoryDisplay = document.getElementById('pattern-digit-history');
const patternLastMatchDisplay = document.getElementById('pattern-last-match');

// DOM Bindings - Take Profit / Stop Loss
const btnToggleTPSL = document.getElementById('btn-toggle-tpsl');
const tpTargetInput = document.getElementById('tp-target');
const slTargetInput = document.getElementById('sl-target');
const tpslProgressFill = document.getElementById('tpsl-progress-fill');
const tpslModalOverlay = document.getElementById('tpsl-modal-overlay');
const tpslModalIcon = document.getElementById('tpsl-modal-icon');
const tpslModalTitle = document.getElementById('tpsl-modal-title');
const tpslModalMessage = document.getElementById('tpsl-modal-message');
const tpslModalAmount = document.getElementById('tpsl-modal-amount');
const btnCloseTPSLModal = document.getElementById('btn-close-tpsl-modal');
let isTPSLArmed = false;

// DOM Bindings - Bulk Over 2 (digit-trigger batch buyer)
const btnBuyBulkOver2 = document.getElementById('btn-buy-bulk-over2');
const tradeStakeOver2 = document.getElementById('trade-stake-over2');
const tradeDurationOver2 = document.getElementById('trade-duration-over2');
const triggerModeOver2Select = document.getElementById('trigger-mode-over2');
const triggerDigitOver2Input = document.getElementById('trigger-digit-over2');
const triggerDigitLabelOver2 = document.getElementById('trigger-digit-label-over2');
const triggerDigit2Over2Input = document.getElementById('trigger-digit-2-over2');
const triggerDigit2WrapperOver2 = document.getElementById('trigger-digit-2-wrapper-over2');
const contractsPerTriggerOver2Input = document.getElementById('contracts-per-trigger-over2');
const maxTriggersOver2Input = document.getElementById('max-triggers-over2');
const overBarrierOver2Input = document.getElementById('over-barrier-over2');
const over2RunProgressDisplay = document.getElementById('over2-run-progress');
let isBulkOver2Armed = false;
let bulkOver2TriggersFired = 0;
let bulkOver2Cooldown = false;
let isAutoTradingPOU = false;
let totalTradesExecutedPOU = 0;
let patternCooldown = false;
let recentDigitHistory = []; 
let digitFrequencyWindow = []; // rolling window for Differs auto-predict (hot digit)

// --- Last-digit accuracy -------------------------------------------------------------
// A quote such as 1234.40 arrives as the number 1234.4, so toString() loses the trailing
// zero and the digit reads as 4 instead of 0. To read the true last digit we need each
// market's decimal places. They come from (in this order of trust): the tick's pip_size,
// the tick's pip, the active_symbols list, and finally the most decimals ever seen on
// that market (which converges within a couple of ticks). We always use the largest.
const symbolPipDecimals = {};   // symbol -> decimals reported by active_symbols
const learnedDecimals = {};     // symbol -> most decimals seen in a quote so far
const loggedDecimals = {};      // symbol -> last decimals we announced in the console
let digitWarmupTicks = 0;       // ticks skipped after subscribing when no pip info exists

function getSymbolDecimals(symbol) {
    const key = symbol || marketDropdown.value;
    return Math.max(symbolPipDecimals[key] || 0, learnedDecimals[key] || 0);
}

// Format a spot for the ledger at the market's real precision (never rounded to 2 decimals).
// Prefers the exact display string Deriv sends with the contract when it is present.
function formatSpot(displayValue, rawValue, symbol) {
    if (displayValue !== undefined && displayValue !== null && displayValue !== "") return String(displayValue);
    const n = Number(rawValue);
    if (!isFinite(n)) return String(rawValue);
    const dec = getSymbolDecimals(symbol);
    return dec > 0 ? n.toFixed(dec) : String(rawValue);
}

function decimalsFromPipValue(v) {
    if (v === undefined || v === null) return null;
    const n = Number(v);
    if (!isFinite(n) || n <= 0) return null;
    if (n < 1) {                                   // pip such as 0.01 -> 2 decimals
        const d = Math.round(-Math.log10(n));
        return d <= 10 ? d : null;
    }
    if (Number.isInteger(n) && n <= 10) return n;  // pip_size such as 2 -> 2 decimals
    return null;
}
const HOT_DIGIT_WINDOW_SIZE = 20;

function getHotDigit() {
    if (digitFrequencyWindow.length === 0) return null;
    const counts = new Array(10).fill(0);
    digitFrequencyWindow.forEach(d => counts[d]++);
    let hotDigit = 0;
    for (let d = 1; d <= 9; d++) {
        if (counts[d] > counts[hotDigit]) hotDigit = d;
    }
    return hotDigit;
}

const DIGIT_PATTERNS = [
    { digits: [2, 0], contract_type: 'DIGITOVER', barrier: '2', label: 'Over 2 (2\u2194 0 pattern)' },
    { digits: [7, 9], contract_type: 'DIGITUNDER', barrier: '7', label: 'Under 7 (7\u2194 9 pattern)' }
];

function matchDigitPattern(history) {
    if (history.length < 2) return null;
    const [a, b] = history;
    return DIGIT_PATTERNS.find(p =>
        (a === p.digits[0] && b === p.digits[1]) || (a === p.digits[1] && b === p.digits[0])
    ) || null;
}

function matchConsecutivePair(history, digitA, digitB) {
    if (history.length < 2) return false;
    const [a, b] = history;
    return (a === digitA && b === digitB) || (a === digitB && b === digitA);
}

// Bulk OU pattern trigger: fires when the last two digits are each a member of
// {digitA, digitB} - covers both orders AND either digit repeating (e.g. 4,5 / 5,4 / 4,4 / 5,5).
function matchOUTriggerPair(history, digitA, digitB) {
    if (history.length < 2) return false;
    const [a, b] = history;
    const isMember = (d) => d === digitA || d === digitB;
    return isMember(a) && isMember(b);
}

if (triggerModeOver2Select) {
    triggerModeOver2Select.addEventListener('change', () => {
        const isDouble = triggerModeOver2Select.value === 'double';
        if (triggerDigit2WrapperOver2) triggerDigit2WrapperOver2.style.display = isDouble ? 'flex' : 'none';
        if (triggerDigitLabelOver2) triggerDigitLabelOver2.textContent = isDouble ? "First Trigger Digit (0-9):" : "Trigger Digit (0-9):";
    });
}

// --- TAKE PROFIT / STOP LOSS ---
function updateSessionProfitUI() {
    if (sessionProfitDisplay) {
        sessionProfitDisplay.textContent = totalSessionProfit.toFixed(2);
        sessionProfitDisplay.style.color = totalSessionProfit > 0
            ? "var(--accent-green)"
            : totalSessionProfit < 0
                ? "var(--accent-red)"
                : "var(--text-primary)";
    }
    updateTPSLProgressBar();
}

function updateTPSLProgressBar() {
    if (!tpslProgressFill) return;
    const tpTarget = parseFloat(tpTargetInput.value) || 0;
    const slTarget = parseFloat(slTargetInput.value) || 0;

    if (tpTarget <= 0 && slTarget <= 0) {
        tpslProgressFill.style.width = '0%';
        tpslProgressFill.style.left = '50%';
        return;
    }

    let halfWidthPct;
    if (totalSessionProfit >= 0) {
        halfWidthPct = tpTarget > 0 ? Math.min(totalSessionProfit / tpTarget, 1) * 50 : 0;
        tpslProgressFill.style.left = '50%';
        tpslProgressFill.style.width = `${halfWidthPct}%`;
        tpslProgressFill.style.backgroundColor = 'var(--accent-green)';
    } else {
        halfWidthPct = slTarget > 0 ? Math.min(Math.abs(totalSessionProfit) / slTarget, 1) * 50 : 0;
        tpslProgressFill.style.left = `${50 - halfWidthPct}%`;
        tpslProgressFill.style.width = `${halfWidthPct}%`;
        tpslProgressFill.style.backgroundColor = 'var(--accent-red)';
    }
}

function checkTPSLHit() {
    if (!isTPSLArmed) return;
    const tpTarget = parseFloat(tpTargetInput.value) || 0;
    const slTarget = parseFloat(slTargetInput.value) || 0;

    if (tpTarget > 0 && totalSessionProfit >= tpTarget) {
        haltAllAutoModes();
        disarmTPSL();
        showTPSLModal(true, totalSessionProfit);
    } else if (slTarget > 0 && totalSessionProfit <= -slTarget) {
        haltAllAutoModes();
        disarmTPSL();
        showTPSLModal(false, totalSessionProfit);
    }
}

function showTPSLModal(isWin, amount) {
    if (!tpslModalOverlay) return;
    if (isWin) {
        tpslModalIcon.textContent = "";
        tpslModalTitle.textContent = "Take Profit Hit!";
        tpslModalMessage.textContent = "Nice work — you hit your session take profit target. Consider calling it here.";
        tpslModalAmount.textContent = `+${amount.toFixed(2)} USD`;
        tpslModalAmount.className = "modal-amount win";
    } else {
        tpslModalIcon.textContent = "";
        tpslModalTitle.textContent = "Stop Loss Hit";
        tpslModalMessage.textContent = "Your session stop loss was reached, so auto-trading has been halted to protect your balance.";
        tpslModalAmount.textContent = `${amount.toFixed(2)} USD`;
        tpslModalAmount.className = "modal-amount loss";
    }
    tpslModalOverlay.style.display = 'flex';
}

if (btnCloseTPSLModal) {
    btnCloseTPSLModal.addEventListener('click', () => {
        tpslModalOverlay.style.display = 'none';
    });
}

function armTPSL() {
    isTPSLArmed = true;
    btnToggleTPSL.textContent = "Disarm TP/SL";
    btnToggleTPSL.classList.add('stream-active');
    tpTargetInput.disabled = true;
    slTargetInput.disabled = true;
    totalSessionProfit = 0;
    updateSessionProfitUI();
    logToConsole(`[TP/SL] Armed. Take Profit: $${tpTargetInput.value} | Stop Loss: $${slTargetInput.value}`, "success-msg");
}

function disarmTPSL() {
    isTPSLArmed = false;
    btnToggleTPSL.textContent = "Arm TP/SL";
    btnToggleTPSL.classList.remove('stream-active');
    tpTargetInput.disabled = false;
    slTargetInput.disabled = false;
}
if (btnToggleTPSL) {
    btnToggleTPSL.addEventListener('click', () => {
        if (isTPSLArmed) {
            disarmTPSL();
            logToConsole("[TP/SL] Disarmed by user.");
        } else {
            armTPSL();
        }
    });
}

function haltAllAutoModes() {
    if (isAutoTradingEO) toggleAutoEO(false);
    if (isAutoTradingOU) toggleAutoOU(false);
    if (isAutoTradingOUD) toggleAutoOUD(false);
    if (isAutoTradingPOU) toggleAutoPOU(false);
    if (isAutoTradingPO18) toggleAutoPO18(false);
    if (isAutoTradingRF) toggleAutoRF(false);
    if (isAutoTradingBRF) toggleAutoBRF(false);
    if (isBulkOver2Armed) disarmBulkOver2();
    if (isAutoModeTN) toggleAutoTN(false);
    if (isEdgeRotationActive) stopEdgeRotation("Stopped - session TP/SL hit.");
    if (isAutoTradingHG) toggleAutoHG(false);
    if (isAutoTradingFlip) toggleAutoFlip(false);
    if (isAutoTradingBeast) toggleAutoBeast(false);
    logToConsole("[Risk Management] All auto-trading modes halted.", "error-msg");
}

// --- BULK OVER 2 BUYING IN BATCHES KIJANA---
btnBuyBulkOver2.addEventListener('click', () => {
    if (isBulkOver2Armed) {
        disarmBulkOver2();
    } else {
        armBulkOver2();
    }
});

function armBulkOver2() {
    if (isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) {
        logToConsole("Error: Real-time stream must be connected before running trades.", "error-msg");
        return;
    }
    bulkOver2TriggersFired = 0;
    bulkOver2Cooldown = false;
    isBulkOver2Armed = true;

    btnBuyBulkOver2.textContent = "Disarm Bulk Over 2";
    btnBuyBulkOver2.classList.add('stream-active');
    tradeStakeOver2.disabled = true;
    tradeDurationOver2.disabled = true;
    if (triggerModeOver2Select) triggerModeOver2Select.disabled = true;
    triggerDigitOver2Input.disabled = true;
    if (triggerDigit2Over2Input) triggerDigit2Over2Input.disabled = true;
    contractsPerTriggerOver2Input.disabled = true;
    maxTriggersOver2Input.disabled = true;
    overBarrierOver2Input.disabled = true;
    if (over2RunProgressDisplay) over2RunProgressDisplay.textContent = `0 / ${maxTriggersOver2Input.value}`;

    const isDouble = triggerModeOver2Select && triggerModeOver2Select.value === 'double';
    const watchDesc = isDouble
        ? `digits ${triggerDigitOver2Input.value} & ${triggerDigit2Over2Input.value} landing back-to-back`
        : `digit ${triggerDigitOver2Input.value}`;
    logToConsole(`[Bulk Over] Armed. Watching for ${watchDesc} -- will buy ${contractsPerTriggerOver2Input.value} Over ${overBarrierOver2Input.value} contracts each time it fires.`, "success-msg");
}

function disarmBulkOver2() {
    isBulkOver2Armed = false;
    btnBuyBulkOver2.textContent = "Arm Bulk Over 2";
    btnBuyBulkOver2.classList.remove('stream-active');
    tradeStakeOver2.disabled = false;
    tradeDurationOver2.disabled = false;
    if (triggerModeOver2Select) triggerModeOver2Select.disabled = false;
    triggerDigitOver2Input.disabled = false;
    if (triggerDigit2Over2Input) triggerDigit2Over2Input.disabled = false;
    contractsPerTriggerOver2Input.disabled = false;
    maxTriggersOver2Input.disabled = false;
    overBarrierOver2Input.disabled = false;
    logToConsole("[Bulk Over] Disarmed.");
}

function fireBulkOver2Batch() {
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) {
        logToConsole("Error: Real-time stream must be connected before running trades.", "error-msg");
        disarmBulkOver2();
        return;
    }

    const symbol = marketDropdown.value;
    const stake = parseFloat(tradeStakeOver2.value);
    const duration = parseInt(tradeDurationOver2.value, 10);
    const currency = currencyText.textContent || "USD";
    const batchSize = parseInt(contractsPerTriggerOver2Input.value, 10) || 1;
    const overBarrier = overBarrierOver2Input.value.toString();
    const bulkRunToken = "BULK_OVER2_" + Date.now();
    challengeBatchExpectedCounts[bulkRunToken] = batchSize;

    const overPayload = JSON.stringify({
        "buy": 1,
        "price": stake,
        "subscribe": 1,
        "parameters": {
            "amount": stake,
            "basis": "stake",
            "contract_type": "DIGITOVER",
            "currency": currency,
            "duration": duration,
            "duration_unit": "t",
            "underlying_symbol": symbol,
            "barrier": overBarrier
        },
        "passthrough": { "bulkRunId": bulkRunToken }
    });

    for (let i = 0; i < batchSize; i++) {
        optionsWebSocket.send(overPayload);
    }

    bulkOver2TriggersFired += 1;
    const maxTriggers = parseInt(maxTriggersOver2Input.value, 10) || 10;
    if (over2RunProgressDisplay) over2RunProgressDisplay.textContent = `${bulkOver2TriggersFired} / ${maxTriggers}`;
    logToConsole(`[Bulk Over] Trigger digit hit \u2014 bought ${batchSize} Over ${overBarrier} contracts. (${bulkOver2TriggersFired}/${maxTriggers} triggers)`, "success-msg");

    if (bulkOver2TriggersFired >= maxTriggers) {
        logToConsole("[Bulk Over] Max trigger cap reached. Disarming.", "success-msg");
        disarmBulkOver2();
        return;
    }

    bulkOver2Cooldown = true;
    over2BatchOpenCount = batchSize;
}

// --- TAB NAVIGATION LOGIC ---
const dashboardContainer = document.querySelector('.dashboard-container');
const focusBar = document.getElementById('focus-bar');
const btnExitFocus = document.getElementById('btn-exit-focus');

function enterFocusMode() {
    if (dashboardContainer) dashboardContainer.classList.add('focus-mode');
    if (focusBar) focusBar.style.display = 'flex';
}

function exitFocusMode() {
    if (dashboardContainer) dashboardContainer.classList.remove('focus-mode');
    if (focusBar) focusBar.style.display = 'none';
}

document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        button.classList.add('active');
        activeTabId = button.getAttribute('data-target');
        document.getElementById(activeTabId).classList.add('active');
        enterFocusMode();

        logToConsole(`Switched View: ${button.textContent}`, "system-msg");
    });
});

if (btnExitFocus) {
    btnExitFocus.addEventListener('click', exitFocusMode);
}

document.querySelectorAll('.quick-nav-link').forEach(link => {
    const target = link.getAttribute('href');
    if (target === '#section-setup' || target === '#section-market' || target === '#section-logs') {
        link.addEventListener('click', exitFocusMode);
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('deriv_pat_token');
    const savedAppId = localStorage.getItem('deriv_app_id');
    if (savedToken) tokenInput.value = savedToken;
    if (savedAppId) appIdInput.value = savedAppId;
});

// --- API SYNC EXECUTION CONNECTIONS ---
btnFetch.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    const appId = appIdInput.value.trim();
    if (!token || !appId) return;

    setButtonLoading(btnFetch, true, 'Connecting...');
    apiStatus.textContent = "Connecting...";

    try {
        const response = await fetch(`${BASE_URL}/trading/v1/options/accounts`, {
            method: 'GET',
            headers: { 'Deriv-App-ID': appId, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const result = JSON.parse(await response.text());
        accountList = result.data || [];
        localStorage.setItem('deriv_pat_token', token);
        localStorage.setItem('deriv_app_id', appId);
        apiStatus.textContent = "Synced";
        populateDropdown(accountList);
    } catch (e) {
        apiStatus.textContent = "Failed";
        logToConsole(e.message, "error-msg");
    } finally {
        setButtonLoading(btnFetch, false);
    }
});

document.getElementById("btn-clear-ledger").addEventListener("click", () => {
    const ledgerBody = document.getElementById("ledger-body");

    if (!ledgerBody) {
        console.error("CRITICAL: ledger-body not found in the DOM!");
        return;
    }

    ledgerBody.innerHTML = '';
    const emptyRow = document.createElement('tr');
    emptyRow.id = 'ledger-empty-row';
    emptyRow.innerHTML = `
        <td colspan="3" style="text-align: center; color: #888; padding: 20px;">
            No bulk operations logged in this session yet.
        </td>
    `;
    ledgerBody.appendChild(emptyRow);
    totalTradesExecutedTN = 0;
    if (typeof totalSessionProfit !== 'undefined') {
        totalSessionProfit = 0;
        updateSessionProfitUI();
    }

    logToConsole("Ledger cleared successfully.");
});

function addToLedger(data) {
    const ledgerBody = document.getElementById("ledger-body");
    const emptyRow = document.getElementById("ledger-empty-row");
    if (emptyRow) {
        ledgerBody.innerHTML = ""; 
    }

    // 2. Creating a new row
    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${data.type}</td>
        <td>${data.spot}</td>
        <td style="text-align: right;">${data.price}</td>
    `;

    ledgerBody.appendChild(row);
}

function populateDropdown(accounts) {
    dropdown.innerHTML = "";
    accounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.account_id;
        opt.textContent = `${acc.account_id} (${acc.account_type})`;
        dropdown.appendChild(opt);
    });
    dropdown.disabled = false;
    updateActiveAccountView(accounts[0].account_id);
}

dropdown.addEventListener('change', (e) => {
    disconnectExistingStream();
    updateActiveAccountView(e.target.value);
});

function updateActiveAccountView(accountId) {
    const selected = accountList.find(a => a.account_id === accountId);
    if (!selected) return;
    balanceText.textContent = selected.balance.toLocaleString(undefined, { minimumFractionDigits: 2 });
    currencyText.textContent = selected.currency;
    badge.textContent = selected.account_type;
    badge.className = `badge ${selected.account_type}`;
if (selected.account_type === 'demo') {
        btnResetBalance.style.display = 'block';
        btnResetBalance.disabled = false;
    } else {
        btnResetBalance.style.display = 'none';
    }
    logToConsole(`Switched active context to: ${accountId}`);
}

/*
 Reset Demo Account Balance (POST /trading/v1/options/accounts/{account_id}/reset-demo-balance)
 */
btnResetBalance.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    const appId = appIdInput.value.trim();
    const activeAccountId = dropdown.value;

    if (!activeAccountId) return;
    btnResetBalance.disabled = true;

    try {
        const response = await fetch(`${BASE_URL}/trading/v1/options/accounts/${activeAccountId}/reset-demo-balance`, {
            method: 'POST',
            headers: {
                'Deriv-App-ID': appId,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const responseText = await response.text();
        if (!response.ok) {
            const errorJson = JSON.parse(responseText);
            throw new Error(errorJson.errors ? errorJson.errors[0].message : "Reset failed");
        }

        const result = JSON.parse(responseText);
        logToConsole(`Demo balance successfully reset to ${result.data.balance} ${result.data.currency}.`, "success-msg");
        
        const targetAcc = accountList.find(a => a.account_id === activeAccountId);
        if (targetAcc) {
            targetAcc.balance = result.data.balance;
            updateActiveAccountView(activeAccountId);
        }
    } catch (error) {
        logToConsole(`Reset Failed: ${error.message}`, "error-msg");
    } finally {
        btnResetBalance.disabled = false;
    }
})

// --- WEBSOCKET ROUTING SWITCHBOARD ---
btnToggleStream.addEventListener('click', async () => {
    if (optionsWebSocket && optionsWebSocket.readyState === WebSocket.OPEN) {
        disconnectExistingStream();
        return;
    }
    const token = tokenInput.value.trim();
    const appId = appIdInput.value.trim();
    const activeAccountId = dropdown.value;
    if (!activeAccountId) return;

    btnToggleStream.disabled = true;
    setButtonLoading(btnToggleStream, true, 'Connecting...');

    try {
        const response = await fetch(`${BASE_URL}/trading/v1/options/accounts/${activeAccountId}/otp`, {
            method: 'POST',
            headers: { 'Deriv-App-ID': appId, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const result = JSON.parse(await response.text());
        const wsUrl = result.data.url;
        
        optionsWebSocket = new WebSocket(wsUrl);

        optionsWebSocket.onopen = () => {
            logToConsole("Connected! Live Stream Active.", "success-msg");
            const token = tokenInput.value.trim();
    optionsWebSocket.send(JSON.stringify({ "authorize": token }));
            setButtonLoading(btnToggleStream, false);
            btnToggleStream.disabled = false;
            btnToggleStream.textContent = "Disconnect Stream";
            btnToggleStream.classList.add('stream-active');
            marketPanel.style.display = 'flex';
            
            updateTradeControlsState(true);
            optionsWebSocket.send(JSON.stringify({ "active_symbols": "brief" }));
            optionsWebSocket.send(JSON.stringify({ "active_symbols": "brief" }));

        };
optionsWebSocket.onmessage = (event) => {
    
    const incoming = JSON.parse(event.data);
    if (incoming.req_id && hgPending[incoming.req_id]) {
        const done = hgPending[incoming.req_id];
        delete hgPending[incoming.req_id];
        done(incoming);
        return;
    }
    if (incoming.error) {
        const reqType = incoming.echo_req ? Object.keys(incoming.echo_req).find(k => ['buy', 'proposal_open_contract', 'sell', 'proposal'].includes(k)) : 'unknown';
        logToConsole(`[Stream Error] (${reqType}) ${incoming.error.code}: ${incoming.error.message}`, "error-msg");

        if (incoming.echo_req?.passthrough?.bulkRunId?.startsWith("EDGE_")) {
            edgeOpenTradeCount = Math.max(0, edgeOpenTradeCount - 1);
            if (isEdgeRotationActive) {
                logToConsole(`[Over 0 / Under 9] A trade failed to open (${incoming.error.message}) - continuing with the rest.`, "error-msg");
            } else {
                stopEdgeRotation(`Stopped - buy failed: ${incoming.error.message}`);
            }
        }
        if (incoming.echo_req?.passthrough?.bulkRunId?.startsWith("PATTERN_O1U8_")) {
            patternO1U8Cooldown = false;
        }
        if (incoming.echo_req?.passthrough?.bulkRunId?.startsWith("RISEFALL_")) {
            rfCooldown = false;
        }
        if (incoming.echo_req?.passthrough?.bulkRunId?.startsWith("BULK_RF_")) {
            brfHandleBuyError(incoming);
        }
        if (incoming.echo_req?.passthrough?.bulkRunId?.startsWith("RUNFLIP_")) {
            flipHandleBuyError(incoming);
        }
        if (incoming.echo_req?.passthrough?.bulkRunId?.startsWith("PBEAST_")) {
            beastHandleBuyError(incoming);
        }
        return;
    }
    if (incoming.msg_type === "topup_virtual") {
        logToConsole("Balance reset successful!", "success-msg");
        optionsWebSocket.send(JSON.stringify({ "balance": 1, "subscribe": 1 }));
    } else if (incoming.msg_type === "balance") {
        updateBalanceUI(incoming.balance);
    }
    if (incoming.msg_type === "active_symbols") {
        populateMarketDropdown(incoming.active_symbols);
    } else if (incoming.msg_type === "tick") {
        handleIncomingTickPacket(incoming.tick);
    } else if (incoming.msg_type === "buy") {
        handlePurchaseReceipt(incoming.buy, incoming.passthrough);
    } else if (incoming.msg_type === "proposal_open_contract") {
        queueContractUpdate(incoming.proposal_open_contract);
    } else if (incoming.msg_type === "candles") {
        handleRfCandleHistory(incoming.candles);
    } else if (incoming.msg_type === "ohlc") {
        handleRfOhlcUpdate(incoming.ohlc);
    }
};

        optionsWebSocket.onclose = () => disconnectExistingStream();

    } catch (error) {
        setButtonLoading(btnToggleStream, false);
        disconnectExistingStream();
    }
});


function populateMarketDropdown(symbolsArray) {
    marketDropdown.innerHTML = "";
    symbolsArray.forEach(sym => {
        const symDecimals = decimalsFromPipValue(sym.pip_size) ?? decimalsFromPipValue(sym.pip);
        if (symDecimals !== null) symbolPipDecimals[sym.underlying_symbol] = symDecimals;
        const opt = document.createElement('option');
        opt.value = sym.underlying_symbol;
        opt.textContent = sym.underlying_symbol_name;
        marketDropdown.appendChild(opt);
    });
    subscribeToSymbolTicks(symbolsArray[0].underlying_symbol);
}

marketDropdown.addEventListener('change', (e) => {
    if (optionsWebSocket && optionsWebSocket.readyState === WebSocket.OPEN && e.target.value) {
        subscribeToSymbolTicks(e.target.value);
    }
});

function subscribeToSymbolTicks(symbolCode) {
    if (!optionsWebSocket) return;
    optionsWebSocket.send(JSON.stringify({ "forget_all": "ticks" }));
    optionsWebSocket.send(JSON.stringify({ "ticks": symbolCode }));
    recentDigitHistory = [];
    digitFrequencyWindow = [];
    digitWarmupTicks = 0;
    rfPriceHistory = [];
    pkOnSymbolChange();
    if (rfSignalBadge) { rfSignalBadge.textContent = "Warming up\u2026"; rfSignalBadge.className = "system-msg"; }
    maybeSetupRfCandles(symbolCode);
}

// --- AUTO ENGINE RUNNER AND TICK PROCESSING ---
function handleIncomingTickPacket(tickData) {
    if (!tickData || !tickData.quote) return;
    const tickSymbol = tickData.symbol || tickData.underlying_symbol;
    if (tickSymbol && marketDropdown.value && tickSymbol !== marketDropdown.value) return;
    // Read the TRUE last digit (keeps trailing zeros: 1234.4 on a 2-decimal market is "1234.40").
    const digitKey = tickSymbol || marketDropdown.value;
    const knownDecimals = decimalsFromPipValue(tickData.pip_size)
        ?? decimalsFromPipValue(tickData.pip)
        ?? symbolPipDecimals[digitKey]
        ?? null;
    const rawQuote = String(tickData.quote);
    const seenDecimals = rawQuote.includes('.') ? rawQuote.split('.')[1].length : 0;
    learnedDecimals[digitKey] = Math.max(learnedDecimals[digitKey] || 0, seenDecimals);
    const decimals = Math.max(knownDecimals ?? 0, learnedDecimals[digitKey]);
    if (loggedDecimals[digitKey] !== decimals) {
        loggedDecimals[digitKey] = decimals;
        logToConsole(`[Digits] ${digitKey}: reading last digit at ${decimals} decimals (${knownDecimals !== null ? "from feed" : "learned from ticks"}).`, "system-msg");
    }
    // With no pip info from the feed, spend the first 2 ticks learning the decimals so a
    // trailing-zero tick can never be misread and trigger a trade.
    if (knownDecimals === null && digitWarmupTicks < 2) { digitWarmupTicks++; return; }
    const priceString = Number(tickData.quote).toFixed(decimals);
    const lastDigit = parseInt(priceString.charAt(priceString.length - 1), 10);

    recentDigitHistory.push(lastDigit);
    if (recentDigitHistory.length > 2) recentDigitHistory.shift();
    recentDigitHistoryPO18.push(lastDigit);
    if (recentDigitHistoryPO18.length > 2) recentDigitHistoryPO18.shift();
    recentDigitHistoryHG.push(lastDigit);
    if (recentDigitHistoryHG.length > 3) recentDigitHistoryHG.shift();

    pkOnTick(Number(tickData.quote), Number(tickData.epoch), lastDigit);
    updateRiseFallSignal(Number(tickData.quote), Number(tickData.epoch));
    if (typeof brfCdTick === 'function') brfCdTick(Number(tickData.epoch));

    digitFrequencyWindow.push(lastDigit);
    if (digitFrequencyWindow.length > HOT_DIGIT_WINDOW_SIZE) digitFrequencyWindow.shift();
    if (predictedDigitTNDisplay && autoPredictTN && autoPredictTN.checked) {
        const hotDigit = getHotDigit();
        predictedDigitTNDisplay.value = hotDigit === null ? '--' : hotDigit;
    }

    let patternFired = false;
    let stopAutoPOU = false;
    let patternMatch = null;

    if (!isTradingLocked()) {
        if (isAutoTradingPOU && !patternCooldown) {
            const maxAllowed = parseInt(maxTradesPOUInput.value, 10) || 10;
            if (totalTradesExecutedPOU + 1 > maxAllowed) {
                stopAutoPOU = true;
            } else {
                const match = matchDigitPattern(recentDigitHistory);
                if (match) {
                    patternMatch = match;
                    executePatternOverUnder(match);
                    recentDigitHistory = [];
                    patternFired = true;
                }
            }
        }

        handlePatternO1U8Tick();
        handleRiseFallAutoTick();
        handleHedgeTick();
        handleBulkRfTick();
        handleFlipTick();
        handleBeastTick();

        if (isBulkOver2Armed && !bulkOver2Cooldown) {
            const isDoubleMode = triggerModeOver2Select && triggerModeOver2Select.value === 'double';
            if (isDoubleMode) {
                const digitA = parseInt(triggerDigitOver2Input.value, 10);
                const digitB = parseInt(triggerDigit2Over2Input.value, 10);
                if (matchConsecutivePair(recentDigitHistory, digitA, digitB)) {
                    fireBulkOver2Batch();
                    recentDigitHistory = [];
                }
            } else {
                const triggerDigit = parseInt(triggerDigitOver2Input.value, 10);
                if (lastDigit === triggerDigit) {
                    fireBulkOver2Batch();
                }
            }
        }

        if (isAutoTradingEO) {
            const isEven = lastDigit % 2 === 0;
            const selectedMode = strategyModeEO.value;
            if ((selectedMode === "DIGITEVEN" && isEven) || (selectedMode === "DIGITODD" && !isEven)) {
                executeContractEO();
            }
        }
        else if (isAutoTradingOU && !autoBulkCooldown) {
            const usePatternTriggerOU = patternTriggerOUCheckbox && patternTriggerOUCheckbox.checked;
            let ouShouldFire = true;

            if (usePatternTriggerOU) {
                const overDigit = parseInt(predOverInput.value, 10);
                const underDigit = parseInt(predUnderInput.value, 10);
                ouShouldFire = matchOUTriggerPair(recentDigitHistory, overDigit, underDigit);
                if (ouShouldFire) {
                    ouPatternMatchLabel = `${recentDigitHistory[0]} \u2192 ${recentDigitHistory[1]}`;
                    recentDigitHistory = [];
                }
            }

            if (ouShouldFire) {
                // A single fire now sends the whole batch of Over/Under pairs on this tick, so just fire once and stop.
                executeBulkOverUnderPair();

                const durationTicks = parseInt(tradeDurationOU.value, 10);
                autoBulkCooldown = true;
                btnBuyOU.disabled = true;

                setTimeout(() => {
                    autoBulkCooldown = false;
                    if (!isAutoTradingOU) btnBuyOU.disabled = false;
                }, (durationTicks * 2000) + 1200);

                logToConsole(usePatternTriggerOU
                    ? `[Bulk Auto Triggered] Pattern matched (${ouPatternMatchLabel}) \u2014 firing full pair batch on this tick...`
                    : `[Bulk Auto Triggered] Firing full pair batch on this tick...`, "system-msg");

                const useLoopModeOU = loopUntilTargetOUCheckbox && loopUntilTargetOUCheckbox.checked;
                if (useLoopModeOU) {
                    ouLoopCycleCount++;
                    if (ouLoopCycleCountDisplay) ouLoopCycleCountDisplay.textContent = ouLoopCycleCount;
                    logToConsole(`[Loop Mode] Bulk OU cycle ${ouLoopCycleCount} fired. Continuing until session target is hit...`, "system-msg");
                    // Stay armed - isAutoTradingOU remains true, so the next qualifying tick fires again.
                    // haltAllAutoModes() will call toggleAutoOU(false) automatically once the session target is reached.
                } else {
                    toggleAutoOU(false);
                }
            }
        }

        else if (isAutoTradingOUD && !autoBulkCooldownOUD) {
            // Same pattern as Bulk Over/Under: fire the whole pair batch once on this tick, then auto-stop.
            executeBulkOnlyUpsDownsPair();

            const durationTicksOUD = Math.max(2, parseInt(tradeDurationOUD.value, 10) || 2);
            autoBulkCooldownOUD = true;
            btnBuyOUD.disabled = true;

            setTimeout(() => {
                autoBulkCooldownOUD = false;
                if (!isAutoTradingOUD) btnBuyOUD.disabled = false;
            }, (durationTicksOUD * 2000) + 1200);

            logToConsole(`[Bulk Auto Triggered] Firing full Only Ups/Only Downs pair batch on this tick...`, "system-msg");

            const useLoopModeOUD = loopUntilTargetOUDCheckbox && loopUntilTargetOUDCheckbox.checked;
            if (useLoopModeOUD) {
                oudLoopCycleCount++;
                if (oudLoopCycleCountDisplay) oudLoopCycleCountDisplay.textContent = oudLoopCycleCount;
                logToConsole(`[Loop Mode] Bulk OUD cycle ${oudLoopCycleCount} fired. Continuing until session target is hit...`, "system-msg");
            } else {
                toggleAutoOUD(false);
            }
        }
    }

    // --- COLD PATH: pure display work, safe to run after the trade is sent.
    liveTickValue.textContent = priceString;
    liveDigitValue.textContent = lastDigit;
    updateHedgeSignalUI();
    pkRenderOnTick();
    if (patternDigitHistoryDisplay) {
        patternDigitHistoryDisplay.textContent = recentDigitHistory.join(' ') || '--';
    }
    if (po18DigitHistoryDisplay) {
        po18DigitHistoryDisplay.textContent = recentDigitHistoryPO18.join(' ') || '--';
    }
    if (ouPatternDigitHistoryDisplay && isAutoTradingOU && patternTriggerOUCheckbox && patternTriggerOUCheckbox.checked) {
        ouPatternDigitHistoryDisplay.textContent = recentDigitHistory.join(' ') || '--';
    }
    if (ouPatternMatchLabel && ouPatternLastMatchDisplay) {
        ouPatternLastMatchDisplay.textContent = `${ouPatternMatchLabel} @ ${new Date().toLocaleTimeString()}`;
        ouPatternMatchLabel = null;
    }
    if (stopAutoPOU) {
        logToConsole(`[Pattern OU] Max trade cap reached (${totalTradesExecutedPOU}/${parseInt(maxTradesPOUInput.value, 10) || 10}). Stopping execution.`, "system-msg");
        toggleAutoPOU(false);
    }
    if (patternFired && patternMatch) {
        logToConsole(`[Pattern OU] Detected pattern -> firing ${patternMatch.label}`, "success-msg");
        if (patternLastMatchDisplay) patternLastMatchDisplay.textContent = `${patternMatch.label} @ ${new Date().toLocaleTimeString()}`;
    }
}

// --- CONTRACT ORDER PLACEMENT CONTROLLERS ---
function executeContractEO() {
    if (isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    if (!optionsWebSocket) return;
    const symbol = marketDropdown.value;
    const stake = parseFloat(tradeStakeEO.value);
    
    const payload = {
        "buy": "1",
        "price": stake,
        "subscribe": 1,
        "parameters": {
            "amount": stake,
            "basis": "stake",
            "contract_type": strategyModeEO.value,
            "currency": currencyText.textContent || "USD",
            "duration": parseInt(tradeDurationEO.value, 10),
            "duration_unit": "t",
            "underlying_symbol": symbol
        }
    };
    logToConsole(`Sending EO Order: $${stake}...`);
    optionsWebSocket.send(JSON.stringify(payload));
}

function executeBulkOverUnderPair() {
    if (isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) {
        logToConsole("Error: Real-time stream must be connected before running trades.", "error-msg");
        return;
    }
    
    const symbol = marketDropdown.value;
    const stake = parseFloat(tradeStakeOU.value);
    const duration = parseInt(tradeDurationOU.value, 10);
    const currency = currencyText.textContent || "USD";
    
    const overDigit = predOverInput.value.toString();
    const underDigit = predUnderInput.value.toString();
    const batchSize = parseInt(maxTradesOUInput.value, 10) || 1; // Max Trades Run Cap now doubles as "repeat the pair this many times on this same tick", same pattern as Bulk Over 2's contracts-per-trigger
    const bulkRunToken = "BULK_" + Date.now();
    challengeBatchExpectedCounts[bulkRunToken] = batchSize * 2;
    batchSyncExpected[bulkRunToken] = batchSize * 2;

    // Serialize each side once; the hot loop below is nothing but socket sends.
    const buildPayload = (contractType, barrier) => JSON.stringify({
        "buy": 1,
        "price": stake,
        "subscribe": 1,
        "parameters": {
            "amount": stake,
            "basis": "stake",
            "contract_type": contractType,
            "currency": currency,
            "duration": duration,
            "duration_unit": "t",
            "underlying_symbol": symbol,
            "barrier": barrier
        },
        "passthrough": { "bulkRunId": bulkRunToken }
    });
    const overPayload = buildPayload("DIGITOVER", overDigit);
    const underPayload = buildPayload("DIGITUNDER", underDigit);

    const sendStart = performance.now();
    for (let i = 0; i < batchSize; i++) {
        optionsWebSocket.send(overPayload);
        optionsWebSocket.send(underPayload);
    }
    const sendMs = (performance.now() - sendStart).toFixed(1);

    totalTradesExecutedOU += batchSize * 2;

    logToConsole(`[${bulkRunToken}] Fired ${batchSize} pairs: Over ${overDigit} + Under ${underDigit} (${batchSize * 2} contracts) on this tick. (send loop ${sendMs} ms)`, "success-msg");
}

function executeBulkOnlyUpsDownsPair() {
    if (isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) {
        logToConsole("Error: Real-time stream must be connected before running trades.", "error-msg");
        return;
    }

    const symbol = marketDropdown.value;
    const stake = parseFloat(tradeStakeOUD.value);
    const requestedDuration = parseInt(tradeDurationOUD.value, 10);
    const duration = Math.max(2, requestedDuration || 2); // Only Ups/Only Downs minimum is 2 ticks
    if (duration !== requestedDuration) {
        logToConsole(`[OUD] Duration set to ${duration} ticks (minimum for Only Ups/Only Downs).`, "system-msg");
    }
    const currency = currencyText.textContent || "USD";
    const batchSize = parseInt(maxTradesOUDInput.value, 10) || 1;
    const bulkRunToken = "BULK_OUD_" + Date.now();
    challengeBatchExpectedCounts[bulkRunToken] = batchSize * 2;
    batchSyncExpected[bulkRunToken] = batchSize * 2;

    // Serialize each side once; the hot loop below is nothing but socket sends.
    const buildPayload = (contractType) => JSON.stringify({
        "buy": 1,
        "price": stake,
        "subscribe": 1,
        "parameters": {
            "amount": stake,
            "basis": "stake",
            "contract_type": contractType,
            "currency": currency,
            "duration": duration,
            "duration_unit": "t",
            "underlying_symbol": symbol
        },
        "passthrough": { "bulkRunId": bulkRunToken }
    });
    const highPayload = buildPayload("RUNHIGH");
    const lowPayload = buildPayload("RUNLOW");

    const sendStart = performance.now();
    for (let i = 0; i < batchSize; i++) {
        optionsWebSocket.send(highPayload);
        optionsWebSocket.send(lowPayload);
    }
    const sendMs = (performance.now() - sendStart).toFixed(1);

    totalTradesExecutedOUD += batchSize * 2;

    logToConsole(`[${bulkRunToken}] Fired ${batchSize} Only Ups/Only Downs pairs (${batchSize * 2} contracts) on this tick. (send loop ${sendMs} ms)`, "success-msg");
}

function executePatternOverUnder(match) {
    if (isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) {
        logToConsole("Error: Real-time stream must be connected before running trades.", "error-msg");
        return;
    }

    const symbol = marketDropdown.value;
    const stake = parseFloat(tradeStakePOU.value);
    const duration = parseInt(tradeDurationPOU.value, 10);
    const currency = currencyText.textContent || "USD";
    const bulkRunToken = "PATTERN_OU_" + Date.now();
    challengeBatchExpectedCounts[bulkRunToken] = 1;

    const payload = {
        "buy": 1,
        "price": stake,
        "subscribe": 1,
        "parameters": {
            "amount": stake,
            "basis": "stake",
            "contract_type": match.contract_type,
            "currency": currency,
            "duration": duration,
            "duration_unit": "t",
            "underlying_symbol": symbol,
            "barrier": match.barrier
        },
        "passthrough": { "bulkRunId": bulkRunToken }
    };

    optionsWebSocket.send(JSON.stringify(payload));
    totalTradesExecutedPOU += 1;
    logToConsole(`[Pattern OU Run Status]: ${totalTradesExecutedPOU} / ${maxTradesPOUInput.value} contracts executed.`);
    patternCooldown = true;
}

btnToggleAutoPOU.addEventListener('click', () => toggleAutoPOU(!isAutoTradingPOU));
function toggleAutoPOU(state) {
    if (state && isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    isAutoTradingPOU = state;
    btnToggleAutoPOU.textContent = state ? "Stop Pattern Auto-Mode" : "Start Pattern Auto-Mode";
    btnToggleAutoPOU.classList.toggle('stream-active', state);

    tradeStakePOU.disabled = state;
    tradeDurationPOU.disabled = state;
    maxTradesPOUInput.disabled = state;

    if (state) {
        patternCooldown = false;
        totalTradesExecutedPOU = 0;
        recentDigitHistory = [];
        if (patternLastMatchDisplay) patternLastMatchDisplay.textContent = "None";
        logToConsole(`Pattern Auto-Mode Started. Cap Target: ${maxTradesPOUInput.value} trades. Watching for 2/0 and 7/9 sequences...`, "success-msg");
    } else {
        logToConsole("Pattern Auto-Mode Stopped.");
    }
}

// --- PATTERN OVER 1 / UNDER 8 ---
// The same digit twice in a row: 0,0 or 1,1 -> Over 1.   8,8 or 9,9 -> Under 8.
const btnToggleAutoPO18 = document.getElementById('btn-toggle-auto-po18');
const tradeStakePO18 = document.getElementById('trade-stake-po18');
const tradeDurationPO18 = document.getElementById('trade-duration-po18');
const maxTradesPO18Input = document.getElementById('max-trades-po18');
const po18DigitHistoryDisplay = document.getElementById('po18-digit-history');
const po18LastMatchDisplay = document.getElementById('po18-last-match');

const DIGIT_PATTERNS_O1U8 = [
    { digits: [0, 1], contract_type: 'DIGITOVER', barrier: '1', label: 'Over 1 (0,0 or 1,1 pattern)' },
    { digits: [8, 9], contract_type: 'DIGITUNDER', barrier: '8', label: 'Under 8 (8,8 or 9,9 pattern)' }
];

function matchDigitPatternO1U8(history) {
    if (history.length < 2) return null;
    const [a, b] = history;
    // Both ticks must be the SAME digit, and that digit must be one of the pattern's digits.
    if (a !== b) return null;
    return DIGIT_PATTERNS_O1U8.find(p => p.digits.includes(a)) || null;
}

function handlePatternO1U8Tick() {
    if (!isAutoTradingPO18 || patternO1U8Cooldown) return;

    const maxAllowed = parseInt(maxTradesPO18Input.value, 10) || 10;
    if (totalTradesExecutedPO18 + 1 > maxAllowed) {
        logToConsole(`[Pattern O1U8] Max trade cap reached (${totalTradesExecutedPO18}/${maxAllowed}). Stopping execution.`, "system-msg");
        toggleAutoPO18(false);
        return;
    }

    const match = matchDigitPatternO1U8(recentDigitHistoryPO18);
    if (!match) return;

    executePatternO1U8(match);
    recentDigitHistoryPO18 = [];
    logToConsole(`[Pattern O1U8] Detected pattern -> firing ${match.label}`, "success-msg");
    if (po18LastMatchDisplay) po18LastMatchDisplay.textContent = `${match.label} @ ${new Date().toLocaleTimeString()}`;
}

function executePatternO1U8(match) {
    if (isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) {
        logToConsole("Error: Real-time stream must be connected before running trades.", "error-msg");
        return;
    }

    const symbol = marketDropdown.value;
    const stake = parseFloat(tradeStakePO18.value);
    const duration = parseInt(tradeDurationPO18.value, 10) || 1;
    const currency = currencyText.textContent || "USD";
    const bulkRunToken = "PATTERN_O1U8_" + Date.now();
    challengeBatchExpectedCounts[bulkRunToken] = 1;

    optionsWebSocket.send(JSON.stringify({
        "buy": 1,
        "price": stake,
        "subscribe": 1,
        "parameters": {
            "amount": stake,
            "basis": "stake",
            "contract_type": match.contract_type,
            "currency": currency,
            "duration": duration,
            "duration_unit": "t",
            "underlying_symbol": symbol,
            "barrier": match.barrier
        },
        "passthrough": { "bulkRunId": bulkRunToken }
    }));
    totalTradesExecutedPO18 += 1;
    logToConsole(`[Pattern O1U8 Run Status]: ${totalTradesExecutedPO18} / ${maxTradesPO18Input.value} contracts executed.`);
    patternO1U8Cooldown = true;
}

if (btnToggleAutoPO18) btnToggleAutoPO18.addEventListener('click', () => toggleAutoPO18(!isAutoTradingPO18));
function toggleAutoPO18(state) {
    if (!btnToggleAutoPO18) return;
    if (state && isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    isAutoTradingPO18 = state;
    btnToggleAutoPO18.textContent = state ? "Stop Over 1 / Under 8 Auto-Mode" : "Start Over 1 / Under 8 Auto-Mode";
    btnToggleAutoPO18.classList.toggle('stream-active', state);

    tradeStakePO18.disabled = state;
    tradeDurationPO18.disabled = state;
    maxTradesPO18Input.disabled = state;

    if (state) {
        patternO1U8Cooldown = false;
        totalTradesExecutedPO18 = 0;
        recentDigitHistoryPO18 = [];
        if (po18LastMatchDisplay) po18LastMatchDisplay.textContent = "None";
        logToConsole(`Over 1 / Under 8 Auto-Mode Started. Cap Target: ${maxTradesPO18Input.value} trades. Watching for 0,0 / 1,1 (Over 1) and 8,8 / 9,9 (Under 8)...`, "success-msg");
    } else {
        logToConsole("Over 1 / Under 8 Auto-Mode Stopped.");
    }
}

// --- RISE/FALL SIGNAL ---
// Real OHLC candle chart (via ticks_history style=candles, live-updated via ohlc messages) plus
// a fast/slow SMA crossover filtered by RSI, computed on whichever timeframe is selected.
// CALL = Rise, PUT = Fall (per Deriv's own trade-rise-fall reference implementation and
// community API docs; note that developers.deriv.com/docs/risefall currently lists these two
// swapped, which looks like a documentation typo, so this has been double-checked against
// Deriv's own example code).
const rfChartCanvas = document.getElementById('rf-chart-canvas');
const rfChartCtx = rfChartCanvas ? rfChartCanvas.getContext('2d') : null;
const rfSignalBadge = document.getElementById('rf-signal-badge');
const rfLastPriceDisplay = document.getElementById('rf-last-price');
const rfSmaFastDisplay = document.getElementById('rf-sma-fast');
const rfSmaSlowDisplay = document.getElementById('rf-sma-slow');
const rfRsiDisplay = document.getElementById('rf-rsi');
const rfChartIntervalSelect = document.getElementById('rf-chart-interval');
const rfSuggestionBanner = document.getElementById('rf-suggestion-banner');
const rfSuggestionText = document.getElementById('rf-suggestion-text');
const rfDurationLabel = document.getElementById('rf-duration-label');
const tradeDurationUnitRF = document.getElementById('trade-duration-unit-rf');
const tradeStakeRF = document.getElementById('trade-stake-rf');
const tradeDurationRF = document.getElementById('trade-duration-rf');
const maxTradesRFInput = document.getElementById('max-trades-rf');
const btnBuyRiseRF = document.getElementById('btn-buy-rise-rf');
const btnBuyFallRF = document.getElementById('btn-buy-fall-rf');
const btnToggleAutoRF = document.getElementById('btn-toggle-auto-rf');
const autoFollowSignalRF = document.getElementById('auto-follow-signal-rf');

let rfCurrentSignal = 'NEUTRAL';
let rfCandles = []; // {open, high, low, close, epoch}, ascending by time, only used in candle modes

// ===== PRICE-ACTION ENGINE =====
// The signal is no longer an SMA crossover. It reads the chart: swing structure (HH/HL vs LH/LL),
// support/resistance clustered from swing pivots, candlestick patterns on closed candles, the
// candle that is forming right now (how far from its open, how many ticks in, odds it closes up),
// and tick momentum. Each factor adds or subtracts points; the signal only fires when the
// points agree strongly enough (your "Min confluence" bar). Mixed readings = NEUTRAL (stand aside).
// A live scorecard grades every signal against what price actually did, so the engine is measured, not trusted.
const RF_ANALYSIS_TICKS = 600;
const RF_MIN_CLOSED_CANDLES = 12;
let rfTicks = [];                 // {p, t}: every tick since this market/timeframe was picked
let rfTickSeq = 0;
let rfAnalysis = { ready: false };
let rfPending = null;             // signal currently being graded by the scorecard
let rfScore = { w: 0, l: 0, recent: [] };
let rfPrevSignal = 'NEUTRAL';

const rfEl = (id) => document.getElementById(id);
const rfMinConfInput = rfEl('rf-min-conf');
const rfClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function rfFmt(v) {
    const d = (marketDropdown && learnedDecimals[marketDropdown.value]) || 2;
    return Number(v).toFixed(d);
}

// --- indicator math ---
function sma(values, period) {
    if (values.length < period) return null;
    const slice = values.slice(values.length - period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function rsi(values, period) {
    if (values.length < period + 1) return null;
    const slice = values.slice(values.length - period - 1);
    let gains = 0, losses = 0;
    for (let i = 1; i < slice.length; i++) {
        const delta = slice[i] - slice[i - 1];
        if (delta >= 0) gains += delta; else losses -= delta;
    }
    if (gains === 0 && losses === 0) return 50;
    if (losses === 0) return 100;
    const rs = (gains / period) / (losses / period);
    return 100 - (100 / (1 + rs));
}

function rfEma(values, period) {
    if (values.length < period) return null;
    const k = 2 / (period + 1);
    let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
    return e;
}

function rfAtr(candles, period) {
    if (candles.length < 2) return 0;
    const n = Math.min(period, candles.length - 1);
    let sum = 0;
    for (let i = candles.length - n; i < candles.length; i++) {
        const c = candles[i], pc = candles[i - 1].close;
        sum += Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
    }
    return sum / n;
}

function rfNormCdf(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
}

// --- swing pivots: a high/low that beats `k` neighbours on each side ---
function rfFindPivots(candles, k) {
    const piv = [];
    for (let i = k; i < candles.length - k; i++) {
        let isH = true, isL = true;
        for (let j = 1; j <= k; j++) {
            if (!(candles[i].high > candles[i - j].high && candles[i].high >= candles[i + j].high)) isH = false;
            if (!(candles[i].low < candles[i - j].low && candles[i].low <= candles[i + j].low)) isL = false;
        }
        if (isH) piv.push({ i, price: candles[i].high, type: 'H' });
        if (isL) piv.push({ i, price: candles[i].low, type: 'L' });
    }
    return piv;
}

// --- support/resistance: swing prices that keep landing in the same zone become one level ---
function rfClusterLevels(pivots, tol) {
    const levels = [];
    pivots.slice().sort((a, b) => a.price - b.price).forEach(p => {
        const last = levels[levels.length - 1];
        if (last && p.price - last.max <= tol) { last.sum += p.price; last.n++; last.max = p.price; }
        else levels.push({ sum: p.price, n: 1, max: p.price });
    });
    return levels.map(l => ({ price: l.sum / l.n, touches: l.n }));
}

function rfPickLevel(levels, price, above, atrVal) {
    const cand = levels.filter(l => above ? l.price > price : l.price < price);
    if (!cand.length) return null;
    cand.sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price));
    const l = cand[0];
    return { price: l.price, touches: l.touches, distAtr: Math.abs(l.price - price) / atrVal };
}

// --- market structure: are swing highs/lows stepping up, stepping down, or going nowhere? ---
function rfStructure(pivots, atrVal, closed) {
    const hs = pivots.filter(p => p.type === 'H'), ls = pivots.filter(p => p.type === 'L');
    if (hs.length < 2 || ls.length < 2) return { state: 'UNKNOWN', label: 'Not enough swings yet', bos: 0 };
    const tol = atrVal * 0.1;
    const sign = (a, b) => a > b + tol ? 1 : a < b - tol ? -1 : 0;
    const hS = sign(hs[hs.length - 1].price, hs[hs.length - 2].price);
    const lS = sign(ls[ls.length - 1].price, ls[ls.length - 2].price);
    let state = 'RANGE', label = 'Sideways \u2014 swings are mixed';
    if (hS >= 0 && lS >= 0 && hS + lS > 0) {
        state = 'BULL';
        label = (hS > 0 && lS > 0) ? 'Bullish \u2014 higher highs & higher lows' : 'Bullish \u2014 swings stepping up';
    } else if (hS <= 0 && lS <= 0 && hS + lS < 0) {
        state = 'BEAR';
        label = (hS < 0 && lS < 0) ? 'Bearish \u2014 lower highs & lower lows' : 'Bearish \u2014 swings stepping down';
    }
    const lastClose = closed[closed.length - 1].close;
    let bos = 0;
    if (lastClose > hs[hs.length - 1].price) bos = 1;
    else if (lastClose < ls[ls.length - 1].price) bos = -1;
    return { state, label, bos };
}

// --- candlestick pattern on the last CLOSED candle ---
function rfPattern(closed, atrVal) {
    if (closed.length < 2) return null;
    const c = closed[closed.length - 1], p = closed[closed.length - 2];
    const body = Math.abs(c.close - c.open), range = c.high - c.low;
    if (range <= 0) return null;
    const upper = c.high - Math.max(c.open, c.close), lower = Math.min(c.open, c.close) - c.low;
    const cUp = c.close > c.open, pUp = p.close > p.open, pBody = Math.abs(p.close - p.open);
    if (cUp && !pUp && pBody > 0 && c.close >= p.open && c.open <= p.close && body > pBody)
        return { name: 'Bullish engulfing', dir: 1, strength: 1 };
    if (!cUp && pUp && pBody > 0 && c.close <= p.open && c.open >= p.close && body > pBody)
        return { name: 'Bearish engulfing', dir: -1, strength: 1 };
    if (body / range <= 0.35 && lower >= 2 * Math.max(body, range * 0.05) && upper <= range * 0.2)
        return { name: 'Hammer (lows rejected)', dir: 1, strength: 0.8 };
    if (body / range <= 0.35 && upper >= 2 * Math.max(body, range * 0.05) && lower <= range * 0.2)
        return { name: 'Shooting star (highs rejected)', dir: -1, strength: 0.8 };
    if (body / range <= 0.1) return { name: 'Doji (indecision)', dir: 0, strength: 0 };
    if (body / range >= 0.8 && body >= 0.8 * atrVal)
        return { name: cUp ? 'Strong bullish candle' : 'Strong bearish candle', dir: cUp ? 1 : -1, strength: 0.7 };
    return { name: cUp ? 'Plain bullish candle' : 'Plain bearish candle', dir: 0, strength: 0 };
}

// --- tick-level reads ---
function rfTickMomentum() {
    let streak = 0, dir = 0;
    for (let i = rfTicks.length - 1; i > 0; i--) {
        const d = rfTicks[i].p - rfTicks[i - 1].p;
        const s = d > 0 ? 1 : d < 0 ? -1 : 0;
        if (s === 0) break;
        if (dir === 0) dir = s;
        if (s !== dir) break;
        streak++;
    }
    return { streak, dir };
}

function rfAvgSwingTicks() {
    const pseudo = rfTicks.slice(-200).map(t => ({ high: t.p, low: t.p }));
    const idx = rfFindPivots(pseudo, 2).map(p => p.i).sort((x, y) => x - y);
    if (idx.length < 3) return 6;
    return (idx[idx.length - 1] - idx[0]) / (idx.length - 1);
}

function rfAvgRun(closed) {
    const runs = [];
    let cur = 0, dir = 0;
    closed.forEach(c => {
        const d = c.close >= c.open ? 1 : -1;
        if (d === dir) cur++; else { if (cur) runs.push(cur); cur = 1; dir = d; }
    });
    if (cur) runs.push(cur);
    return runs.length ? runs.reduce((a, b) => a + b, 0) / runs.length : 1;
}

// --- the candle that is forming right now ---
// pUp is the exact random-walk answer to "given how far it has moved and how much time is left,
// how likely is it to close above its open?" - it rises toward 100% as the candle matures.
function rfForming(forming, atrVal, granSec) {
    const nowT = rfTicks[rfTicks.length - 1].t;
    const elapsed = rfClamp(nowT - forming.epoch, 0, granSec);
    const recent = rfTicks.slice(-61);
    let sq = 0;
    for (let i = 1; i < recent.length; i++) sq += Math.pow(recent[i].p - recent[i - 1].p, 2);
    const sigma = recent.length > 1 ? Math.sqrt(sq / (recent.length - 1)) : 0;
    const interval = recent.length > 1 ? (recent[recent.length - 1].t - recent[0].t) / (recent.length - 1) : 2;
    const remainingTicks = interval > 0 ? (granSec - elapsed) / interval : 0;
    const disp = forming.close - forming.open;
    let pUp;
    if (remainingTicks < 0.5 || sigma <= 0) pUp = disp > 0 ? 1 : disp < 0 ? 0 : 0.5;
    else pUp = rfNormCdf(disp / (sigma * Math.sqrt(remainingTicks)));
    const ticks = rfTicks.filter(t => t.t >= forming.epoch).length;
    return { open: forming.open, disp, dispAtr: disp / atrVal, elapsed, elapsedFrac: elapsed / granSec, ticks, pUp };
}

function rfGranularity() {
    const m = currentRfMode();
    return m === 'ticks' ? 60 : parseInt(m, 10);
}

// How long to hold: tick view = about one typical tick swing; candle view = the typical run of same-coloured candles.
function rfHold(closed, mode) {
    if (mode === 'ticks') {
        const n = rfClamp(Math.round(rfAvgSwingTicks()), 5, 10);
        return { value: n, unit: 't', text: `${n} ticks (about one typical swing)` };
    }
    const gm = Math.max(1, Math.round(parseInt(mode, 10) / 60));
    const run = rfClamp(Math.round(rfAvgRun(closed.slice(-30))), 1, 5);
    const mins = Math.min(60, run * gm);
    return { value: mins, unit: 'm', text: `${mins} minute${mins === 1 ? '' : 's'} (about ${run} candle${run === 1 ? '' : 's'})` };
}

function rfAnalyze() {
    const mode = currentRfMode();
    const granSec = rfGranularity();
    const closed = rfCandles.slice(0, -1);
    if (closed.length < RF_MIN_CLOSED_CANDLES || rfTicks.length < 8) return { ready: false, have: closed.length };

    const formingCandle = rfCandles[rfCandles.length - 1];
    const price = rfTicks[rfTicks.length - 1].p;
    const atrVal = Math.max(rfAtr(closed, 14), price * 1e-7);

    const piv = rfFindPivots(closed, 2);
    const struct = rfStructure(piv, atrVal, closed);
    const levels = rfClusterLevels(piv, atrVal * 0.25);
    const res = rfPickLevel(levels, price, true, atrVal);
    const sup = rfPickLevel(levels, price, false, atrVal);
    const closes = closed.map(c => c.close).concat(price);
    const e9 = rfEma(closes, 9), e21 = rfEma(closes, 21);
    const pat = rfPattern(closed, atrVal);
    const fc = rfForming(formingCandle, atrVal, granSec);
    const mom = rfTickMomentum();

    let score = 0;
    const reasons = [];
    const add = (pts, text) => { if (pts) { score += pts; reasons.push({ pts, text }); } };

    if (struct.state === 'BULL') add(25, 'Structure is bullish (swings stepping up)');
    else if (struct.state === 'BEAR') add(-25, 'Structure is bearish (swings stepping down)');
    if (struct.bos === 1) add(8, 'Last close broke above the latest swing high');
    if (struct.bos === -1) add(-8, 'Last close broke below the latest swing low');
    if (e9 !== null && e21 !== null) {
        if (e9 > e21 && price > e21) add(12, 'Price above a rising EMA 9/21');
        else if (e9 < e21 && price < e21) add(-12, 'Price below a falling EMA 9/21');
    }
    if (sup && sup.distAtr <= 0.6) add(10, `Sitting on support ${rfFmt(sup.price)}`);
    if (res && res.distAtr <= 0.6) add(-10, `Pressing into resistance ${rfFmt(res.price)}`);
    if (pat && pat.dir) {
        const atLevel = (pat.dir > 0 && sup && sup.distAtr <= 0.8) || (pat.dir < 0 && res && res.distAtr <= 0.8);
        add(pat.dir * Math.round(10 * pat.strength * (atLevel ? 1.5 : 1)), pat.name + (atLevel ? ' at a key level' : ''));
    }
    const fcPts = rfClamp(Math.round(fc.dispAtr * 10 * (0.5 + 0.5 * fc.elapsedFrac)), -10, 10);
    if (Math.abs(fcPts) >= 2) add(fcPts, `Forming candle is ${fcPts > 0 ? 'up' : 'down'} ${Math.abs(fc.dispAtr).toFixed(2)} ATR from its open`);
    if (mom.streak >= 2) add(mom.dir * Math.min(8, 2 + mom.streak * 2), `${mom.streak} ${mom.dir > 0 ? 'up' : 'down'}-ticks in a row`);

    // room to run: a trade into a wall that is close is a worse trade
    if (score > 0 && res && res.distAtr > 0.6 && res.distAtr < 1.2) add(-6, 'Resistance is close overhead \u2014 little room to run');
    if (score < 0 && sup && sup.distAtr > 0.6 && sup.distAtr < 1.2) add(6, 'Support is close below \u2014 little room to fall');

    const minConf = rfClamp(parseFloat(rfMinConfInput && rfMinConfInput.value) || 50, 10, 95);
    const conf = Math.min(100, Math.round(Math.abs(score) / 70 * 100));
    let signal = 'NEUTRAL';
    let note = `No clear edge \u2014 stand aside (confluence ${conf}% is under your ${minConf}% bar)`;
    if (conf >= minConf) {
        signal = score > 0 ? 'RISE' : 'FALL';
        note = '';
        if (mom.streak >= 3 && mom.dir === -Math.sign(score)) {
            signal = 'NEUTRAL';
            note = 'Waiting \u2014 ticks are running hard against the setup';
        }
    }
    return {
        ready: true, signal, note, score, conf, minConf, reasons, struct, res, sup, pat, fc, mom, levels, piv,
        price, atr: atrVal, granSec, hold: rfHold(closed, mode)
    };
}

// --- scorecard: grade each fresh signal against what price really did over its suggested hold ---
function trackRfSignal(a) {
    if (!a.ready) return;
    if ((a.signal === 'RISE' || a.signal === 'FALL') && a.signal !== rfPrevSignal && !rfPending) {
        const last = rfTicks[rfTicks.length - 1];
        rfPending = { dir: a.signal, entry: last.p, t: last.t, seq: rfTickSeq, unit: a.hold.unit, n: a.hold.value };
        renderRfScorecard();
    }
    rfPrevSignal = a.signal;
}

function resolveRfPending() {
    if (!rfPending) return;
    const last = rfTicks[rfTicks.length - 1];
    const done = rfPending.unit === 't' ? (rfTickSeq - rfPending.seq >= rfPending.n) : (last.t - rfPending.t >= rfPending.n * 60);
    if (!done) return;
    const won = rfPending.dir === 'RISE' ? last.p > rfPending.entry : last.p < rfPending.entry; // a flat finish loses, like the real contract
    if (won) rfScore.w++; else rfScore.l++;
    rfScore.recent.unshift(won);
    if (rfScore.recent.length > 12) rfScore.recent.pop();
    rfPending = null;
    renderRfScorecard();
}

function renderRfScorecard() {
    const el = rfEl('rf-scorecard');
    if (!el) return;
    const n = rfScore.w + rfScore.l;
    let text = n
        ? `${rfScore.w} won / ${rfScore.l} lost (${Math.round(rfScore.w / n * 100)}% of ${n}) \u00b7 break-even is roughly 52% \u00b7 ${rfScore.recent.map(w => w ? '\u2713' : '\u2717').join(' ')}`
        : 'No signals graded yet';
    if (n > 0 && n < 30) text += ' \u00b7 too few to trust yet';
    if (rfPending) text += ` \u00b7 grading ${rfPending.dir} (${rfPending.n}${rfPending.unit === 't' ? ' ticks' : ' min'})`;
    el.textContent = text;
}

// --- UI: the "market read" panel ---
function renderRfMarketRead(a) {
    const set = (id, text, cls) => {
        const el = rfEl(id);
        if (!el) return;
        el.textContent = text;
        if (cls !== undefined) el.className = cls;
    };
    if (!a.ready) {
        ['rf-structure', 'rf-resistance', 'rf-support', 'rf-pattern', 'rf-forming', 'rf-close-proj', 'rf-tick-mom']
            .forEach(id => set(id, '--', 'system-msg'));
        set('rf-conf-text', 'Warming up\u2026', 'system-msg');
        const fill = rfEl('rf-conf-fill'); if (fill) fill.style.width = '0%';
        const ul = rfEl('rf-reasons'); if (ul) ul.innerHTML = '';
        return;
    }
    const S = a.struct;
    const arrow = S.state === 'BULL' ? '\u25B2 ' : S.state === 'BEAR' ? '\u25BC ' : '\u2194 ';
    const bos = S.bos > 0 ? ' \u00b7 last close is above the latest swing high' : S.bos < 0 ? ' \u00b7 last close is below the latest swing low' : '';
    set('rf-structure', arrow + S.label + bos, S.state === 'BULL' ? 'success-msg' : S.state === 'BEAR' ? 'error-msg' : 'system-msg');
    set('rf-resistance', a.res ? `${rfFmt(a.res.price)} \u00b7 ${a.res.distAtr.toFixed(1)} ATR above \u00b7 ${a.res.touches} touch${a.res.touches === 1 ? '' : 'es'}` : 'None overhead \u2014 price is at the top of the range', 'error-msg');
    set('rf-support', a.sup ? `${rfFmt(a.sup.price)} \u00b7 ${a.sup.distAtr.toFixed(1)} ATR below \u00b7 ${a.sup.touches} touch${a.sup.touches === 1 ? '' : 'es'}` : 'None below \u2014 price is at the bottom of the range', 'success-msg');
    set('rf-pattern', a.pat ? a.pat.name : '--', a.pat && a.pat.dir > 0 ? 'success-msg' : a.pat && a.pat.dir < 0 ? 'error-msg' : 'system-msg');

    const f = a.fc, candleLabel = `${Math.round(a.granSec / 60) || 1}m candle`;
    set('rf-forming', `${candleLabel} \u00b7 ${Math.round(f.elapsed)}s of ${a.granSec}s \u00b7 ${f.ticks} ticks in \u00b7 ${f.disp >= 0 ? '\u25B2' : '\u25BC'} ${Math.abs(f.dispAtr).toFixed(2)} ATR from open`, f.disp > 0 ? 'success-msg' : f.disp < 0 ? 'error-msg' : 'system-msg');
    const pctUp = Math.round(f.pUp * 100);
    set('rf-close-proj', f.pUp >= 0.5 ? `\u25B2 ${pctUp}% to close above its open` : `\u25BC ${100 - pctUp}% to close below its open`, f.pUp >= 0.5 ? 'success-msg' : 'error-msg');

    const m = a.mom;
    if (m.streak >= 2) {
        set('rf-tick-mom', `${m.dir > 0 ? '\u25B2' : '\u25BC'} ${m.streak} ${m.dir > 0 ? 'up' : 'down'}-ticks in a row \u2014 short-term lean ${m.dir > 0 ? 'UP' : 'DOWN'}`, m.dir > 0 ? 'success-msg' : 'error-msg');
    } else {
        set('rf-tick-mom', 'No 2-tick run yet \u2014 no short-term lean', 'system-msg');
    }

    const bull = a.score > 0;
    const side = a.score === 0 ? 'neutral' : bull ? 'bullish' : 'bearish';
    set('rf-conf-text', `${a.conf}% ${side} (${a.minConf}% needed to signal)`, a.score === 0 ? 'system-msg' : bull ? 'success-msg' : 'error-msg');
    const fill = rfEl('rf-conf-fill');
    if (fill) {
        fill.style.width = a.conf + '%';
        fill.style.background = bull ? 'var(--accent-green)' : 'var(--accent-red)';
    }
    const ul = rfEl('rf-reasons');
    if (ul) {
        ul.innerHTML = '';
        a.reasons.forEach(r => {
            const li = document.createElement('li');
            li.className = r.pts > 0 ? 'up' : 'down';
            li.textContent = `${r.pts > 0 ? '+' : ''}${r.pts}  ${r.text}`;
            ul.appendChild(li);
        });
    }
}

function currentRfMode() {
    return rfChartIntervalSelect ? rfChartIntervalSelect.value : 'ticks'; // 'ticks' or a granularity in seconds (string)
}

function currentRfPrices() {
    return currentRfMode() === 'ticks' ? rfPriceHistory : rfCandles.map(c => c.close);
}

// --- suggested trade: direction + how long to hold (ticks in the tick view, minutes in a candle view) ---
function updateRfSuggestion(a) {
    if (!rfSuggestionBanner || !rfSuggestionText) return;
    if (!a.ready) { rfSuggestionBanner.style.display = 'none'; return; }
    rfSuggestionBanner.style.display = 'flex';
    if (a.signal !== 'RISE' && a.signal !== 'FALL') {
        rfSuggestionText.textContent = a.note;
        rfSuggestionText.className = 'system-msg';
        return;
    }
    // Auto-fill the trade controls; the person can still override either field before buying.
    if (tradeDurationRF) tradeDurationRF.value = a.hold.value;
    if (tradeDurationUnitRF) tradeDurationUnitRF.value = a.hold.unit;
    applyRfDurationUnitUI(a.hold.unit);
    rfSuggestionText.textContent = `${a.signal === 'RISE' ? 'Buy Rise' : 'Buy Fall'} \u2014 hold ${a.hold.text}`;
    rfSuggestionText.className = a.signal === 'RISE' ? 'success-msg' : 'error-msg';
}

function applyRfDurationUnitUI(unit) {
    if (!tradeDurationRF || !rfDurationLabel) return;
    if (unit === 't') {
        rfDurationLabel.textContent = 'Duration (Ticks):';
        tradeDurationRF.min = 5; tradeDurationRF.max = 10;
        tradeDurationRF.title = "Rise/Fall (CALL/PUT) contracts require a minimum of 5 ticks";
    } else {
        rfDurationLabel.textContent = 'Duration (Minutes):';
        tradeDurationRF.min = 1; tradeDurationRF.max = 60;
        tradeDurationRF.title = "Rise/Fall (CALL/PUT) minute contracts require a minimum of 1 minute";
    }
}
if (tradeDurationUnitRF) {
    tradeDurationUnitRF.addEventListener('change', (e) => applyRfDurationUnitUI(e.target.value));
}

function refreshRfIndicatorsAndSignal() {
    const prices = currentRfPrices();
    const fast = sma(prices, RF_FAST_PERIOD), slow = sma(prices, RF_SLOW_PERIOD), rsiVal = rsi(prices, RF_RSI_PERIOD);
    const a = rfAnalyze();
    rfAnalysis = a;
    rfCurrentSignal = a.ready ? a.signal : 'WARMING_UP';

    const lastPrice = rfTicks.length ? rfTicks[rfTicks.length - 1].p : null;
    if (rfLastPriceDisplay) rfLastPriceDisplay.textContent = lastPrice !== null ? String(lastPrice) : '--';
    if (rfSmaFastDisplay) rfSmaFastDisplay.textContent = fast !== null ? fast.toFixed(4) : '--';
    if (rfSmaSlowDisplay) rfSmaSlowDisplay.textContent = slow !== null ? slow.toFixed(4) : '--';
    if (rfRsiDisplay) rfRsiDisplay.textContent = rsiVal !== null ? rsiVal.toFixed(1) : '--';

    if (rfSignalBadge) {
        if (!a.ready) {
            rfSignalBadge.textContent = `Warming up\u2026 (${a.have || 0}/${RF_MIN_CLOSED_CANDLES} candles)`;
            rfSignalBadge.className = 'system-msg';
        } else if (a.signal === 'RISE') {
            rfSignalBadge.textContent = `\u2197 RISE (${a.conf}%)`;
            rfSignalBadge.className = 'success-msg';
        } else if (a.signal === 'FALL') {
            rfSignalBadge.textContent = `\u2198 FALL (${a.conf}%)`;
            rfSignalBadge.className = 'error-msg';
        } else {
            rfSignalBadge.textContent = '\u2194 NO TRADE';
            rfSignalBadge.className = 'system-msg';
        }
    }

    renderRfMarketRead(a);
    updateRfSuggestion(a);
    trackRfSignal(a);
    drawRfChart();
}

// Called on every raw tick in every chart mode: the micro read (tick streaks, forming-candle tick count)
// and the scorecard both need every tick. Wrapped so an engine error can never break the digit strategies.
function updateRiseFallSignal(price, epoch) {
    if (!price || isNaN(price)) return;
    if (rfPriceHistory.length === 0) { // market or timeframe was just (re)selected
        rfTicks = []; rfPending = null; rfPrevSignal = 'NEUTRAL';
        rfScore = { w: 0, l: 0, recent: [] };
        renderRfScorecard();
    }
    const t = Number.isFinite(epoch) && epoch > 0 ? epoch : Math.floor(Date.now() / 1000);
    rfPriceHistory.push(price);
    if (rfPriceHistory.length > RF_MAX_POINTS) rfPriceHistory.shift();
    rfTicks.push({ p: price, t });
    if (rfTicks.length > RF_ANALYSIS_TICKS) rfTicks.shift();
    rfTickSeq++;
    try {
        resolveRfPending();
        refreshRfIndicatorsAndSignal();
    } catch (err) {
        console.error('[Rise/Fall engine]', err);
    }
}

// --- candle subscription: always on (1m candles while the tick view is selected) so structure and S/R are always known ---
function maybeSetupRfCandles(symbolCode) {
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) return;
    optionsWebSocket.send(JSON.stringify({ "forget_all": ["candles"] }));
    rfCandles = [];
    optionsWebSocket.send(JSON.stringify({
        "ticks_history": symbolCode,
        "end": "latest",
        "style": "candles",
        "granularity": rfGranularity(),
        "count": 60,
        "subscribe": 1
    }));
}

function handleRfCandleHistory(candles) {
    if (!Array.isArray(candles)) return;
    rfCandles = candles.map(c => ({
        open: parseFloat(c.open), high: parseFloat(c.high), low: parseFloat(c.low),
        close: parseFloat(c.close), epoch: Number(c.epoch)
    }));
    try { refreshRfIndicatorsAndSignal(); } catch (err) { console.error('[Rise/Fall engine]', err); }
}

function handleRfOhlcUpdate(ohlc) {
    if (!ohlc) return;
    if (ohlc.granularity !== undefined && Number(ohlc.granularity) !== rfGranularity()) return; // stale subscription
    const openTime = Number(ohlc.open_time ?? ohlc.epoch);
    const candle = {
        open: parseFloat(ohlc.open), high: parseFloat(ohlc.high), low: parseFloat(ohlc.low),
        close: parseFloat(ohlc.close), epoch: openTime
    };
    const last = rfCandles[rfCandles.length - 1];
    if (last && last.epoch === openTime) {
        rfCandles[rfCandles.length - 1] = candle;
    } else {
        rfCandles.push(candle);
        if (rfCandles.length > 60) rfCandles.shift();
    }
    try { refreshRfIndicatorsAndSignal(); } catch (err) { console.error('[Rise/Fall engine]', err); }
}

if (rfChartIntervalSelect) {
    rfChartIntervalSelect.addEventListener('change', () => {
        rfPriceHistory = [];
        maybeSetupRfCandles(marketDropdown.value);
        if (rfSignalBadge) { rfSignalBadge.textContent = "Warming up\u2026"; rfSignalBadge.className = "system-msg"; }
        if (rfSuggestionBanner) rfSuggestionBanner.style.display = 'none';
    });
}

// --- chart rendering: candles/ticks + support & resistance + swing points + the open of the forming candle ---
function drawRfChart() {
    if (!rfChartCtx || !rfChartCanvas) return;
    const a = rfAnalysis || { ready: false };
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = rfChartCanvas.clientWidth || 300;
    const cssHeight = rfChartCanvas.clientHeight || 240;
    if (rfChartCanvas.width !== cssWidth * dpr || rfChartCanvas.height !== cssHeight * dpr) {
        rfChartCanvas.width = cssWidth * dpr;
        rfChartCanvas.height = cssHeight * dpr;
    }
    const ctx = rfChartCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const pad = { top: 12, right: 66, bottom: 10, left: 8 };
    const w = cssWidth - pad.left - pad.right;
    const h = cssHeight - pad.top - pad.bottom;

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 3; g++) {
        const gy = pad.top + (h / 3) * g;
        ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(pad.left + w, gy); ctx.stroke();
    }

    const css = getComputedStyle(document.documentElement);
    const greenColor = css.getPropertyValue('--accent-green').trim() || '#1fd8a4';
    const redColor = css.getPropertyValue('--accent-red').trim() || '#f2455f';

    const tickMode = currentRfMode() === 'ticks';
    const prices = rfPriceHistory;
    const candles = rfCandles;
    if (tickMode ? prices.length < 2 : candles.length < 2) return;

    let min = tickMode ? Math.min(...prices) : Math.min(...candles.map(c => c.low));
    let max = tickMode ? Math.max(...prices) : Math.max(...candles.map(c => c.high));
    if (a.ready) {
        [a.res, a.sup].forEach(l => { if (l && l.distAtr <= 1.5) { min = Math.min(min, l.price); max = Math.max(max, l.price); } });
        if (tickMode) { min = Math.min(min, a.fc.open); max = Math.max(max, a.fc.open); }
    }
    const margin = (max - min) * 0.04 || 1;
    min -= margin; max += margin;
    const range = max - min;
    const yFor = (v) => pad.top + h - ((v - min) / range) * h;

    const hline = (v, color, dash, label) => {
        if (v < min || v > max) return;
        const y = yFor(v);
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash(dash);
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + w, y); ctx.stroke();
        ctx.restore();
        if (label) {
            ctx.fillStyle = color; ctx.font = '10px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
            ctx.fillText(label, pad.left + w + 4, y + 3);
        }
    };
    if (a.ready) {
        a.levels.filter(l => l.touches >= 2).forEach(l => hline(l.price, 'rgba(255,255,255,0.16)', [2, 4], null));
        if (a.res) hline(a.res.price, redColor, [6, 4], 'R ' + rfFmt(a.res.price));
        if (a.sup) hline(a.sup.price, greenColor, [6, 4], 'S ' + rfFmt(a.sup.price));
    }

    const plotSeries = (values, xFor, color, width) => {
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
        let started = false;
        values.forEach((v, i) => {
            if (v === null || v === undefined) return;
            const x = xFor(i), y = yFor(v);
            if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        });
        ctx.stroke();
    };
    const smaSeries = (arr, p) => arr.map((_, i) => i + 1 >= p ? sma(arr.slice(0, i + 1), p) : null);

    if (tickMode) {
        const xFor = (i) => pad.left + (i / (prices.length - 1)) * w;
        const trendColor = prices[prices.length - 1] >= prices[0] ? greenColor : redColor;
        plotSeries(prices, xFor, trendColor, 2);
        if (prices.length >= RF_FAST_PERIOD) plotSeries(smaSeries(prices, RF_FAST_PERIOD), xFor, 'rgba(77, 141, 255, 0.85)', 1.5);
        if (prices.length >= RF_SLOW_PERIOD) plotSeries(smaSeries(prices, RF_SLOW_PERIOD), xFor, 'rgba(255, 255, 255, 0.55)', 1.5);
        if (a.ready) hline(a.fc.open, 'rgba(255, 200, 87, 0.85)', [2, 3], 'O ' + rfFmt(a.fc.open));
        ctx.fillStyle = trendColor;
        ctx.beginPath(); ctx.arc(xFor(prices.length - 1), yFor(prices[prices.length - 1]), 3, 0, Math.PI * 2); ctx.fill();
        return;
    }

    const closes = candles.map(c => c.close);
    const slotW = w / candles.length;
    const bodyW = Math.max(2, slotW * 0.6);
    const xCenter = (i) => pad.left + slotW * (i + 0.5);
    candles.forEach((c, i) => {
        const x = xCenter(i);
        const color = c.close >= c.open ? greenColor : redColor;
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, yFor(c.high)); ctx.lineTo(x, yFor(c.low)); ctx.stroke();
        const yOpen = yFor(c.open), yClose = yFor(c.close);
        ctx.fillRect(x - bodyW / 2, Math.min(yOpen, yClose), bodyW, Math.max(1, Math.abs(yClose - yOpen)));
    });
    if (closes.length >= RF_FAST_PERIOD) plotSeries(smaSeries(closes, RF_FAST_PERIOD), xCenter, 'rgba(77, 141, 255, 0.85)', 1.5);
    if (closes.length >= RF_SLOW_PERIOD) plotSeries(smaSeries(closes, RF_SLOW_PERIOD), xCenter, 'rgba(255, 255, 255, 0.55)', 1.5);
    if (a.ready) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        a.piv.forEach(p => {
            ctx.beginPath();
            ctx.arc(xCenter(p.i), yFor(p.price) + (p.type === 'H' ? -5 : 5), 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

// --- auto-mode + manual trade execution ---
function handleRiseFallAutoTick() {
    if (!isAutoTradingRF || rfCooldown) return;
    if (rfCurrentSignal !== 'RISE' && rfCurrentSignal !== 'FALL') return;

    const maxAllowed = parseInt(maxTradesRFInput.value, 10) || 10;
    if (totalTradesExecutedRF + 1 > maxAllowed) {
        logToConsole(`[Rise/Fall] Max trade cap reached (${totalTradesExecutedRF}/${maxAllowed}). Stopping auto-mode.`, "system-msg");
        toggleAutoRF(false);
        return;
    }

    executeRiseFall(rfCurrentSignal, true);
}

function executeRiseFall(direction, isAuto) {
    if (isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) {
        logToConsole("Error: Real-time stream must be connected before running trades.", "error-msg");
        return;
    }

    const symbol = marketDropdown.value;
    const stake = parseFloat(tradeStakeRF.value);
    const unit = tradeDurationUnitRF ? tradeDurationUnitRF.value : 't';
    const minDuration = unit === 't' ? 5 : 1;
    const duration = Math.max(minDuration, parseInt(tradeDurationRF.value, 10) || minDuration);
    const currency = currencyText.textContent || "USD";
    const contractType = direction === 'RISE' ? 'CALL' : 'PUT';
    const bulkRunToken = "RISEFALL_" + Date.now();
    challengeBatchExpectedCounts[bulkRunToken] = 1;

    optionsWebSocket.send(JSON.stringify({
        "buy": 1,
        "price": stake,
        "subscribe": 1,
        "parameters": {
            "amount": stake,
            "basis": "stake",
            "contract_type": contractType,
            "currency": currency,
            "duration": duration,
            "duration_unit": unit,
            "underlying_symbol": symbol
        },
        "passthrough": { "bulkRunId": bulkRunToken }
    }));

    const unitLabel = unit === 't' ? `${duration}t` : `${duration}m`;
    if (isAuto) {
        totalTradesExecutedRF += 1;
        rfCooldown = true;
        logToConsole(`[Rise/Fall Auto] Signal fired ${direction} \u2192 buying ${contractType} (${unitLabel}). Run: ${totalTradesExecutedRF} / ${maxTradesRFInput.value}.`, "success-msg");
    } else {
        logToConsole(`[Rise/Fall Manual] Buying ${contractType} ($${stake.toFixed(2)}, ${unitLabel}).`, "success-msg");
    }
}

if (btnBuyRiseRF) btnBuyRiseRF.addEventListener('click', () => executeRiseFall('RISE', false));
if (btnBuyFallRF) btnBuyFallRF.addEventListener('click', () => executeRiseFall('FALL', false));

if (btnToggleAutoRF) btnToggleAutoRF.addEventListener('click', () => toggleAutoRF(!isAutoTradingRF));
function toggleAutoRF(state) {
    if (!btnToggleAutoRF) return;
    if (state && isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    if (state && autoFollowSignalRF && !autoFollowSignalRF.checked) {
        logToConsole("[Rise/Fall] Tick the \"Auto-trade automatically\" box first to enable Auto-Mode.", "error-msg");
        return;
    }
    isAutoTradingRF = state;
    btnToggleAutoRF.textContent = state ? "Stop Rise/Fall Auto-Mode" : "Start Rise/Fall Auto-Mode";
    btnToggleAutoRF.classList.toggle('stream-active', state);

    tradeStakeRF.disabled = state;
    tradeDurationRF.disabled = state;
    if (tradeDurationUnitRF) tradeDurationUnitRF.disabled = state;
    maxTradesRFInput.disabled = state;
    if (autoFollowSignalRF) autoFollowSignalRF.disabled = state;
    if (rfChartIntervalSelect) rfChartIntervalSelect.disabled = state;

    if (state) {
        rfCooldown = false;
        totalTradesExecutedRF = 0;
        logToConsole(`Rise/Fall Auto-Mode Started. Cap Target: ${maxTradesRFInput.value} trades. Trading on the next RISE/FALL signal, duration auto-set from the signal's suggestion...`, "success-msg");
    } else {
        logToConsole("Rise/Fall Auto-Mode Stopped.");
    }
}

window.addEventListener('resize', () => { if (currentRfPrices().length >= 2) drawRfChart(); });

// ---  LEDGER DOM DATA  ---
function handlePurchaseReceipt(buyReceipt, passthrough) {
    if (!buyReceipt || !buyReceipt.contract_id) return;
    logToConsole(`[Receipt] ID: ${buyReceipt.contract_id} | ${buyReceipt.shortcode}`, "success-msg");

    if (passthrough && passthrough.bulkRunId && passthrough.bulkRunId.startsWith("EDGE_")) {
        edgeActiveContractIds.add(buyReceipt.contract_id);
    }
    if (passthrough && passthrough.bulkRunId && passthrough.bulkRunId.startsWith("BULK_DIFF_")) {
        tnActiveContractIds.add(buyReceipt.contract_id);
    }
    if (passthrough && passthrough.bulkRunId && passthrough.bulkRunId.startsWith("BULK_OVER2_")) {
        over2ActiveContractIds.add(buyReceipt.contract_id);
    }
    if (passthrough && passthrough.bulkRunId && passthrough.bulkRunId.startsWith("PATTERN_OU_")) {
        patternOuActiveContractIds.add(buyReceipt.contract_id);
    }
    if (passthrough && passthrough.bulkRunId && passthrough.bulkRunId.startsWith("PATTERN_O1U8_")) {
        patternO1U8ActiveContractIds.add(buyReceipt.contract_id);
    }
    if (passthrough && passthrough.bulkRunId && passthrough.bulkRunId.startsWith("RISEFALL_")) {
        rfActiveContractIds.add(buyReceipt.contract_id);
    }
    if (passthrough && passthrough.bulkRunId && passthrough.bulkRunId.startsWith("HEDGE_")) {
        hgContractToRun[buyReceipt.contract_id] = passthrough.bulkRunId;
    }
    if (passthrough && passthrough.bulkRunId && passthrough.bulkRunId.startsWith("RUNFLIP_")) {
        flipOnReceipt(buyReceipt.contract_id, passthrough.bulkRunId);
    }
    if (passthrough && passthrough.bulkRunId && passthrough.bulkRunId.startsWith("PBEAST_")) {
        beastOnReceipt(buyReceipt.contract_id, passthrough.bulkRunId);
    }
    const isBulkRfRow = !!(passthrough && passthrough.bulkRunId && passthrough.bulkRunId.startsWith("BULK_RF_"));
    if (isBulkRfRow) {
        brfOnReceipt(buyReceipt.contract_id, passthrough.bulkRunId, buyReceipt.shortcode);
    }

    if (buyReceipt.balance_after) {
        balanceText.textContent = buyReceipt.balance_after.toLocaleString(undefined, { minimumFractionDigits: 2 });
    }

    if (emptyRow) emptyRow.remove();

    const isOver = buyReceipt.shortcode.includes("DIGITOVER") || buyReceipt.shortcode.includes("RUNHIGH")
        || (isBulkRfRow && /^CALL/.test(buyReceipt.shortcode));
    const isUnder = buyReceipt.shortcode.includes("DIGITUNDER") || buyReceipt.shortcode.includes("RUNLOW")
        || (isBulkRfRow && /^PUT/.test(buyReceipt.shortcode));
    const directionArrow = isOver 
        ? `<span style="color: var(--accent-green); font-weight: bold; font-size: 1.1rem;">↗</span>` 
        : isUnder
            ? `<span style="color: var(--accent-red); font-weight: bold; font-size: 1.1rem;">↘</span>`
            : `<span style="color: var(--text-secondary); font-weight: bold; font-size: 1.1rem;">→</span>`;

    const marketRaw = marketDropdown.value || "";
    const marketBadge = (isBulkRfRow && /^stp/i.test(marketRaw)) ? "STEP" : (marketRaw.includes("10") ? "10s" : "100s"); 

    const tr = document.createElement('tr');
    tr.id = `contract-row-${buyReceipt.contract_id}`;
    tr.dataset.batchKey = (passthrough && passthrough.bulkRunId) ? passthrough.bulkRunId : `SOLO_${buyReceipt.contract_id}`;
    tr.innerHTML = `
        <td>
            <div class="type-cell-wrapper">
                <span class="market-mini-badge">${marketBadge}</span>
                ${directionArrow}
            </div>
        </td>
        <td>
            <div class="spot-row">
                <span class="dot entry-dot"></span>
                <span class="row-entry-price">--.--</span>
            </div>
            <div class="spot-row">
                <span class="dot exit-dot"></span>
                <span class="row-exit-digit">--.--</span>
            </div>
        </td>
        <td class="price-col">
            <div class="row-buy-price">${parseFloat(buyReceipt.buy_price || tradeStakeOU.value).toFixed(2)} USD</div>
            <div class="row-profit-loss" style="color: var(--text-secondary);">--.--</div>
        </td>
    `;
    ledgerBody.insertBefore(tr, ledgerBody.firstChild);
}
// Contract stream updates are queued and processed in their own task so a burst of them
// (one per open contract, every tick) can never sit in front of the next tick message.
// Intermediate "open" updates are coalesced to the latest one per contract; settled
// (won/lost) updates are never dropped.
let pendingContractUpdates = [];
let contractFlushScheduled = false;

function queueContractUpdate(contract) {
    if (!contract || !contract.contract_id) return;
    pendingContractUpdates.push(contract);
    if (!contractFlushScheduled) {
        contractFlushScheduled = true;
        setTimeout(flushContractUpdates, 0);
    }
}

function flushContractUpdates() {
    contractFlushScheduled = false;
    const batch = pendingContractUpdates;
    pendingContractUpdates = [];

    const settledIds = new Set();
    for (const c of batch) {
        if (c.status === "won" || c.status === "lost") settledIds.add(c.contract_id);
    }
    const latestOpen = new Map();
    for (const c of batch) {
        if (c.status !== "won" && c.status !== "lost" && !settledIds.has(c.contract_id)) {
            latestOpen.set(c.contract_id, c);
        }
    }
    const emittedOpen = new Set();
    for (const c of batch) {
        if (c.status === "won" || c.status === "lost") {
            handleContractUpdate(c);
        } else if (latestOpen.get(c.contract_id) === c && !emittedOpen.has(c.contract_id)) {
            emittedOpen.add(c.contract_id);
            handleContractUpdate(c);
        }
    }
}

// Same-tick check: once every contract of a bulk batch has reported its entry tick, log
// whether they all entered on the same tick, or exactly how they split (per contract type).
const batchSyncExpected = {};
const batchSyncEntries = {};

function trackBatchEntry(batchKey, contract) {
    const expected = batchSyncExpected[batchKey];
    if (!expected) return;
    const entryTime = contract.entry_tick_time ?? contract.entry_spot_time;
    if (entryTime === undefined || entryTime === null) return;

    const entries = batchSyncEntries[batchKey] || (batchSyncEntries[batchKey] = new Map());
    if (entries.has(contract.contract_id)) return;
    entries.set(contract.contract_id, { t: entryTime, type: contract.contract_type || "?" });
    if (entries.size < expected) return;

    const byTick = new Map();
    for (const { t, type } of entries.values()) {
        if (!byTick.has(t)) byTick.set(t, {});
        byTick.get(t)[type] = (byTick.get(t)[type] || 0) + 1;
    }
    const describe = (counts) => Object.entries(counts).map(([type, n]) => `${n} ${type}`).join(" + ");
    if (byTick.size === 1) {
        logToConsole(`[Sync] ${batchKey}: all ${expected} contracts entered on the SAME tick.`, "success-msg");
    } else {
        const parts = [...byTick.entries()].sort((a, b) => a[0] - b[0])
            .map(([t, counts]) => `tick ${t}: ${describe(counts)}`);
        logToConsole(`[Sync] ${batchKey}: SPLIT across ${byTick.size} entry ticks \u2014 ${parts.join(" | ")}`, "error-msg");
    }
    delete batchSyncExpected[batchKey];
    delete batchSyncEntries[batchKey];
}

function handleContractUpdate(contract) {
    if (!contract || !contract.contract_id) return;
    if (typeof hgSyncCountdown === 'function') hgSyncCountdown(contract);
    if (typeof autoCashOutCheck === 'function') autoCashOutCheck(contract);
    if (typeof rfCountdownUpdate === 'function') rfCountdownUpdate(contract);
    if (typeof brfCdContract === 'function') brfCdContract(contract);
    logToConsole(`[Stream] Contract ${contract.contract_id} \u2192 status: ${contract.status ?? 'n/a'}, profit: ${contract.profit ?? 'n/a'}, is_expired: ${contract.is_expired ?? 'n/a'}`, "system-msg");

    if (contract.status === "won" || contract.status === "lost") {
        if (tnActiveContractIds.has(contract.contract_id)) {
            tnActiveContractIds.delete(contract.contract_id);
            tnBatchOpenCount = Math.max(0, tnBatchOpenCount - 1);

            if (tnBatchOpenCount === 0) {
                const useLoopModeTN = loopUntilTargetTNCheckbox && loopUntilTargetTNCheckbox.checked;
                if (isAutoModeTN && (useLoopModeTN || totalTradesExecutedTN < parseInt(maxTradesTN.value))) {
                    if (useLoopModeTN) {
                        tnLoopCycleCount++;
                        if (tnLoopCycleCountDisplay) tnLoopCycleCountDisplay.textContent = tnLoopCycleCount;
                        logToConsole(`[Loop Mode] Differs cycle ${tnLoopCycleCount} fired. Continuing until session target is hit...`, "system-msg");
                    }
                    executeBulkDiffers();
                } else if (isAutoModeTN) {
                    logToConsole("Max Differs runs reached.");
                    toggleAutoTN(false);
                }
            }
        }
        if (over2ActiveContractIds.has(contract.contract_id)) {
            over2ActiveContractIds.delete(contract.contract_id);
            over2BatchOpenCount = Math.max(0, over2BatchOpenCount - 1);
            if (over2BatchOpenCount === 0) bulkOver2Cooldown = false;
        }
        if (patternOuActiveContractIds.has(contract.contract_id)) {
            patternOuActiveContractIds.delete(contract.contract_id);
            patternCooldown = false;
        }
        if (patternO1U8ActiveContractIds.has(contract.contract_id)) {
            patternO1U8ActiveContractIds.delete(contract.contract_id);
            patternO1U8Cooldown = false;
        }
        if (rfActiveContractIds.has(contract.contract_id)) {
            rfActiveContractIds.delete(contract.contract_id);
            rfCooldown = false;
        }
        if (bulkRfActiveContractIds.has(contract.contract_id)) {
            brfOnSettled(contract);
        }
        if (flipActive.has(contract.contract_id)) {
            flipOnSettled(contract);
        }
        if (beastActive.has(contract.contract_id)) {
            beastOnSettled(contract);
        }
        if (hgContractToRun[contract.contract_id]) {
            handleHedgeContractSettled(contract);
        }
    }

    const row = document.getElementById(`contract-row-${contract.contract_id}`);
    if (!row) {
        logToConsole(`[Stream] Contract ${contract.contract_id} update arrived but no matching ledger row exists \u2014 dropped.`, "error-msg");
        return;
    }

    if (row.dataset.batchKey) trackBatchEntry(row.dataset.batchKey, contract);

    const currencySymbol = contract.currency || "USD";

    // Update Buy Price row text if available
    if (contract.buy_price) {
        row.querySelector('.row-buy-price').textContent = `${parseFloat(contract.buy_price).toFixed(2)} ${currencySymbol}`;
    }

    // Update Entry Spot visual text
    if (contract.entry_spot) {
        row.querySelector('.row-entry-price').textContent = formatSpot(
            contract.entry_spot_display_value ?? contract.entry_tick_display_value,
            contract.entry_spot, contract.underlying_symbol || contract.underlying);
    }

    // Update Exit or Current Spot text in real-time
    // Bulk Rise/Fall rows: the running spot used to start updating BEFORE the contract had entered
    // (the tick you fired on, then the entry tick itself), so you saw extra movement. Now the cell
    // only moves on the ticks that actually count: tick 1, tick 2, ... up to the exit tick.
    let brfHoldSpot = false;
    const isBrfLedgerRow = String(row.dataset.batchKey || '').startsWith('BULK_RF_');
    if (isBrfLedgerRow && contract.status !== "won" && contract.status !== "lost") {
        const et = Number(contract.entry_tick_time), ct = Number(contract.current_spot_time);
        if (!(contract.entry_spot && et > 0 && ct > et)) brfHoldSpot = true;
    }
    if (!brfHoldSpot && (contract.exit_spot || contract.current_spot)) {
        const activeSpot = contract.exit_spot || contract.current_spot;
        const spotText = formatSpot(
            contract.exit_spot ? (contract.exit_spot_display_value ?? contract.exit_tick_display_value)
                               : contract.current_spot_display_value,
            activeSpot, contract.underlying_symbol || contract.underlying);
        // Bold the last character: that is the digit Over/Under/Differs contracts settle on.
        const exitCell = row.querySelector('.row-exit-digit');
        exitCell.textContent = "";
        exitCell.append(spotText.slice(0, -1));
        const lastChar = document.createElement('b');
        lastChar.textContent = spotText.slice(-1);
        exitCell.appendChild(lastChar);
        if (isBrfLedgerRow) {
            const dm = /_(\d+)T_/.exec(String(contract.shortcode || ''));
            const total = dm ? parseInt(dm[1], 10) : null;
            if (total) {
                const et = Number(contract.entry_tick_time);
                const settled = contract.status === "won" || contract.status === "lost" || !!contract.exit_spot;
                const k = settled ? total : Math.min(total, brfCdEpochs.filter(e => e > et).length);
                const tag = document.createElement('small');
                tag.style.cssText = 'margin-left:6px;opacity:.7;';
                tag.textContent = `(tick ${k}/${total})`;
                exitCell.appendChild(tag);
            }
        }
    }

    // Update Profit/Loss visualization colors and strings
    if (contract.profit !== undefined) {
        const profitValue = parseFloat(contract.profit);
        const profitCell = row.querySelector('.row-profit-loss');

        if (contract.status === "open") {
            profitCell.textContent = `${profitValue >= 0 ? '+' : ''}${profitValue.toFixed(2)} ${currencySymbol}`;
            profitCell.style.color = profitValue >= 0 ? "var(--accent-green)" : "var(--accent-red)";
        } else if (contract.status === "won") {
            profitCell.textContent = `${profitValue >= 0 ? '+' : ''}${profitValue.toFixed(2)} ${currencySymbol}`;
            profitCell.className = "row-profit-loss text-win";
            profitCell.style.color = "var(--text-primary)";
        } else if (contract.status === "lost") {
            profitCell.textContent = `${profitValue.toFixed(2)} ${currencySymbol}`;
            profitCell.className = "row-profit-loss text-loss";
            profitCell.style.color = "var(--accent-red)";
        }

        if ((contract.status === "won" || contract.status === "lost") && row.dataset.settled !== "1") {
            row.dataset.settled = "1";
            totalSessionProfit += profitValue;
            updateSessionProfitUI();
            checkTPSLHit();
            showPnlToast(calculateLedgerTotal());

            if (edgeActiveContractIds.has(contract.contract_id)) {
                edgeActiveContractIds.delete(contract.contract_id);
                handleEdgeTradeSettled(profitValue);
            }
        }
    }

    if (contract.status === "won" || contract.status === "lost") {
        if (optionsWebSocket && optionsWebSocket.readyState === WebSocket.OPEN && contract.id) {
            optionsWebSocket.send(JSON.stringify({
                "forget": contract.id
            }));
            logToConsole(`[Cleanup] Sent forget handshake for subscription ID: ${contract.id}`);
        }
    }
}

// --- INTERFACE CONTROL HANDLERS ---
btnBuyEO.addEventListener('click', executeContractEO);
btnBuyOU.addEventListener('click', executeBulkOverUnderPair);

btnToggleAutoEO.addEventListener('click', () => toggleAutoEO(!isAutoTradingEO));
function toggleAutoEO(state) {
    if (state && isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    isAutoTradingEO = state;
    btnToggleAutoEO.textContent = state ? "Stop Auto Mode" : "Start Auto-Mode";
    btnToggleAutoEO.classList.toggle('stream-active', state);
    btnBuyEO.disabled = state;
    if(state) logToConsole("EO Auto-Mode Active.", "success-msg");
}

// Shared guard for "keep trading until session target" loop mode: refuses to
// start unless the Session Tracker is actively running, since without it
// there's no daily target for the loop to stop at.
function canStartLoopMode(checkboxEl, label) {
    if (!checkboxEl || !checkboxEl.checked) return true;
    if (!sessionState.active) {
        logToConsole(`[${label}] "Keep trading until target" is checked but the Session Tracker isn't running. Start the Session Tracker first, or uncheck the loop option.`, "error-msg");
        return false;
    }
    return true;
}

btnToggleAutoOU.addEventListener('click', () => toggleAutoOU(!isAutoTradingOU));
function toggleAutoOU(state) {
    if (state && isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    if (state && !canStartLoopMode(loopUntilTargetOUCheckbox, "Bulk OU")) return;
    isAutoTradingOU = state;
    btnToggleAutoOU.textContent = state ? "Stop Auto Bulk Mode" : "Start Auto Bulk Mode";
    btnToggleAutoOU.classList.toggle('stream-active', state);
    
    predOverInput.disabled = state;
    predUnderInput.disabled = state;
    tradeStakeOU.disabled = state;
    tradeDurationOU.disabled = state;
    maxTradesOUInput.disabled = state;
    if (patternTriggerOUCheckbox) patternTriggerOUCheckbox.disabled = state;
    if (loopUntilTargetOUCheckbox) loopUntilTargetOUCheckbox.disabled = state;

    const usePatternTriggerOU = patternTriggerOUCheckbox && patternTriggerOUCheckbox.checked;
    const useLoopModeOU = loopUntilTargetOUCheckbox && loopUntilTargetOUCheckbox.checked;

    if(state) {
        autoBulkCooldown = false; 
        totalTradesExecutedOU = 0; 
        ouPatternMatchLabel = null;
        ouLoopCycleCount = 0;
        if (ouLoopCycleCountDisplay) ouLoopCycleCountDisplay.textContent = '0';
        if (useLoopModeOU) {
            if (ouLoopStatus) ouLoopStatus.style.display = 'flex';
            if (ouLoopStatusText) { ouLoopStatusText.textContent = 'Running'; ouLoopStatusText.className = 'success-msg'; }
        } else {
            if (ouLoopStatus) ouLoopStatus.style.display = 'none';
        }
        if (usePatternTriggerOU) {
            recentDigitHistory = [];
            if (ouPatternStatus) ouPatternStatus.style.display = 'flex';
            if (ouPatternDigitHistoryDisplay) ouPatternDigitHistoryDisplay.textContent = '--';
            if (ouPatternLastMatchDisplay) ouPatternLastMatchDisplay.textContent = 'None';
            logToConsole(`Bulk Auto-Mode Started (Pattern Trigger${useLoopModeOU ? ', Loop Until Target' : ''}). Waiting for ${predOverInput.value} / ${predUnderInput.value} to land back-to-back (either order, or the same digit twice) before firing ${maxTradesOUInput.value} Over/Under pairs.`, "success-msg");
        } else if (useLoopModeOU) {
            logToConsole(`Bulk Auto-Mode Started (Loop Until Target). Will keep firing ${maxTradesOUInput.value} Over/Under pairs on qualifying ticks until today's session target is hit.`, "success-msg");
        } else {
            if (ouPatternStatus) ouPatternStatus.style.display = 'none';
            logToConsole(`Bulk Auto-Mode Started. Will fire ${maxTradesOUInput.value} Over/Under pairs on the next qualifying tick, then auto-stop.`, "success-msg");
        }
    } else {
        if (ouPatternStatus) ouPatternStatus.style.display = 'none';
        if (ouLoopStatus) ouLoopStatus.style.display = 'none';
    }
}

btnBuyOUD.addEventListener('click', executeBulkOnlyUpsDownsPair);
btnToggleAutoOUD.addEventListener('click', () => toggleAutoOUD(!isAutoTradingOUD));
function toggleAutoOUD(state) {
    if (state && isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    if (state && !canStartLoopMode(loopUntilTargetOUDCheckbox, "Bulk OUD")) return;
    isAutoTradingOUD = state;
    btnToggleAutoOUD.textContent = state ? "Stop Auto Bulk Mode" : "Auto Bulk Mode";
    btnToggleAutoOUD.classList.toggle('stream-active', state);

    tradeStakeOUD.disabled = state;
    tradeDurationOUD.disabled = state;
    maxTradesOUDInput.disabled = state;
    if (loopUntilTargetOUDCheckbox) loopUntilTargetOUDCheckbox.disabled = state;

    const useLoopModeOUD = loopUntilTargetOUDCheckbox && loopUntilTargetOUDCheckbox.checked;

    if (state) {
        autoBulkCooldownOUD = false;
        totalTradesExecutedOUD = 0;
        oudLoopCycleCount = 0;
        if (oudLoopCycleCountDisplay) oudLoopCycleCountDisplay.textContent = '0';
        if (useLoopModeOUD) {
            if (oudLoopStatus) oudLoopStatus.style.display = 'flex';
            if (oudLoopStatusText) { oudLoopStatusText.textContent = 'Running'; oudLoopStatusText.className = 'success-msg'; }
            logToConsole(`Bulk Auto-Mode Started (Loop Until Target). Will keep firing ${maxTradesOUDInput.value} Only Ups/Only Downs pairs on qualifying ticks until today's session target is hit.`, "success-msg");
        } else {
            if (oudLoopStatus) oudLoopStatus.style.display = 'none';
            logToConsole(`Bulk Auto-Mode Started. Will fire ${maxTradesOUDInput.value} Only Ups/Only Downs pairs on the next qualifying tick, then auto-stop.`, "success-msg");
        }
    } else {
        if (oudLoopStatus) oudLoopStatus.style.display = 'none';
    }
}

const btnBuyTN = document.getElementById("btn-buy-tn");
const btnToggleAutoTN = document.getElementById("btn-toggle-auto-tn");
const tradeStakeTN = document.getElementById("trade-stake-tn");
const tradeDigitTN = document.getElementById("trade-digit-tn");
const maxTradesTN = document.getElementById("max-trades-tn");
const autoPredictTN = document.getElementById("auto-predict-tn");
const predictedDigitTNDisplay = document.getElementById("predicted-digit-tn-display");
const rotateDigitsTNCheckbox = document.getElementById("rotate-digits-tn");
const rotateDigitTNDisplay = document.getElementById("rotate-digit-tn-display");
const DIFFERS_ROTATION_SEQUENCE = [0, 9, 1, 8, 2, 7, 3, 6, 4, 5];
let differsRotationIndex = 0;
const loopUntilTargetTNCheckbox = document.getElementById('loop-until-target-tn');
const tnLoopStatus = document.getElementById('tn-loop-status');
const tnLoopCycleCountDisplay = document.getElementById('tn-loop-cycle-count');
const tnLoopStatusText = document.getElementById('tn-loop-status-text');
let tnLoopCycleCount = 0;

let isAutoModeTN = false;
let totalTradesExecutedTN = 0;

if (autoPredictTN) {
    autoPredictTN.addEventListener('change', () => {
        if (autoPredictTN.checked && rotateDigitsTNCheckbox) rotateDigitsTNCheckbox.checked = false;
        tradeDigitTN.disabled = autoPredictTN.checked;
        if (!autoPredictTN.checked && predictedDigitTNDisplay) predictedDigitTNDisplay.value = '--';
    });
}

if (rotateDigitsTNCheckbox) {
    rotateDigitsTNCheckbox.addEventListener('change', () => {
        if (rotateDigitsTNCheckbox.checked && autoPredictTN) {
            autoPredictTN.checked = false;
            tradeDigitTN.disabled = false;
            if (predictedDigitTNDisplay) predictedDigitTNDisplay.value = '--';
        }
        tradeDigitTN.disabled = rotateDigitsTNCheckbox.checked;
        if (rotateDigitTNDisplay) rotateDigitTNDisplay.value = DIFFERS_ROTATION_SEQUENCE[differsRotationIndex];
    });
}

function executeBulkDiffers() {

    if (isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        if (isAutoModeTN) toggleAutoTN(false);
        return;
    }

    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) {
        logToConsole("Error: WebSocket not connected.", "error-msg");
        return;
    }

    const stake = parseFloat(tradeStakeTN.value);
    let digitStr;
    if (rotateDigitsTNCheckbox && rotateDigitsTNCheckbox.checked) {
        const digit = DIFFERS_ROTATION_SEQUENCE[differsRotationIndex];
        digitStr = digit.toString();
        logToConsole(`[Differs] Rotation digit ${digitStr} (cycle ${differsRotationIndex + 1}/${DIFFERS_ROTATION_SEQUENCE.length}).`, "system-msg");
        differsRotationIndex = (differsRotationIndex + 1) % DIFFERS_ROTATION_SEQUENCE.length;
        if (rotateDigitTNDisplay) rotateDigitTNDisplay.value = DIFFERS_ROTATION_SEQUENCE[differsRotationIndex];
    } else if (autoPredictTN && autoPredictTN.checked) {
        const hotDigit = getHotDigit();
        if (hotDigit === null) {
            logToConsole("[Differs] Not enough tick history yet to predict a digit. Waiting for more ticks.", "error-msg");
            return;
        }
        digitStr = hotDigit.toString();
        if (predictedDigitTNDisplay) predictedDigitTNDisplay.value = digitStr;
        logToConsole(`[Differs] Auto-predicted digit ${digitStr} (hottest over last ${digitFrequencyWindow.length} ticks).`, "system-msg");
    } else {
        digitStr = parseInt(tradeDigitTN.value, 10).toString();
    }
    const duration = parseInt(document.getElementById("trade-duration-tn").value) || 5;
    const batchSize = parseInt(maxTradesTN.value, 10) || 1; // Max Trades Cap doubles as "repeat this many times on this same tick", same pattern as Bulk Over/Under
    const bulkRunToken = "BULK_DIFF_" + Date.now();
    challengeBatchExpectedCounts[bulkRunToken] = batchSize;
    tnBatchOpenCount = batchSize;

    const baseParams = {
        "amount": stake,
        "basis": "stake",
        "currency": currencyText.textContent || "USD",
        "duration": duration,
        "duration_unit": "t",
        "underlying_symbol": marketDropdown.value,
        "barrier": digitStr
    };

    const differPayload = JSON.stringify({
        "buy": 1,
        "price": stake,
        "subscribe": 1,
        "parameters": { ...baseParams, "contract_type": "DIGITDIFF" },
        "passthrough": { "bulkRunId": bulkRunToken }
    });

    const sendStart = performance.now();
    for (let i = 0; i < batchSize; i++) {
        optionsWebSocket.send(differPayload);
    }
    const sendMs = (performance.now() - sendStart).toFixed(1);

    totalTradesExecutedTN += batchSize;
    logToConsole(`[Differs] Fired ${batchSize} Differ ${digitStr} contracts on this tick. (send loop ${sendMs} ms)`, "success-msg");
}


if (btnBuyTN) {
    btnBuyTN.addEventListener("click", executeBulkDiffers);
    console.log("Event listener attached successfully to btn-buy-tn");
} else {
    console.error("CRITICAL: btn-buy-tn not found in the DOM!");
}

if (btnToggleAutoTN) {
    btnToggleAutoTN.addEventListener("click", () => toggleAutoTN(!isAutoModeTN));
}

function toggleAutoTN(state) {
    if (state && isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    if (state && !canStartLoopMode(loopUntilTargetTNCheckbox, "Differs")) return;

    isAutoModeTN = state;
    btnToggleAutoTN.textContent = state ? "Stop Auto Bulk Mode" : "Auto Bulk Mode";
    btnToggleAutoTN.classList.toggle('stream-active', state);
    if (loopUntilTargetTNCheckbox) loopUntilTargetTNCheckbox.disabled = state;
    if (rotateDigitsTNCheckbox) rotateDigitsTNCheckbox.disabled = state;
    if (autoPredictTN) autoPredictTN.disabled = state;

    const useLoopModeTN = loopUntilTargetTNCheckbox && loopUntilTargetTNCheckbox.checked;

    if (state) {
        totalTradesExecutedTN = 0;
        tnLoopCycleCount = 0;
        if (tnLoopCycleCountDisplay) tnLoopCycleCountDisplay.textContent = '0';
        if (rotateDigitsTNCheckbox && rotateDigitsTNCheckbox.checked) {
            differsRotationIndex = 0;
            if (rotateDigitTNDisplay) rotateDigitTNDisplay.value = DIFFERS_ROTATION_SEQUENCE[0];
        }
        if (useLoopModeTN) {
            if (tnLoopStatus) tnLoopStatus.style.display = 'flex';
            if (tnLoopStatusText) { tnLoopStatusText.textContent = 'Running'; tnLoopStatusText.className = 'success-msg'; }
            logToConsole(`[Differs] Auto Bulk Mode started (Loop Until Target). Will keep firing ${maxTradesTN.value} Differ contracts on qualifying ticks until today's session target is hit.`, "success-msg");
        } else {
            if (tnLoopStatus) tnLoopStatus.style.display = 'none';
            logToConsole(`[Differs] Auto Bulk Mode started. Will fire ${maxTradesTN.value} Differ contracts on the next qualifying tick, then auto-stop.`, "success-msg");
        }
        executeBulkDiffers();
    } else {
        if (tnLoopStatus) tnLoopStatus.style.display = 'none';
        logToConsole("[Differs] Auto Bulk Mode stopped.");
    }
}

// --- OVER 0 / UNDER 9 ---
const btnToggleEdgeRotation = document.getElementById("btn-toggle-edge-rotation");
const edgeSideSelect = document.getElementById("edge-side-select");
const tradeStakeEdge = document.getElementById("trade-stake-edge");
const tradeDurationEdge = document.getElementById("trade-duration-edge");
const takeProfitEdge = document.getElementById("take-profit-edge");
const maxMultiplierEdge = document.getElementById("max-multiplier-edge");
const maxRunsEdge = document.getElementById("max-runs-edge");
const edgeStatusText = document.getElementById("edge-status-text");

let isEdgeRotationActive = false;
let edgeSelectedSide = 'OVER0';
let edgeBaseStake = 0;
let edgeCurrentStake = 0;
let edgeSessionPL = 0;
let edgeOpenTradeCount = 0;
let edgeRunCount = 0;

function setEdgeStatus(text) {
    if (edgeStatusText) edgeStatusText.textContent = text;
}

function stopEdgeRotation(reason) {
    isEdgeRotationActive = false;
    if (btnToggleEdgeRotation) {
        btnToggleEdgeRotation.textContent = "Start Over 0/Under 9";
        btnToggleEdgeRotation.classList.remove('stream-active');
    }
    setEdgeStatus(reason || "Idle");
    logToConsole(`[Over 0 / Under 9] Stopped. ${reason || ""}`, "system-msg");
}

function attemptEdgeFire() {
    const maxRuns = parseInt(maxRunsEdge.value, 10) || 0;
    if (maxRuns > 0 && edgeRunCount >= maxRuns) {
        stopEdgeRotation(`Max runs reached (${edgeRunCount}/${maxRuns}). Session P/L: ${edgeSessionPL >= 0 ? '+' : ''}${edgeSessionPL.toFixed(2)}.`);
        return;
    }

    setEdgeStatus(`Trading ${edgeSelectedSide === 'OVER0' ? 'Over 0' : 'Under 9'}. Stake: ${edgeCurrentStake.toFixed(2)} | Session P/L: ${edgeSessionPL >= 0 ? '+' : ''}${edgeSessionPL.toFixed(2)} | Runs: ${edgeRunCount}/${maxRuns || '∞'}`);

    fireEdgeTrade(edgeSelectedSide);
}

function fireEdgeTrade(side) {
    if (isSessionLocked()) {
        stopEdgeRotation("Stopped - trading locked until next trading day.");
        return;
    }
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) {
        stopEdgeRotation("Stopped - stream disconnected.");
        return;
    }

    edgeOpenTradeCount++;
    edgeRunCount++;
    const bulkRunToken = "EDGE_" + Date.now();
    challengeBatchExpectedCounts[bulkRunToken] = 1;
    const duration = parseInt(tradeDurationEdge.value, 10) || 1;

    optionsWebSocket.send(JSON.stringify({
        "buy": 1,
        "price": edgeCurrentStake,
        "subscribe": 1,
        "parameters": {
            "amount": edgeCurrentStake,
            "basis": "stake",
            "contract_type": side === 'OVER0' ? "DIGITOVER" : "DIGITUNDER",
            "currency": currencyText.textContent || "USD",
            "duration": duration,
            "duration_unit": "t",
            "underlying_symbol": marketDropdown.value,
            "barrier": side === 'OVER0' ? "0" : "9"
        },
        "passthrough": { "bulkRunId": bulkRunToken }
    }));

    logToConsole(`[Over 0 / Under 9] Fired ${side === 'OVER0' ? 'Over 0' : 'Under 9'} at stake ${edgeCurrentStake.toFixed(2)}.`, "success-msg");
}

function handleEdgeTradeSettled(profitValue) {
    edgeOpenTradeCount = Math.max(0, edgeOpenTradeCount - 1);
    edgeSessionPL += profitValue;

    const multiplier = parseFloat(maxMultiplierEdge.value) || 5;
    let nextStake = edgeCurrentStake + profitValue;
    nextStake = Math.max(edgeBaseStake, nextStake);
    if (nextStake > edgeBaseStake * multiplier) {
        logToConsole(`[Over 0 / Under 9] Compounded stake hit the ${multiplier}x safety cap - resetting to base stake.`, "system-msg");
        nextStake = edgeBaseStake;
    }
    edgeCurrentStake = nextStake;

    const tpTarget = parseFloat(takeProfitEdge.value) || 0;
    if (tpTarget > 0 && edgeSessionPL >= tpTarget) {
        stopEdgeRotation(`Strategy take-profit hit (+${edgeSessionPL.toFixed(2)}).`);
        return;
    }

    if (isEdgeRotationActive && edgeOpenTradeCount === 0) {
        attemptEdgeFire();
    }
}

if (btnToggleEdgeRotation) {
    btnToggleEdgeRotation.addEventListener("click", () => {
        if (!isEdgeRotationActive && isTradingLocked()) {
            logToConsole(tradingLockMessage(), "error-msg");
            return;
        }
        if (isEdgeRotationActive) {
            stopEdgeRotation("Stopped by user request.");
        } else {
            edgeSelectedSide = edgeSideSelect ? edgeSideSelect.value : 'OVER0';
            edgeBaseStake = parseFloat(tradeStakeEdge.value) || 1;
            edgeCurrentStake = edgeBaseStake;
            edgeSessionPL = 0;
            edgeOpenTradeCount = 0;
            edgeRunCount = 0;
            isEdgeRotationActive = true;
            btnToggleEdgeRotation.textContent = "Stop Over 0/Under 9";
            btnToggleEdgeRotation.classList.add('stream-active');
            logToConsole(`[Over 0 / Under 9] Started on ${edgeSelectedSide === 'OVER0' ? 'Over 0' : 'Under 9'}.`, "success-msg");
            attemptEdgeFire();
        }
    });
}




document.getElementById("btn-reset-balance").addEventListener("click", () => {
    if (confirm("Are you sure you want to reset your demo balance to 10,000 USD?")) {
        resetDemoBalance();
    }
});

// The Reset button functi
function resetDemoBalance() {
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) {
        logToConsole("Error: WebSocket not connected.", "error-msg");
        return;
    }

    optionsWebSocket.send(JSON.stringify({
        "topup_virtual": 1
    }));
    
    logToConsole("Requesting balance reset...");
}

function updateTradeControlsState(isActive) {
    const isReady = isActive && optionsWebSocket && optionsWebSocket.readyState === WebSocket.OPEN;
    btnBuyEO.disabled = !isReady;
    btnToggleAutoEO.disabled = !isReady;
    btnBuyOU.disabled = !isReady;
    btnToggleAutoOU.disabled = !isReady;
    btnToggleAutoPOU.disabled = !isReady;
    if (btnToggleAutoPO18) btnToggleAutoPO18.disabled = !isReady;
    if (btnBuyHG) btnBuyHG.disabled = !isReady;
    if (btnHgRefresh) btnHgRefresh.disabled = !isReady;
    if (btnHgExecute) btnHgExecute.disabled = !isReady;
    ['btn-hg-analyze', 'btn-hg-scan'].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = !isReady; });
    if (btnToggleAutoHG) btnToggleAutoHG.disabled = !isReady;
    if (btnBuyRiseRF) btnBuyRiseRF.disabled = !isReady;
    if (btnBuyFallRF) btnBuyFallRF.disabled = !isReady;
    if (btnToggleAutoRF) btnToggleAutoRF.disabled = !isReady;
    btnBuyBulkOver2.disabled = !isReady;
    btnBuyOUD.disabled = !isReady;
    btnToggleAutoOUD.disabled = !isReady;
    if (btnBuyBRF) btnBuyBRF.disabled = !isReady;
    if (btnToggleAutoBRF) btnToggleAutoBRF.disabled = !isReady;
    if (btnQuoteBRF) btnQuoteBRF.disabled = !isReady;
    if (btnBuyFlipUp) btnBuyFlipUp.disabled = !isReady;
    if (btnBuyFlipDown) btnBuyFlipDown.disabled = !isReady;
    if (btnToggleAutoFlip) btnToggleAutoFlip.disabled = !isReady;
    if (btnQuoteFlip) btnQuoteFlip.disabled = !isReady;
    if (btnBuyBeast) btnBuyBeast.disabled = !isReady;
    if (btnToggleAutoBeast) btnToggleAutoBeast.disabled = !isReady;
    if (btnQuoteBeast) btnQuoteBeast.disabled = !isReady;
    if (!isReady) { toggleAutoFlip(false); toggleAutoBeast(false); flipOpen = false; beastOpen = false; flipRender(); beastRender(); }
    if (!isReady) { toggleAutoBRF(false); brfAbortCycle(); }
    if (!isReady) { toggleAutoEO(false); toggleAutoOU(false); toggleAutoPOU(false); toggleAutoPO18(false); toggleAutoRF(false); toggleAutoOUD(false); toggleAutoHG(false); if (isBulkOver2Armed) disarmBulkOver2(); }
}

function disconnectExistingStream() {
    if (optionsWebSocket) { optionsWebSocket.close(); optionsWebSocket = null; }
    if (isEdgeRotationActive) stopEdgeRotation("Stopped - stream disconnected.");
    updateTradeControlsState(false);
    marketPanel.style.display = 'none';
    setButtonLoading(btnToggleStream, false);
    btnToggleStream.disabled = false;
    btnToggleStream.textContent = "Connect Real-Time Stream";
    btnToggleStream.classList.remove('stream-active');
}

// Buffered logger: log calls only push to memory; the DOM is touched once per flush.
// Previously every line appended a node AND read scrollHeight (forced layout), and a
// batch of open contracts logs one line each per tick - that blocked the main thread
// and made the next tick get processed late.
const LOG_MAX_LINES = 400;
let logBuffer = [];
let logFlushTimer = null;

function flushLogBuffer() {
    logFlushTimer = null;
    if (!logBuffer.length) return;
    const frag = document.createDocumentFragment();
    for (const entry of logBuffer) {
        const p = document.createElement('p');
        p.className = entry.className;
        p.textContent = `[${entry.time}] ${entry.message}`;
        frag.appendChild(p);
    }
    logBuffer = [];
    logConsole.appendChild(frag);
    while (logConsole.childElementCount > LOG_MAX_LINES) logConsole.removeChild(logConsole.firstElementChild);
    logConsole.scrollTop = logConsole.scrollHeight;
}

function logToConsole(message, className = "") {
    logBuffer.push({ message, className, time: new Date().toLocaleTimeString() });
    if (logBuffer.length > LOG_MAX_LINES) logBuffer.shift();
    if (logFlushTimer === null) logFlushTimer = setTimeout(flushLogBuffer, 100);
}

function calculateLedgerTotal() {
    let total = 0;
    document.querySelectorAll('#ledger-body .row-profit-loss').forEach(cell => {
        const text = cell.textContent.trim();
        if (!text || text === '--.--') return;
        const numeric = parseFloat(text.replace(/[^0-9.+-]/g, ''));
        if (!isNaN(numeric)) total += numeric;
    });
    return total;
}

const pnlToastContainer = document.getElementById('pnl-toast-container');
function showPnlToast(totalValue) {
    if (!pnlToastContainer) return;
    const isWin = totalValue >= 0;

    const existing = pnlToastContainer.querySelector('.pnl-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `pnl-toast ${isWin ? 'pnl-toast-win' : 'pnl-toast-loss'}`;
    toast.innerHTML = `
        <div class="pnl-toast-icon">${isWin ? '\u2713' : '\u2715'}</div>
        <div class="pnl-toast-body">
            <div class="pnl-toast-title">${isWin ? 'Total Profit' : 'Total Loss'}</div>
            <div class="pnl-toast-amount">${isWin ? '+' : ''}${totalValue.toFixed(2)}</div>
        </div>
    `;
    pnlToastContainer.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('pnl-toast-visible'));

    setTimeout(() => {
        toast.classList.remove('pnl-toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- DAILY SESSION TRACKER ---
// A fixed daily profit target split across N sessions. Hitting a session's
// slice locks trading until that session's time window ends, not for a full
// 24 hours. Session 1's start time anchors the daily clock pattern going
// forward, so the schedule repeats at the same times every day.
const SESSION_STORAGE_KEY = 'we_trade_session_v1';
const SESSION_LOCK_BUTTON_IDS = [
    'btn-buy-eo', 'btn-toggle-auto-eo',
    'btn-buy-ou', 'btn-toggle-auto-ou',
    'btn-buy-oud', 'btn-toggle-auto-oud',
    'btn-toggle-auto-pou',
    'btn-toggle-auto-po18',
    'btn-buy-rise-rf', 'btn-buy-fall-rf', 'btn-toggle-auto-rf',
    'btn-buy-brf', 'btn-toggle-auto-brf',
    'btn-buy-bulk-over2',
    'btn-buy-tn', 'btn-toggle-auto-tn',
    'btn-toggle-edge-rotation',
    'btn-buy-flip-up', 'btn-buy-flip-down', 'btn-toggle-auto-flip',
    'btn-buy-beast', 'btn-toggle-auto-beast'
];

const sessionDailyTargetInput = document.getElementById('session-daily-target');
const sessionsPerDayInput = document.getElementById('session-count');
const btnStartSession = document.getElementById('btn-start-session');
const btnResetSession = document.getElementById('btn-reset-session');
const sessionStatusBanner = document.getElementById('session-status-banner');
const sessionProgressDisplay = document.getElementById('session-progress-display');
const sessionCurrentLabel = document.getElementById('session-current-label');
const sessionProfitLabel = document.getElementById('session-profit-label');
const sessionTargetLabel = document.getElementById('session-target-label');
const sessionProgressFill = document.getElementById('session-progress-fill');
const sessionTableBody = document.getElementById('session-table-body');
const sessionScheduleNote = document.getElementById('session-schedule-note');

function defaultSessionState() {
    return {
        active: false,
        dailyTarget: 10.00,
        sessionsPerDay: 4,
        anchorTimestamp: null,
        currentGlobalIndex: null,
        sessionProfit: 0,
        lockedUntilTimestamp: null,
        log: {}
    };
}

function loadSessionState() {
    try {
        const raw = localStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) return defaultSessionState();
        return { ...defaultSessionState(), ...JSON.parse(raw) };
    } catch (e) {
        return defaultSessionState();
    }
}

function saveSessionState() {
    try { localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionState)); } catch (e) { /* ignore */ }
}

let sessionState = loadSessionState();

function sessionIntervalMs() {
    return (24 * 60 * 60 * 1000) / sessionState.sessionsPerDay;
}

function sessionTargetAmount() {
    return sessionState.dailyTarget / sessionState.sessionsPerDay;
}

function computeGlobalIndexForNow() {
    if (sessionState.anchorTimestamp === null) return null;
    return Math.floor((Date.now() - sessionState.anchorTimestamp) / sessionIntervalMs());
}

function sessionWindow(globalIndex) {
    const start = sessionState.anchorTimestamp + globalIndex * sessionIntervalMs();
    return { start, end: start + sessionIntervalMs() };
}

function sessionOfDayLabel(globalIndex) {
    const dayNum = Math.floor(globalIndex / sessionState.sessionsPerDay) + 1;
    const sessionNum = (globalIndex % sessionState.sessionsPerDay) + 1;
    return { dayNum, sessionNum };
}

function isSessionLocked() {
    return sessionState.active && sessionState.lockedUntilTimestamp !== null && Date.now() < sessionState.lockedUntilTimestamp;
}

// --- Combined trading lock ---
// Session Tracker and Challenge Mode can each be running at the same time, and each can lock
// trading independently. A button only unlocks once EVERY active lock has cleared, and we only
// remember its pre-lock disabled state on the first lock that grabs it, so the second lock
// can't accidentally re-enable a button the first lock is still holding shut.
const activeLockReasons = new Set();

function isTradingLocked() {
    return isSessionLocked() || isChallengeLocked();
}

function tradingLockMessage() {
    if (isSessionLocked() && isChallengeLocked()) {
        return `[Locked] Trading is locked \u2014 session locked until ${formatClock(sessionState.lockedUntilTimestamp)}, challenge day locked until ${formatClock(challengeState.lockedUntilTimestamp)}.`;
    }
    if (isChallengeLocked()) {
        return `[Challenge] Trading is locked until ${formatClock(challengeState.lockedUntilTimestamp)} (tomorrow's day opens then).`;
    }
    return "[Session] Trading is locked until the next session opens.";
}

function formatClock(ts) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function checkSessionRollover() {
    if (!sessionState.active) return;
    const idx = computeGlobalIndexForNow();
    if (idx === null) return;

    if (sessionState.currentGlobalIndex === null) {
        sessionState.currentGlobalIndex = idx;
        saveSessionState();
        renderSessionUI();
        return;
    }

    if (idx !== sessionState.currentGlobalIndex) {
        sessionState.currentGlobalIndex = idx;
        sessionState.sessionProfit = 0;
        sessionState.lockedUntilTimestamp = null;
        saveSessionState();
        applySessionLockToButtons(false);
        const { dayNum, sessionNum } = sessionOfDayLabel(idx);
        logToConsole(`[Session] Day ${dayNum}, Session ${sessionNum} is now open. Good luck.`, "success-msg");
        renderSessionUI();
    }
}

function registerSessionProfit(profitValue) {
    if (!sessionState.active) {
        logToConsole(`[Session] Settled amount (${profitValue >= 0 ? '+' : ''}${profitValue.toFixed(2)}) but no session is running \u2014 click "Start Session Tracker" to begin.`, "system-msg");
        return;
    }
    checkSessionRollover();
    if (isSessionLocked()) {
        logToConsole(`[Session] Settled amount (${profitValue >= 0 ? '+' : ''}${profitValue.toFixed(2)}) but this session is locked \u2014 not counted.`, "system-msg");
        return;
    }

    sessionState.sessionProfit += profitValue;
    const idx = sessionState.currentGlobalIndex;
    sessionState.log[idx] = { profit: sessionState.sessionProfit, hit: false };

    const target = sessionTargetAmount();
    logToConsole(`[Session] Session P/L now $${sessionState.sessionProfit.toFixed(2)} of $${target.toFixed(2)} target.`, "system-msg");

    if (Math.round(sessionState.sessionProfit * 100) >= Math.round(target * 100)) {
        lockCurrentSession();
    } else {
        saveSessionState();
        renderSessionUI();
    }
}

function lockCurrentSession() {
    const idx = sessionState.currentGlobalIndex;
    sessionState.log[idx] = { profit: sessionState.sessionProfit, hit: true };
    const { end } = sessionWindow(idx);
    sessionState.lockedUntilTimestamp = end;
    saveSessionState();

    haltAllAutoModes();
    applySessionLockToButtons(true);

    const { dayNum, sessionNum } = sessionOfDayLabel(idx);
    logToConsole(`[Session] Day ${dayNum} Session ${sessionNum} target of $${sessionTargetAmount().toFixed(2)} reached \u2014 locked until ${formatClock(end)}.`, "success-msg");
    renderSessionUI();
}

function applyTradingLock(reason, locked) {
    if (locked) activeLockReasons.add(reason); else activeLockReasons.delete(reason);
    const shouldLock = activeLockReasons.size > 0;

    SESSION_LOCK_BUTTON_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (shouldLock) {
            if (el.dataset.preLockDisabled === undefined) {
                el.dataset.preLockDisabled = el.disabled ? "1" : "0";
            }
            el.disabled = true;
            el.classList.add('challenge-locked-btn');
        } else {
            el.classList.remove('challenge-locked-btn');
            if (el.dataset.preLockDisabled === "0") el.disabled = false;
            delete el.dataset.preLockDisabled;
        }
    });
}
// Old name kept as an alias so the Session Tracker's existing calls need no changes.
function applySessionLockToButtons(locked) { applyTradingLock('session', locked); }

function startSessionTracker() {
    const target = parseFloat(sessionDailyTargetInput.value) || 10;
    const count = parseInt(sessionsPerDayInput.value, 10) || 4;
    const now = Date.now();

    sessionState = {
        active: true,
        dailyTarget: target,
        sessionsPerDay: count,
        anchorTimestamp: now,
        currentGlobalIndex: 0,
        sessionProfit: 0,
        lockedUntilTimestamp: null,
        log: {}
    };
    saveSessionState();

    sessionDailyTargetInput.disabled = true;
    sessionsPerDayInput.disabled = true;
    btnStartSession.disabled = true;

    const intervalHrs = (sessionIntervalMs() / 3600000).toFixed(1);
    logToConsole(`[Session] Started: $${target.toFixed(2)}/day target across ${count} sessions ($${(target / count).toFixed(2)} each, ~${intervalHrs}h apart, anchored to now).`, "success-msg");
    renderSessionUI();
}

function resetSessionTracker() {
    if (!confirm("Reset the session tracker? Your schedule and progress will be cleared.")) return;
    sessionState = defaultSessionState();
    saveSessionState();

    sessionDailyTargetInput.disabled = false;
    sessionsPerDayInput.disabled = false;
    btnStartSession.disabled = false;
    applySessionLockToButtons(false);

    logToConsole("[Session] Reset. Set your targets and start again whenever you're ready.", "system-msg");
    renderSessionUI();
}

function renderSessionUI() {
    if (!sessionTableBody) return;

    if (!sessionState.active) {
        if (sessionStatusBanner) sessionStatusBanner.style.display = 'none';
        if (sessionProgressDisplay) sessionProgressDisplay.style.display = 'none';
        sessionTableBody.innerHTML = '';
        if (sessionScheduleNote) sessionScheduleNote.textContent = '';
        return;
    }

    sessionDailyTargetInput.value = sessionState.dailyTarget.toFixed(2);
    sessionsPerDayInput.value = sessionState.sessionsPerDay;
    sessionDailyTargetInput.disabled = true;
    sessionsPerDayInput.disabled = true;
    btnStartSession.disabled = true;

    const idx = sessionState.currentGlobalIndex ?? 0;
    const { dayNum, sessionNum } = sessionOfDayLabel(idx);
    const target = sessionTargetAmount();

    sessionStatusBanner.style.display = 'flex';
    sessionProgressDisplay.style.display = 'flex';

    sessionCurrentLabel.textContent = `Day ${dayNum} \u00b7 Session ${sessionNum} of ${sessionState.sessionsPerDay}`;
    sessionProfitLabel.textContent = sessionState.sessionProfit.toFixed(2);
    sessionTargetLabel.textContent = target.toFixed(2);
    const pct = Math.max(0, Math.min(100, (sessionState.sessionProfit / target) * 100));
    if (sessionProgressFill) sessionProgressFill.style.width = `${pct}%`;

    if (isSessionLocked()) {
        const nextSessionNum = sessionNum < sessionState.sessionsPerDay ? sessionNum + 1 : 1;
        sessionStatusBanner.className = 'challenge-banner locked';
        sessionStatusBanner.textContent = `\uD83D\uDD12 Session ${sessionNum} target hit \u2014 locked until ${formatClock(sessionState.lockedUntilTimestamp)} (Session ${nextSessionNum} opens then).`;
    } else {
        sessionStatusBanner.className = 'challenge-banner active';
        sessionStatusBanner.textContent = `Session ${sessionNum} in progress \u2014 target is $${target.toFixed(2)}.`;
    }

    const dayStartIndex = (dayNum - 1) * sessionState.sessionsPerDay;
    sessionTableBody.innerHTML = '';
    const scheduleTimes = [];
    for (let i = 0; i < sessionState.sessionsPerDay; i++) {
        const globalIdx = dayStartIndex + i;
        const { start, end } = sessionWindow(globalIdx);
        scheduleTimes.push(formatClock(start));
        const entry = sessionState.log[globalIdx];
        const isCurrent = globalIdx === idx;
        const isPast = end <= Date.now();

        const tr = document.createElement('tr');
        if (entry && entry.hit) tr.classList.add('day-complete');
        if (isCurrent) tr.classList.add('day-current');
        if (!isCurrent && !isPast) tr.classList.add('day-locked-future');

        let statusHtml;
        if (entry && entry.hit) {
            statusHtml = `<span class="challenge-check">\u2714</span>`;
        } else if (isPast) {
            statusHtml = `<span class="challenge-check pending">\u2715 missed</span>`;
        } else if (isCurrent) {
            statusHtml = `<span class="challenge-check pending">\u25cf live</span>`;
        } else {
            statusHtml = `<span class="challenge-check pending">\u2014</span>`;
        }

        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${formatClock(start)} - ${formatClock(end)}</td>
            <td>$${target.toFixed(2)}</td>
            <td>$${entry ? entry.profit.toFixed(2) : '0.00'}</td>
            <td style="text-align:center;">${statusHtml}</td>
        `;
        sessionTableBody.appendChild(tr);
    }

    if (sessionScheduleNote) {
        sessionScheduleNote.textContent = `Your daily schedule (set by when you first started): ${scheduleTimes.join(' \u00b7 ')}`;
    }
}


// --- CHALLENGE MODE (day-by-day compounding plan) ---
// Same idea as a fixed $2 -> 30%/day plan, but every number is adjustable: starting capital,
// the daily growth percentage, and how many days. One "day" is a single 24-hour window
// anchored to when you hit Start (like the Session Tracker's schedule, but 1 slot per day).
// Each day's target is a PERCENTAGE of that day's actual starting capital, and the next day's
// starting capital is whatever you actually ended the previous day with (not the idealized
// target) - so a day that undershoots or overshoots its target still compounds correctly.
const CHALLENGE_STORAGE_KEY = 'we_trade_challenge_v1';
const CHALLENGE_DAY_MS = 24 * 60 * 60 * 1000;

const challengeStartingCapitalInput = document.getElementById('challenge-starting-capital');
const challengeDailyPctInput = document.getElementById('challenge-daily-pct');
const challengeDaysInput = document.getElementById('challenge-days');
const btnStartChallenge = document.getElementById('btn-start-challenge');
const btnResetChallenge = document.getElementById('btn-reset-challenge');
const challengeStatusBanner = document.getElementById('challenge-status-banner');
const challengeProgressDisplay = document.getElementById('challenge-progress-display');
const challengeCurrentLabel = document.getElementById('challenge-current-label');
const challengeProfitLabel = document.getElementById('challenge-profit-label');
const challengeTargetLabel = document.getElementById('challenge-target-label');
const challengeProgressFill = document.getElementById('challenge-progress-fill');
const challengeTableBody = document.getElementById('challenge-table-body');
const btnToggleChallengeTable = document.getElementById('btn-toggle-challenge-table');

function defaultChallengeState() {
    return {
        active: false,
        startingCapital: 2.00,
        dailyGrowthPct: 30,
        totalDays: 30,
        anchorTimestamp: null,
        currentDayIndex: null,   // 0-based
        dayStartCapital: null,   // this day's actual starting capital
        dayProfit: 0,            // this day's actual settled P/L so far
        lockedUntilTimestamp: null,
        completed: false,
        log: {}                  // dayIndex -> { startCapital, target, profit, endCapital, hit }
    };
}

function loadChallengeState() {
    try {
        const raw = localStorage.getItem(CHALLENGE_STORAGE_KEY);
        if (!raw) return defaultChallengeState();
        return { ...defaultChallengeState(), ...JSON.parse(raw) };
    } catch (e) {
        return defaultChallengeState();
    }
}

function saveChallengeState() {
    try { localStorage.setItem(CHALLENGE_STORAGE_KEY, JSON.stringify(challengeState)); } catch (e) { /* ignore */ }
}

let challengeState = loadChallengeState();
let challengeTableExpanded = false; // collapsed by default: shows just the current (or final) day

function challengeDayTargetAmount() {
    return challengeState.dayStartCapital * (challengeState.dailyGrowthPct / 100);
}

function computeChallengeDayIndexForNow() {
    if (challengeState.anchorTimestamp === null) return null;
    return Math.floor((Date.now() - challengeState.anchorTimestamp) / CHALLENGE_DAY_MS);
}

function challengeDayWindow(dayIndex) {
    const start = challengeState.anchorTimestamp + dayIndex * CHALLENGE_DAY_MS;
    return { start, end: start + CHALLENGE_DAY_MS };
}

function isChallengeLocked() {
    return challengeState.active && !challengeState.completed &&
        challengeState.lockedUntilTimestamp !== null && Date.now() < challengeState.lockedUntilTimestamp;
}

function checkChallengeRollover() {
    if (!challengeState.active || challengeState.completed) return;
    const idx = computeChallengeDayIndexForNow();
    if (idx === null || idx === challengeState.currentDayIndex) return;

    if (idx >= challengeState.totalDays) {
        // Challenge window has fully elapsed - stop advancing, leave the schedule as a final report.
        challengeState.completed = true;
        applyTradingLock('challenge', false);
        saveChallengeState();
        logToConsole(`[Challenge] The ${challengeState.totalDays}-day window has ended. Start a new challenge whenever you're ready.`, "system-msg");
        renderChallengeUI();
        return;
    }

    // Roll forward one day at a time so every day in between gets a log entry, even ones with
    // no trades (start capital just carries over unchanged on an untraded day).
    while (challengeState.currentDayIndex < idx) {
        const finishedIdx = challengeState.currentDayIndex;
        const finishedStart = challengeState.dayStartCapital;
        const finishedEnd = finishedStart + challengeState.dayProfit;
        challengeState.log[finishedIdx] = {
            startCapital: finishedStart,
            target: challengeDayTargetAmount(),
            profit: challengeState.dayProfit,
            endCapital: finishedEnd,
            hit: !!(challengeState.log[finishedIdx] && challengeState.log[finishedIdx].hit)
        };
        challengeState.currentDayIndex++;
        challengeState.dayStartCapital = finishedEnd;  // compound on what actually happened
        challengeState.dayProfit = 0;
    }
    challengeState.lockedUntilTimestamp = null;
    applyTradingLock('challenge', false);
    saveChallengeState();
    logToConsole(`[Challenge] Day ${challengeState.currentDayIndex + 1} of ${challengeState.totalDays} is now open. Starting capital: $${challengeState.dayStartCapital.toFixed(2)}.`, "success-msg");
    renderChallengeUI();
}

function registerChallengeProfit(profitValue) {
    checkChallengeRollover();
    if (!challengeState.active || challengeState.completed) return;
    if (isChallengeLocked()) {
        logToConsole(`[Challenge] Settled amount (${profitValue >= 0 ? '+' : ''}${profitValue.toFixed(2)}) but today's day is locked \u2014 not counted.`, "system-msg");
        return;
    }

    challengeState.dayProfit += profitValue;
    const idx = challengeState.currentDayIndex;
    const target = challengeDayTargetAmount();
    challengeState.log[idx] = {
        startCapital: challengeState.dayStartCapital,
        target,
        profit: challengeState.dayProfit,
        endCapital: challengeState.dayStartCapital + challengeState.dayProfit,
        hit: false
    };

    logToConsole(`[Challenge] Day ${idx + 1} P/L now $${challengeState.dayProfit.toFixed(2)} of $${target.toFixed(2)} target.`, "system-msg");

    if (Math.round(challengeState.dayProfit * 100) >= Math.round(target * 100)) {
        lockCurrentChallengeDay();
    } else {
        saveChallengeState();
        renderChallengeUI();
    }
}

function lockCurrentChallengeDay() {
    const idx = challengeState.currentDayIndex;
    const target = challengeDayTargetAmount();
    challengeState.log[idx] = {
        startCapital: challengeState.dayStartCapital,
        target,
        profit: challengeState.dayProfit,
        endCapital: challengeState.dayStartCapital + challengeState.dayProfit,
        hit: true
    };
    const { end } = challengeDayWindow(idx);
    challengeState.lockedUntilTimestamp = end;
    saveChallengeState();

    haltAllAutoModes();
    applyTradingLock('challenge', true);

    const isLastDay = idx + 1 >= challengeState.totalDays;
    if (isLastDay) {
        challengeState.completed = true;
        saveChallengeState();
        logToConsole(`[Challenge] \uD83C\uDFC1 Day ${idx + 1} target hit \u2014 that's all ${challengeState.totalDays} days! Final balance: $${challengeState.log[idx].endCapital.toFixed(2)}.`, "success-msg");
    } else {
        logToConsole(`[Challenge] Day ${idx + 1} target of $${target.toFixed(2)} reached \u2014 locked until ${formatClock(end)} (Day ${idx + 2} opens then).`, "success-msg");
    }
    renderChallengeUI();
}

function startChallenge() {
    const startingCapital = parseFloat(challengeStartingCapitalInput.value) || 2.00;
    const dailyPct = parseFloat(challengeDailyPctInput.value) || 30;
    const totalDays = parseInt(challengeDaysInput.value, 10) || 30;
    const now = Date.now();

    challengeState = {
        active: true,
        startingCapital,
        dailyGrowthPct: dailyPct,
        totalDays,
        anchorTimestamp: now,
        currentDayIndex: 0,
        dayStartCapital: startingCapital,
        dayProfit: 0,
        lockedUntilTimestamp: null,
        completed: false,
        log: {}
    };
    saveChallengeState();

    challengeStartingCapitalInput.disabled = true;
    challengeDailyPctInput.disabled = true;
    challengeDaysInput.disabled = true;
    btnStartChallenge.disabled = true;

    logToConsole(`[Challenge] Started: $${startingCapital.toFixed(2)} starting capital, ${dailyPct}%/day, ${totalDays} days. Day 1 opens now.`, "success-msg");
    renderChallengeUI();
}

function resetChallenge() {
    if (!confirm("Reset Challenge Mode? Your schedule and progress will be cleared.")) return;
    challengeState = defaultChallengeState();
    saveChallengeState();

    challengeStartingCapitalInput.disabled = false;
    challengeDailyPctInput.disabled = false;
    challengeDaysInput.disabled = false;
    btnStartChallenge.disabled = false;
    applyTradingLock('challenge', false);

    logToConsole("[Challenge] Reset. Set your starting capital and targets and start again whenever you're ready.", "system-msg");
    renderChallengeUI();
}

function renderChallengeUI() {
    if (!challengeTableBody) return;

    if (!challengeState.active) {
        if (challengeStatusBanner) challengeStatusBanner.style.display = 'none';
        if (challengeProgressDisplay) challengeProgressDisplay.style.display = 'none';
        if (btnToggleChallengeTable) btnToggleChallengeTable.style.display = 'none';
        challengeTableBody.innerHTML = '';
        return;
    }

    challengeStartingCapitalInput.value = challengeState.startingCapital.toFixed(2);
    challengeDailyPctInput.value = challengeState.dailyGrowthPct;
    challengeDaysInput.value = challengeState.totalDays;
    challengeStartingCapitalInput.disabled = true;
    challengeDailyPctInput.disabled = true;
    challengeDaysInput.disabled = true;
    btnStartChallenge.disabled = true;

    const idx = challengeState.currentDayIndex ?? 0;
    const target = challengeState.completed ? 0 : challengeDayTargetAmount();

    challengeStatusBanner.style.display = 'flex';

    if (btnToggleChallengeTable) {
        btnToggleChallengeTable.style.display = 'inline-block';
        btnToggleChallengeTable.textContent = challengeTableExpanded ? "Hide (Show Current Day Only)" : "View All Days";
    }

    if (challengeState.completed) {
        challengeProgressDisplay.style.display = 'none';
        const lastEntry = challengeState.log[challengeState.totalDays - 1];
        challengeStatusBanner.className = 'challenge-banner active';
        challengeStatusBanner.textContent = lastEntry && lastEntry.hit
            ? `\uD83C\uDFC1 Challenge complete! Final balance: $${lastEntry.endCapital.toFixed(2)} after ${challengeState.totalDays} days.`
            : `Challenge window ended after ${challengeState.totalDays} days. Reset to start a new one.`;
        challengeTableBody.innerHTML = '';
        if (challengeTableExpanded) {
            for (let i = 0; i < challengeState.totalDays; i++) {
                challengeTableBody.appendChild(buildChallengeRow(i, -1));
            }
        } else {
            challengeTableBody.appendChild(buildChallengeRow(challengeState.totalDays - 1, -1));
        }
        return;
    }

    challengeProgressDisplay.style.display = 'flex';
    challengeCurrentLabel.textContent = `Day ${idx + 1} of ${challengeState.totalDays}`;
    challengeProfitLabel.textContent = challengeState.dayProfit.toFixed(2);
    challengeTargetLabel.textContent = target.toFixed(2);
    const pct = Math.max(0, Math.min(100, (challengeState.dayProfit / target) * 100));
    if (challengeProgressFill) challengeProgressFill.style.width = `${pct}%`;

    if (isChallengeLocked()) {
        challengeStatusBanner.className = 'challenge-banner locked';
        challengeStatusBanner.textContent = `\uD83D\uDD12 Day ${idx + 1} target hit \u2014 locked until ${formatClock(challengeState.lockedUntilTimestamp)} (Day ${idx + 2} opens then).`;
    } else {
        challengeStatusBanner.className = 'challenge-banner active';
        challengeStatusBanner.textContent = `Day ${idx + 1} in progress \u2014 starting capital $${challengeState.dayStartCapital.toFixed(2)}, target $${target.toFixed(2)}.`;
    }

    challengeTableBody.innerHTML = '';
    if (challengeTableExpanded) {
        for (let i = 0; i < challengeState.totalDays; i++) {
            challengeTableBody.appendChild(buildChallengeRow(i, idx));
        }
    } else {
        challengeTableBody.appendChild(buildChallengeRow(idx, idx));
    }
}

function buildChallengeRow(i, currentIdx) {
    const entry = challengeState.log[i];
    const isCurrent = i === currentIdx;
    const isPast = i < currentIdx;
    const isFuture = i > currentIdx;

    // A day with no log entry yet (future, or the challenge ended before reaching it) is shown
    // at its PROJECTED figures (as-if the daily % is hit every day), same as the PDF's table,
    // so the whole schedule is visible up front even before you've traded it.
    let startCap, targetAmt, endCap;
    if (entry) {
        startCap = entry.startCapital; targetAmt = entry.target; endCap = entry.endCapital;
    } else {
        let projStart = challengeState.startingCapital;
        for (let d = 0; d < i; d++) {
            const priorEntry = challengeState.log[d];
            projStart = priorEntry ? priorEntry.endCapital : projStart * (1 + challengeState.dailyGrowthPct / 100);
        }
        startCap = projStart;
        targetAmt = projStart * (challengeState.dailyGrowthPct / 100);
        endCap = projStart + targetAmt;
    }

    const tr = document.createElement('tr');
    if (entry && entry.hit) tr.classList.add('day-complete');
    if (isCurrent) tr.classList.add('day-current');
    if (isFuture) tr.classList.add('day-locked-future');

    let statusHtml;
    if (entry && entry.hit) {
        statusHtml = `<span class="challenge-check">\u2714</span>`;
    } else if (isPast) {
        statusHtml = `<span class="challenge-check pending">\u2715 missed</span>`;
    } else if (isCurrent) {
        statusHtml = `<span class="challenge-check pending">\u25cf live</span>`;
    } else {
        statusHtml = `<span class="challenge-check pending">projected</span>`;
    }

    tr.innerHTML = `
        <td>${i + 1}</td>
        <td>$${startCap.toFixed(2)}</td>
        <td>$${targetAmt.toFixed(2)}</td>
        <td>${entry ? '$' + entry.profit.toFixed(2) : '\u2014'}</td>
        <td>${entry ? '$' + endCap.toFixed(2) : '$' + endCap.toFixed(2) + ' (proj.)'}</td>
        <td style="text-align:center;">${statusHtml}</td>
    `;
    return tr;
}

if (btnStartChallenge) btnStartChallenge.addEventListener('click', startChallenge);
if (btnResetChallenge) btnResetChallenge.addEventListener('click', resetChallenge);
if (btnToggleChallengeTable) btnToggleChallengeTable.addEventListener('click', () => {
    challengeTableExpanded = !challengeTableExpanded;
    renderChallengeUI();
});

checkChallengeRollover();
if (challengeState.active) applyTradingLock('challenge', isChallengeLocked());
renderChallengeUI();
setInterval(() => { checkChallengeRollover(); renderChallengeUI(); }, 30 * 1000);

// --- LEDGER-DRIVEN SETTLEMENT WATCHER ---
function extractProfitFromLedgerCell(cellEl) {
    if (!cellEl) return null;
    const match = (cellEl.textContent || '').match(/[-+]?\d*\.?\d+/);
    if (!match) return null;
    const value = parseFloat(match[0]);
    return isNaN(value) ? null : value;
}

// Feeds one settled amount to every tracker that is currently running (Session Tracker,
// Challenge Mode, both, or neither). Each tracker keeps its own independent bookkeeping.
function registerTrackedProfit(profitValue) {
    let handled = false;
    if (sessionState.active) { registerSessionProfit(profitValue); handled = true; }
    if (challengeState.active && !challengeState.completed) { registerChallengeProfit(profitValue); handled = true; }
    if (!handled) {
        logToConsole(`[Tracker] Settled amount (${profitValue >= 0 ? '+' : ''}${profitValue.toFixed(2)}) but no tracker is running \u2014 start the Session Tracker or Challenge Mode to track it.`, "system-msg");
    }
}

const challengeBatchExpectedCounts = {};
const challengeBatchAccumulators = {};

function handleLedgerMutations(mutationsList) {
    mutationsList.forEach(mutation => {
        if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') return;
        const cell = mutation.target;
        if (!cell.classList || !(cell.classList.contains('text-win') || cell.classList.contains('text-loss'))) return;
        if (cell.dataset.challengeCounted === '1') return;

        const profitValue = extractProfitFromLedgerCell(cell);
        cell.dataset.challengeCounted = '1';
        if (profitValue === null) {
            logToConsole("[Session] Ledger row settled but its P/L couldn't be read \u2014 not counted.", "error-msg");
            return;
        }

        const row = cell.closest ? cell.closest('tr') : null;
        const batchKey = row ? row.dataset.batchKey : null;

        if (!batchKey) {
            registerTrackedProfit(profitValue);
            return;
        }

        const expected = challengeBatchExpectedCounts[batchKey] || 1;
        const acc = challengeBatchAccumulators[batchKey] || { settled: 0, profitSum: 0 };
        acc.settled += 1;
        acc.profitSum += profitValue;
        challengeBatchAccumulators[batchKey] = acc;

        if (acc.settled >= expected) {
            delete challengeBatchAccumulators[batchKey];
            delete challengeBatchExpectedCounts[batchKey];
            logToConsole(`[Session] Batch ${batchKey} fully settled (${expected} leg${expected > 1 ? 's' : ''}), net $${acc.profitSum.toFixed(2)}.`, "system-msg");
            registerTrackedProfit(acc.profitSum);
        }
    });
}

let sessionLedgerObserver = null;
function initSessionLedgerObserver() {
    if (!ledgerBody || sessionLedgerObserver) return;
    sessionLedgerObserver = new MutationObserver(handleLedgerMutations);
    sessionLedgerObserver.observe(ledgerBody, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });
    logToConsole("[Session] Now watching the Live Bulk Strategy Ledger for settled trades.", "system-msg");
}

if (btnStartSession) btnStartSession.addEventListener('click', startSessionTracker);
if (btnResetSession) btnResetSession.addEventListener('click', resetSessionTracker);

checkSessionRollover();
if (sessionState.active) applySessionLockToButtons(isSessionLocked());
renderSessionUI();
initSessionLedgerObserver();
setInterval(() => { checkSessionRollover(); renderSessionUI(); }, 30 * 1000);


(function initQuickNavScrollspy() {
    const navLinks = document.querySelectorAll('.quick-nav-link');
    if (!navLinks.length) return;

    const targets = Array.from(navLinks)
        .map(link => document.querySelector(link.getAttribute('href')))
        .filter(Boolean);

    if (!targets.length || !('IntersectionObserver' in window)) return;

    const linkFor = (id) => document.querySelector(`.quick-nav-link[href="#${id}"]`);

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const link = linkFor(entry.target.id);
            if (!link) return;
            if (entry.isIntersecting) {
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    }, { rootMargin: '-45% 0px -50% 0px' });

    targets.forEach(t => observer.observe(t));
})();


// =====================================================================
// HEDGING TOOL - Over + Under bought together (default Over 5 / Under 4)
// One leg wins whenever the last digit lands outside the gap between the two
// barriers; both legs lose when it lands inside the gap (4 or 5 by default).
// =====================================================================
const btnBuyHG = document.getElementById('btn-buy-hg');
const btnToggleAutoHG = document.getElementById('btn-toggle-auto-hg');
const btnResetHG = document.getElementById('btn-reset-hg');
const hgOverInput = document.getElementById('hg-over-digit');
const hgUnderInput = document.getElementById('hg-under-digit');
const hgStakeInput = document.getElementById('hg-stake');
const hgDurationInput = document.getElementById('hg-duration');
const hgPairsInput = document.getElementById('hg-pairs');
const hgMaxRunsInput = document.getElementById('hg-max-runs');
const hgSignalCheckbox = document.getElementById('hg-signal-trigger');
const hgDigitHistoryDisplay = document.getElementById('hg-digit-history');
const hgSignalStatusDisplay = document.getElementById('hg-signal-status');
const hgRunCountDisplay = document.getElementById('hg-run-count');
const hgWinCountDisplay = document.getElementById('hg-win-count');
const hgLossCountDisplay = document.getElementById('hg-loss-count');
const hgNetPlDisplay = document.getElementById('hg-net-pl');

let isAutoTradingHG = false;
let hgCooldown = false;
let hgCooldownTimer = null;
let hgRunsFired = 0;
let hgWinRuns = 0;
let hgLossRuns = 0;
let hgNetPL = 0;
const hgContractToRun = {};   // contract_id -> run id
const hgRunState = {};        // run id -> { open, profit, legs }

function getHedgeDigits() {
    const over = parseInt(hgOverInput.value, 10);
    const under = parseInt(hgUnderInput.value, 10);
    if (isNaN(over) || over < 0 || over > 8) return { error: "Over digit must be between 0 and 8." };
    if (isNaN(under) || under < 1 || under > 9) return { error: "Under digit must be between 1 and 9." };
    if (over < under - 1) return { error: "Over digit must be at least Under digit minus 1, otherwise the two legs overlap." };
    return { over, under };
}

// The "gap" is every digit that loses BOTH legs (Over 5 loses on 0-5, Under 4 loses on 4-9, so 4 and 5).
function hedgeGapDigits(over, under) {
    const gap = [];
    for (let d = 0; d <= 9; d++) {
        if (d <= over && d >= under) gap.push(d);
    }
    return gap;
}

function hedgeSignalActive() {
    const digits = getHedgeDigits();
    if (digits.error || recentDigitHistoryHG.length < 3) return false;
    const gap = hedgeGapDigits(digits.over, digits.under);
    if (!gap.length) return false;
    return recentDigitHistoryHG.every(d => gap.includes(d));
}

function updateHedgeSignalUI() {
    if (hgTickQueue) { const f = hgTickQueue; hgTickQueue = null; clearTimeout(hgTickQueueTimer); f(); }
    hgTickCountdown();
    if (typeof rfTickCountdown === 'function') rfTickCountdown();
    if (hgMarketPrice) hgMarketPrice.textContent = liveTickValue.textContent;
    if (hgMarketLabel && marketDropdown.selectedOptions[0]) hgMarketLabel.value = marketDropdown.selectedOptions[0].text;
    if (hgDigitHistoryDisplay) {
        hgDigitHistoryDisplay.textContent = recentDigitHistoryHG.length
            ? recentDigitHistoryHG.join(' ')
            : '-- -- --';
    }
    if (hgSignalStatusDisplay) {
        const active = hedgeSignalActive();
        hgSignalStatusDisplay.textContent = active ? 'STRONG SIGNAL' : 'Waiting';
        hgSignalStatusDisplay.className = active ? 'success-msg' : 'system-msg';
    }
}

function updateHedgeStatsUI() {
    if (hgRunCountDisplay) hgRunCountDisplay.textContent = hgRunsFired;
    if (hgWinCountDisplay) hgWinCountDisplay.textContent = hgWinRuns;
    if (hgLossCountDisplay) hgLossCountDisplay.textContent = hgLossRuns;
    if (hgNetPlDisplay) {
        hgNetPlDisplay.textContent = `${hgNetPL >= 0 ? '+' : ''}${hgNetPL.toFixed(2)}`;
        hgNetPlDisplay.style.color = hgNetPL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    }
}

function releaseHedgeCooldown() {
    hgCooldown = false;
    if (hgCooldownTimer) { clearTimeout(hgCooldownTimer); hgCooldownTimer = null; }
}

function executeHedgePair(sourceLabel) {
    if (isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return false;
    }
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) {
        logToConsole("Error: Real-time stream must be connected before running trades.", "error-msg");
        return false;
    }
    const digits = getHedgeDigits();
    if (digits.error) {
        logToConsole(`[Hedge] ${digits.error}`, "error-msg");
        return false;
    }
    const stake = parseFloat(hgStakeInput.value);
    const duration = parseInt(hgDurationInput.value, 10);
    const pairs = Math.max(1, parseInt(hgPairsInput.value, 10) || 1);
    if (!(stake > 0) || !(duration >= 1)) {
        logToConsole("[Hedge] Enter a valid stake and duration.", "error-msg");
        return false;
    }

    const symbol = marketDropdown.value;
    const currency = currencyText.textContent || "USD";
    const runToken = "HEDGE_" + Date.now();
    const mStake = parseFloat(document.getElementById('hg-matches-stake').value);
    const coverDigits = (document.getElementById('hg-matches-cover').checked && mStake > 0) ? hedgeGapDigits(digits.over, digits.under) : [];
    const totalLegs = pairs * 2 + coverDigits.length;
    challengeBatchExpectedCounts[runToken] = totalLegs;
    batchSyncExpected[runToken] = totalLegs;
    hgRunState[runToken] = { open: totalLegs, profit: 0, legs: totalLegs };

    const buildPayload = (contractType, barrier, amt = stake) => JSON.stringify({
        "buy": 1,
        "price": amt,
        "subscribe": 1,
        "parameters": {
            "amount": amt,
            "basis": "stake",
            "contract_type": contractType,
            "currency": currency,
            "duration": duration,
            "duration_unit": "t",
            "underlying_symbol": symbol,
            "barrier": String(barrier)
        },
        "passthrough": { "bulkRunId": runToken }
    });
    const overPayload = buildPayload("DIGITOVER", digits.over);
    const underPayload = buildPayload("DIGITUNDER", digits.under);

    for (let i = 0; i < pairs; i++) {
        optionsWebSocket.send(overPayload);
        optionsWebSocket.send(underPayload);
    }
    coverDigits.forEach(d => optionsWebSocket.send(buildPayload("DIGITMATCH", d, mStake)));

    hgRunsFired += 1;
    hgCooldown = true;
    updateHedgeStatsUI();
    // Safety net: if a receipt/settlement never arrives, don't stay frozen forever.
    if (hgCooldownTimer) clearTimeout(hgCooldownTimer);
    hgCooldownTimer = setTimeout(() => { hgCooldown = false; hgCooldownTimer = null; }, (duration * 2000) + 8000);

    logToConsole(`[Hedge] ${sourceLabel}: fired ${pairs} pair(s) - Over ${digits.over} + Under ${digits.under} (${pairs * 2} contracts, ${(stake * pairs * 2).toFixed(2)} ${currency} total stake). Both lose on ${hedgeGapDigits(digits.over, digits.under).join(' / ')}.`, "success-msg");
    return true;
}

function handleHedgeTick() {
    if (!isAutoTradingHG || hgCooldown) return;

    const maxRuns = parseInt(hgMaxRunsInput.value, 10) || 10;
    if (hgRunsFired >= maxRuns) {
        logToConsole(`[Hedge] Max runs reached (${hgRunsFired}/${maxRuns}). Stopping auto mode.`, "system-msg");
        toggleAutoHG(false);
        return;
    }

    if (hgSignalCheckbox && hgSignalCheckbox.checked && !hedgeSignalActive()) return;

    const fired = executeHedgePair(hgSignalCheckbox && hgSignalCheckbox.checked ? "Signal matched" : "Auto entry");
    if (fired) recentDigitHistoryHG = []; // require a fresh 3-digit signal for the next entry
}

function handleHedgeContractSettled(contract) {
    const runId = hgContractToRun[contract.contract_id];
    const pick = k => contract[k] != null ? `${k}=${contract[k]}` : null;
    logToConsole(`[Hedge] Leg #${contract.contract_id} details: ${['contract_type', 'selected_tick', 'tick_count', 'entry_spot', 'exit_spot', 'entry_tick_time', 'exit_tick_time', 'date_start', 'date_expiry', 'sell_time', 'status'].map(pick).filter(Boolean).join(', ')}`, "system-msg");
    delete hgContractToRun[contract.contract_id];
    const run = hgRunState[runId];
    if (!run) return;

    const profit = parseFloat(contract.profit);
    run.profit += isNaN(profit) ? 0 : profit;
    run.open -= 1;
    if (run.open > 0) return;

    delete hgRunState[runId];
    hgFinishCountdown(runId);
    hgNetPL += run.profit;
    if (run.profit > 0) hgWinRuns += 1;
    else if (run.profit < 0) hgLossRuns += 1;
    updateHedgeStatsUI();
    releaseHedgeCooldown();
    logToConsole(`[Hedge] Run settled: net ${run.profit >= 0 ? '+' : ''}${run.profit.toFixed(2)} ${contract.currency || 'USD'} (${run.profit > 0 ? 'one side won' : run.profit < 0 ? 'both legs lost / net loss' : 'break-even'}).`, run.profit >= 0 ? "success-msg" : "error-msg");
}

function toggleAutoHG(state) {
    if (state && isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    if (state) {
        const digits = getHedgeDigits();
        if (digits.error) {
            logToConsole(`[Hedge] ${digits.error}`, "error-msg");
            return;
        }
    }
    isAutoTradingHG = state;
    btnToggleAutoHG.textContent = state ? "Stop Auto Hedge" : "Start Auto Hedge";
    btnToggleAutoHG.classList.toggle('stream-active', state);

    [hgOverInput, hgUnderInput, hgStakeInput, hgDurationInput, hgPairsInput, hgMaxRunsInput, hgSignalCheckbox]
        .forEach(el => { if (el) el.disabled = state; });

    if (state) {
        releaseHedgeCooldown();
        hgRunsFired = 0;
        recentDigitHistoryHG = [];
        updateHedgeStatsUI();
        const digits = getHedgeDigits();
        logToConsole(hgSignalCheckbox.checked
            ? `[Hedge] Auto mode started. Waiting for the last 3 digits to all be ${hedgeGapDigits(digits.over, digits.under).join(' / ')} before entering (max ${hgMaxRunsInput.value} runs).`
            : `[Hedge] Auto mode started. Entering Over ${digits.over} + Under ${digits.under} back-to-back (max ${hgMaxRunsInput.value} runs).`, "success-msg");
    } else {
        logToConsole("[Hedge] Auto mode stopped.");
    }
}

if (btnBuyHG) btnBuyHG.addEventListener('click', async () => { if (await hgGate()) executeHedgePair("Manual entry"); });
if (btnToggleAutoHG) btnToggleAutoHG.addEventListener('click', async () => { if (isAutoTradingHG || await hgGate()) toggleAutoHG(!isAutoTradingHG); });
if (btnResetHG) btnResetHG.addEventListener('click', () => {
    hgRunsFired = 0; hgWinRuns = 0; hgLossRuns = 0; hgNetPL = 0;
    updateHedgeStatsUI();
    logToConsole("[Hedge] Stats reset.");
});
updateHedgeStatsUI();


// ---------------------------------------------------------------------
// HEDGING TOOL - quote-based strategies (Only Ups/Downs, Touch, No Touch,
// Ends Between/Outside, Stays Between/Goes Outside). Barriers are searched
// so each leg meets the minimum profit %, then both legs are bought together.
// ---------------------------------------------------------------------
const hgStrategySelect = document.getElementById('hg-strategy');
const hgBarrierPanel = document.getElementById('hg-barrier-panel');
const hgDigitPanel = document.getElementById('hg-digit-panel');
const hgBarDurationWrap = document.getElementById('hg-bar-duration-wrap');
const hgBarDuration = document.getElementById('hg-bar-duration');
const hgMinProfit = document.getElementById('hg-min-profit');
const hgBarrierNote = document.getElementById('hg-barrier-note');
const hgMarketPrice = document.getElementById('hg-market-price');
const hgMarketLabel = document.getElementById('hg-market-label');
const btnHgRefresh = document.getElementById('btn-hg-refresh');
const btnHgExecute = document.getElementById('btn-hg-execute');

const HG_STRATS = {
    updown:      { a: { label: 'Only Ups', type: 'RUNHIGH', noBarrier: true }, b: { label: 'Only Downs', type: 'RUNLOW', noBarrier: true },
                   durations: [2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => ({ v, u: 't' })) },
    touch:       { a: { label: 'Touch upper',  type: 'ONETOUCH',   dir: 'wide',   sign: '+' },  b: { label: 'Touch lower',  type: 'ONETOUCH',   dir: 'wide',   sign: '-' } },
    notouch:     { a: { label: 'No Touch upper', type: 'NOTOUCH',  dir: 'narrow', sign: '+' },  b: { label: 'No Touch lower', type: 'NOTOUCH',  dir: 'narrow', sign: '-' } },
    endsbetween: { a: { label: 'Ends Between', type: 'EXPIRYRANGE', dir: 'narrow', range: true }, b: { label: 'Ends Outside', type: 'EXPIRYMISS', dir: 'wide', range: true } },
    hilotick:    { a: { label: 'High Tick', type: 'TICKHIGH', noBarrier: true }, b: { label: 'Low Tick', type: 'TICKLOW', noBarrier: true },
                   durations: [{ v: 5, u: 't' }], defaultMin: 300 },
    asian:       { a: { label: 'Asian Up', type: 'ASIANU', noBarrier: true }, b: { label: 'Asian Down', type: 'ASIAND', noBarrier: true },
                   durations: [5, 6, 7, 8, 9, 10].map(v => ({ v, u: 't' })), defaultMin: 50 },
    reset:       { a: { label: 'Reset Call', type: 'RESETCALL', noBarrier: true }, b: { label: 'Reset Put', type: 'RESETPUT', noBarrier: true },
                   durations: [5, 6, 7, 8, 9, 10].map(v => ({ v, u: 't' })), defaultMin: 50 },
    vanilla:     { a: { label: 'Long Call', type: 'VANILLALONGCALL', vanilla: true }, b: { label: 'Long Put', type: 'VANILLALONGPUT', vanilla: true } },
    stays:       { a: { label: 'Stays Between', type: 'RANGE',     dir: 'narrow', range: true }, b: { label: 'Goes Outside', type: 'UPORDOWN',   dir: 'wide', range: true } }
};
const hgPending = {};
let hgReqId = 900000;
let hgProposalStyle = 0;      // 0 = underlying_symbol, 1 = symbol (auto-switches if the API rejects one)
let hgQuotes = null;          // { strat, a, b, time }
let hgQuoting = false;
let hgDur = { v: 5, u: 't' }; // chosen automatically by hgRefreshQuotes
// Tried shortest first: ticks, then seconds. Unsupported durations are skipped when the API rejects the quote.
const HG_DURATIONS = [{ v: 5, u: 't' }, { v: 10, u: 't' }, ...[15, 30, 45, 60, 90, 120, 180, 300, 600, 900].map(v => ({ v, u: 's' }))];
const hgDurLabel = d => `${d.v} ${d.u === 't' ? 'tick' : d.u === 's' ? 'second' : d.u === 'h' ? 'hour' : d.u === 'd' ? 'day' : 'minute'}${d.v > 1 ? 's' : ''}`;
const hgSeenErrs = new Set();
const hgLimits = {};          // symbol -> contracts_for "available" list (or null if unavailable)
const hgLoggedLimits = new Set();

function hgParseDur(str) {
    const m = /^(\d+)([tsmhd])$/.exec(String(str || ''));
    return m ? { v: parseInt(m[1], 10), u: m[2] } : null;
}
const hgDurSecs = d => d.v * ({ s: 1, m: 60, h: 3600, d: 86400 }[d.u] || 1);

// Reads Deriv's real duration limits for this market (contracts_for) instead of guessing.
async function hgLoadLimits(symbol) {
    if (hgLimits[symbol] !== undefined) return hgLimits[symbol];
    const r = await hgProposal({ contracts_for: symbol, currency: currencyText.textContent || 'USD', product_type: 'basic' });
    const list = r.contracts_for && r.contracts_for.available;
    if (!Array.isArray(list)) {
        logToConsole(`[Hedge] Could not read Deriv's contract limits (${(r.error && r.error.message) || 'no data'}). Trying every duration instead.`, "system-msg");
        return (hgLimits[symbol] = null);
    }
    return (hgLimits[symbol] = list);
}

function hgDurAllowed(list, type, cand) {
    const entries = list.filter(e => e.contract_type === type);
    if (!entries.length) return false;
    return entries.some(e => {
        const mn = hgParseDur(e.min_contract_duration), mx = hgParseDur(e.max_contract_duration);
        if (!mn || !mx) return true;
        if (cand.u === 't') return mn.u === 't' && cand.v >= mn.v && cand.v <= mx.v;
        if (mn.u === 't') return false;
        const s = hgDurSecs(cand);
        return s >= hgDurSecs(mn) && s <= hgDurSecs(mx);
    });
}

function hgLogLimits(symbol, list, strat) {
    [strat.a, strat.b].forEach(leg => {
        const k = `${symbol}|${leg.type}`;
        if (hgLoggedLimits.has(k)) return;
        hgLoggedLimits.add(k);
        const rows = list.filter(e => e.contract_type === leg.type);
        if (!rows.length) { logToConsole(`[Hedge] Deriv does not list ${leg.type} for this market.`, "error-msg"); return; }
        logToConsole(`[Hedge] ${leg.label} (${leg.type}) allowed durations: ${rows.map(e => `${e.min_contract_duration}-${e.max_contract_duration}`).join(', ')}`, "system-msg");
        logToConsole(`[Hedge] ${leg.type} details from Deriv: ${JSON.stringify(rows[0]).slice(0, 450)}`, "system-msg");
    });
}

function hgProposal(payload) {
    return new Promise(resolve => {
        const id = ++hgReqId;
        hgPending[id] = resolve;
        optionsWebSocket.send(JSON.stringify({ ...payload, req_id: id }));
        setTimeout(() => { if (hgPending[id]) { delete hgPending[id]; resolve({ error: { message: 'quote timed out' } }); } }, 8000);
    });
}

function hgBarriers(leg, off, dec) {
    if (leg.vanilla) return { barrier: hgVanillaStrike() };
    const o = off.toFixed(dec);
    return leg.range ? { barrier: '+' + o, barrier2: '-' + o } : { barrier: leg.sign + o };
}

function hgContractParams(leg, off, dec) {
    return {
        amount: parseFloat(hgStakeInput.value), basis: 'stake', contract_type: leg.type,
        currency: currencyText.textContent || 'USD',
        duration: hgDur.v, duration_unit: hgDur.u,
        ...(leg.noBarrier ? {} : hgBarriers(leg, off, dec)),
        ...(/^TICK/.test(leg.type) ? { selected_tick: hgSelTick(leg) } : {})
    };
}

async function hgQuote(leg, off, dec) {
    for (let attempt = 0; attempt < 2; attempt++) {
        const symKey = hgProposalStyle === 0 ? 'underlying_symbol' : 'symbol';
        const r = await hgProposal({ proposal: 1, ...hgContractParams(leg, off, dec), [symKey]: marketDropdown.value });
        if (r.proposal) return r.proposal;
        if (attempt === 0 && r.error && /symbol|underlying|additional|unrecogni|schema/i.test(r.error.message || '')) { hgProposalStyle = 1 - hgProposalStyle; continue; }
        const em = (r.error && r.error.message) || 'unknown error';
        const k = `${leg.label}|${hgDurLabel(hgDur)}|${em}`;
        if (!hgSeenErrs.has(k)) {
            hgSeenErrs.add(k);
            logToConsole(`[Hedge] ${leg.label} quote rejected (${hgDurLabel(hgDur)}, barrier ${off.toFixed(dec)}): ${em}`, "error-msg");
        }
        return { error: r.error };
    }
}

// Finds the barrier offset closest to spot (highest win chance) that still meets minPct.
// "Invalid barrier" replies are treated as bounds (too close / too far) instead of aborting the search.
async function hgFindLeg(leg, minPct, startOff, dec) {
    if (leg.vanilla) {   // Vanilla: one quote at the chosen strike/expiry, no barrier search
        const q = await hgQuote(leg, 0, dec);
        if (q.error) return { error: q.error };
        const npc = hgVanillaNPC(q);
        if (!npc) return { error: { message: "Couldn't read the payout per point from Deriv's quote" } };
        if (!hgSeenErrs.has('vf|' + leg.type)) { hgSeenErrs.add('vf|' + leg.type); logToConsole(`[Hedge] ${leg.label} quote fields: ${JSON.stringify(q).slice(0, 380)}`, "system-msg"); }
        return { off: 0, q, pct: 0, npc };
    }
    if (leg.noBarrier) {   // Only Ups / Only Downs: no barrier, payout depends on tick count only
        const q = await hgQuote(leg, 0, dec);
        if (q.error) return { error: q.error };
        const pct = (q.payout - q.ask_price) / q.ask_price * 100;
        if (pct < minPct) return { error: { message: `${leg.label} pays only ${pct.toFixed(0)}% at ${hgDurLabel(hgDur)}` } };
        return { off: 0, q, pct };
    }
    const step = Math.pow(10, -dec);
    let lowBound = 0, highBound = Infinity;
    let okOff = null, badOff = null, best = null, lastMove = null, errs = 0, lastErr = null, rangeUsed = false;
    let off = startOff;
    for (let i = 0; i < 24; i++) {
        off = Math.max(step, Math.round(off / step) * step);
        if (off <= lowBound) off = lowBound + step;
        const q = await hgQuote(leg, off, dec);
        if (q.error) {
            lastErr = q.error;
            const msg = q.error.message || '';
            errs++;
            if (!/barrier/i.test(msg) || (errs >= 6 && !best)) return { error: q.error };
            const nums = (msg.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0).slice(0, 2);
            if (!rangeUsed && nums.length === 2 && nums[0] !== nums[1]) {
                const lo = Math.min(...nums), hi = Math.max(...nums);
                if (off < lo || off > hi) {
                    rangeUsed = true;
                    lowBound = Math.max(lowBound, lo - step);
                    highBound = Math.min(highBound, hi + step);
                    off = off < lo ? lo : hi;
                    continue;
                }
            }
            const small = /close|small|near|low|at least|minimum|less than/i.test(msg);
            const big = /far|large|big|high|at most|maximum|exceed|more than|greater/i.test(msg);
            const tooSmall = (small && !big) ? true : (big && !small) ? false : lastMove !== 'grow';
            if (tooSmall) {
                lowBound = Math.max(lowBound, off);
                off = isFinite(highBound) ? (off + highBound) / 2 : off * 2;
                lastMove = 'grow';
            } else {
                highBound = Math.min(highBound, off);
                off = lowBound > 0 ? (lowBound + off) / 2 : off / 2;
                lastMove = 'shrink';
            }
            continue;
        }
        const pct = (q.payout - q.ask_price) / q.ask_price * 100;
        const ok = pct >= minPct;
        if (ok) { okOff = off; best = { off, q, pct }; } else { badOff = off; }
        if (okOff !== null && badOff !== null) {
            if (Math.abs(okOff - badOff) <= step * 1.5) break;
            off = (okOff + badOff) / 2;
        } else {
            const grow = leg.dir === 'wide' ? !ok : ok;
            lastMove = grow ? 'grow' : 'shrink';
            let next = grow ? off * 2 : off / 2;
            if (grow && next >= highBound) next = (off + highBound) / 2;
            if (!grow && next <= lowBound) next = (off + lowBound) / 2;
            if (Math.abs(next - off) < step / 2 || next < step / 2 || next > startOff * 4096) break;
            off = next;
        }
    }
    if (best) return best;
    return { error: lastErr || { message: `no barrier found that gives ${minPct}% on ${leg.label}` } };
}

function hgStartOffset() {
    const prices = rfPriceHistory.map(p => (typeof p === 'object' ? p.price : p));
    const spot = parseFloat(liveTickValue.textContent) || 100;
    let avg = spot * 0.0005;
    if (prices.length >= 10) {
        let sum = 0;
        for (let i = 1; i < prices.length; i++) sum += Math.abs(prices[i] - prices[i - 1]);
        avg = sum / (prices.length - 1);
    }
    return avg * Math.sqrt(Math.max(1, hgDur.u === 't' ? hgDur.v : hgDur.u === 's' ? hgDur.v / 2 : hgDur.v * 30));
}

function hgShowCard(id, leg, res) {
    const cur = currencyText.textContent || 'USD';
    document.getElementById(`hg-card-${id}-title`).textContent = leg.label;
    if (!res || res.error) {
        document.getElementById(`hg-card-${id}-payout`).textContent = '--';
        document.getElementById(`hg-card-${id}-profit`).textContent = res && res.error ? res.error.message : '--';
        return;
    }
    if (leg.vanilla) {
        document.getElementById(`hg-card-${id}-payout`).textContent = `${res.npc} / point`;
        document.getElementById(`hg-card-${id}-profit`).textContent =
            `Premium ${res.q.ask_price.toFixed(2)} ${cur} | break-even ${(res.q.ask_price / res.npc).toFixed(2)} pts (this leg alone)`;
        return;
    }
    const stake = res.q.ask_price;
    document.getElementById(`hg-card-${id}-payout`).textContent = `${res.q.payout.toFixed(2)} ${cur}`;
    document.getElementById(`hg-card-${id}-profit`).textContent =
        `Profit ${(res.q.payout - stake).toFixed(2)} ${cur} (${res.pct.toFixed(2)}%) | ${leg.noBarrier ? (/^TICK/.test(leg.type) ? 'tick #' + hgSelTick(leg) : 'no barrier') : 'barrier \u00b1' + res.off}`;
}

async function hgRefreshQuotes() {
    if (hgQuoting) return false;
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) { logToConsole("Error: connect the stream first.", "error-msg"); return false; }
    const key = hgStrategySelect.value;
    const strat = HG_STRATS[key];
    if (!strat) return false;
    const minPct = parseFloat(hgMinProfit.value) || 100;
    const shown = (liveTickValue.textContent.split('.')[1] || '').length;
    const dec = Math.max(getSymbolDecimals(marketDropdown.value), shown);
    hgSeenErrs.clear();
    hgQuoting = true;
    btnHgRefresh.disabled = true;
    hgBarrierNote.textContent = 'Fetching quotes...';
    try {
        const limits = await hgLoadLimits(marketDropdown.value);
        const baseList = key === 'vanilla' ? [hgVanillaDur()] : (strat.durations || HG_DURATIONS);
        let tryList = baseList;
        if (limits) {
            if (key === 'vanilla' && !limits.some(e => e.contract_type === 'VANILLALONGCALL')) {
                hgQuotes = null;
                hgBarrierNote.textContent = 'Deriv does not list Vanilla options for this market. Pick another market.';
                logToConsole('[Hedge] Deriv does not list Vanilla options for this market.', "error-msg");
                return false;
            }
            hgLogLimits(marketDropdown.value, limits, strat);
            tryList = baseList.filter(d => hgDurAllowed(limits, strat.a.type, d) && hgDurAllowed(limits, strat.b.type, d));
            if (!tryList.length) {
                tryList = baseList;
                logToConsole("[Hedge] None of the preset durations match Deriv's limits for this pair; trying them anyway.", "error-msg");
            }
        }
        let a, b;
        for (const dur of tryList) {
            hgDur = dur;
            hgBarrierNote.textContent = `Fetching quotes (trying ${hgDurLabel(dur)})...`;
            const start = hgStartOffset();
            [a, b] = await Promise.all([hgFindLeg(strat.a, minPct, start, dec), hgFindLeg(strat.b, minPct, start, dec)]);
            if (!a.error && !b.error) break;
        }
        hgBarDuration.value = `${hgDurLabel(hgDur)} (${key === 'vanilla' ? 'selected' : 'auto'})`;
        hgShowCard('a', strat.a, a);
        hgShowCard('b', strat.b, b);
        if (a.error || b.error) {
            hgQuotes = null;
            const msg = (a.error || b.error).message;
            hgBarrierNote.textContent = `Could not build the hedge: ${msg}`;
            logToConsole(`[Hedge] Quote failed: ${msg}`, "error-msg");
            return false;
        }
        hgQuotes = { strat: key, a, b, dec, dur: hgDur, time: Date.now() };
        const cost = (a.q.ask_price + b.q.ask_price).toFixed(2);
        if (key === 'vanilla') {
            const prem = a.q.ask_price + b.q.ask_price, curV = currencyText.textContent || 'USD';
            hgBarrierNote.style.color = '';
            hgBarrierNote.textContent = `Expiry ${hgDurLabel(hgDur)}, strike ${hgVanillaStrike()}. Total premium ${prem.toFixed(2)} ${curV} (your maximum loss). To profit, the price must finish more than ${(prem / a.npc).toFixed(2)} points above or ${(prem / b.npc).toFixed(2)} points below the strike.`;
            logToConsole(`[Hedge] Vanilla quotes ready: premium ${prem.toFixed(2)} ${curV}, payout per point ${a.npc} (call) / ${b.npc} (put).`, "success-msg");
            return true;
        }
        const tot = a.q.ask_price + b.q.ask_price, cur = currencyText.textContent || 'USD';
        const netA = a.q.payout - tot, netB = b.q.payout - tot, sg = x => (x >= 0 ? '+' : '') + x.toFixed(2);
        const locked = netA <= 0 || netB <= 0;
        hgBarrierNote.textContent = `Duration ${hgDurLabel(hgDur)}. Total stake ${cost} ${cur}. If ${strat.a.label} wins: ${sg(netA)}. If ${strat.b.label} wins: ${sg(netB)}. If both lose: -${cost}.` +
            (locked ? (key === 'reset'
                ? ' NOTE: one leg winning does not cover both stakes. This pair only profits when BOTH legs win (price finishes between the entry spot and the mid-trade reset spot).'
                : ' WARNING: a win on at least one leg does not cover both stakes, so this pair loses money even when a leg wins. Pick a strategy or barrier where each leg pays more than 100%.') : '');
        hgBarrierNote.style.color = locked ? 'var(--accent-red)' : '';
        logToConsole(`[Hedge] Quotes ready: ${strat.a.label} ${a.pct.toFixed(0)}% / ${strat.b.label} ${b.pct.toFixed(0)}%.`, "success-msg");
        return true;
    } finally {
        hgQuoting = false;
        btnHgRefresh.disabled = !(optionsWebSocket && optionsWebSocket.readyState === WebSocket.OPEN);
    }
}

async function hgExecuteBarrierHedge() {
    if (isTradingLocked()) { logToConsole(tradingLockMessage(), "error-msg"); return; }
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) { logToConsole("Error: connect the stream first.", "error-msg"); return; }
    if (!(await hgGate())) return;
    if (!hgQuotes || hgQuotes.strat !== hgStrategySelect.value || Date.now() - hgQuotes.time > 20000) {
        if (!(await hgRefreshQuotes())) return;
    }
    hgDur = hgQuotes.dur;
    const strat = HG_STRATS[hgQuotes.strat];
    const stake = parseFloat(hgStakeInput.value);
    const runToken = "HEDGE_" + Date.now();
    challengeBatchExpectedCounts[runToken] = 2;
    batchSyncExpected[runToken] = 2;
    hgRunState[runToken] = { open: 2, profit: 0, legs: 2 };
    const payloads = [['a', strat.a], ['b', strat.b]].map(([id, leg]) => JSON.stringify({
        buy: 1, price: stake, subscribe: 1,
        parameters: { ...hgContractParams(leg, hgQuotes[id].off, hgQuotes.dec), underlying_symbol: marketDropdown.value },
        passthrough: { bulkRunId: runToken }
    }));
    const dur = hgDur;
    hgQuotes = null; // force a fresh quote next time
    logToConsole("[Hedge] Waiting for the next tick so both legs enter on the same spot...");
    // Both buys go out back-to-back right as a tick arrives, so both legs share the entry (and exit) tick.
    hgFireOnNextTick(() => {
        payloads.forEach(p => optionsWebSocket.send(p));
        hgRunsFired += 1;
        updateHedgeStatsUI();
        logToConsole(`[Hedge] Executed ${strat.a.label} + ${strat.b.label} on the same tick (${(stake * 2).toFixed(2)} total stake).`, "success-msg");
        hgStartCountdown(runToken, dur);
    });
}

let hgPrevKey = null;
function applyHedgeStrategyUI() {
    const isVan = hgStrategySelect.value === 'vanilla';
    document.getElementById('hg-vanilla-pick').style.display = isVan ? 'flex' : 'none';
    document.getElementById('hg-min-profit-wrap').style.display = isVan ? 'none' : '';
    if (isVan) hgPopulateVanilla();
    const isTick = hgStrategySelect.value === 'hilotick';
    document.getElementById('hg-tick-pick').style.display = isTick ? 'flex' : 'none';
    document.getElementById('hg-tick-note').style.display = isTick ? 'block' : 'none';
    const sDef = HG_STRATS[hgStrategySelect.value], prevDef = hgPrevKey && HG_STRATS[hgPrevKey];
    if (sDef && sDef.defaultMin) hgMinProfit.value = sDef.defaultMin;
    else if (prevDef && prevDef.defaultMin) hgMinProfit.value = 500;
    hgPrevKey = hgStrategySelect.value;
    const isDigits = hgStrategySelect.value === 'digits';
    hgDigitPanel.style.display = isDigits ? 'block' : 'none';
    hgBarrierPanel.style.display = isDigits ? 'none' : 'block';
    hgBarDurationWrap.style.display = isDigits ? 'none' : 'flex';
    if (isAutoTradingHG) toggleAutoHG(false);
    hgQuotes = null;
    const strat = HG_STRATS[hgStrategySelect.value];
    if (strat) { hgShowCard('a', strat.a, null); hgShowCard('b', strat.b, null); }
    hgBarrierNote.textContent = 'Press Refresh quotes to find barriers that meet your minimum profit on both legs.';
}

hgStrategySelect.addEventListener('change', applyHedgeStrategyUI);
btnHgRefresh.addEventListener('click', hgRefreshQuotes);
btnHgExecute.addEventListener('click', hgExecuteBarrierHedge);
applyHedgeStrategyUI();


// --- Hedge countdown: ticks remaining (tick durations) or mm:ss (minute durations) ---
let hgCd = null, hgCdTimer = null;
const hgCdBox = document.getElementById('hg-countdown');
const hgCdLabel = document.getElementById('hg-cd-label');
const hgCdValue = document.getElementById('hg-cd-value');
const hgCdBar = document.getElementById('hg-cd-bar');

function hgFmtClock(ms) {
    const s = Math.ceil(ms / 1000), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    const p = n => String(n).padStart(2, '0');
    return hh ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}`;
}
function hgRenderCountdown() {
    if (!hgCd || !hgCdBox) return;
    hgCdBox.style.display = 'block';
    let label, value, pct;
    if (hgCd.settled) { label = 'Hedge finished'; value = 'Settled'; pct = 100; }
    else if (hgCd.u === 't') {
        const done = Math.max(0, hgCd.ticksSeen - 1), rem = Math.max(0, hgCd.v - done);
        label = 'Ticks remaining'; value = rem ? `${rem} / ${hgCd.v}` : 'settling...'; pct = done / hgCd.v * 100;
    } else {
        const ms = Math.max(0, hgCd.endMs - Date.now());
        label = 'Time remaining'; value = ms ? hgFmtClock(ms) : 'settling...'; pct = (1 - ms / hgCd.totalMs) * 100;
    }
    hgCdLabel.textContent = label;
    hgCdValue.textContent = value;
    hgCdBar.style.width = Math.min(100, Math.max(0, pct)) + '%';
}
function hgStartCountdown(runId, dur) {
    if (hgCdTimer) clearInterval(hgCdTimer);
    hgCd = { runId, u: dur.u, v: dur.v, ticksSeen: 0, settled: false,
             totalMs: hgDurSecs(dur) * 1000,
             endMs: dur.u === 't' ? 0 : Date.now() + hgDurSecs(dur) * 1000 + 2000 };
    hgRenderCountdown();
    if (dur.u !== 't') hgCdTimer = setInterval(hgRenderCountdown, 500);
}
function hgTickCountdown() {
    if (hgCd && hgCd.u === 't' && !hgCd.settled) { hgCd.ticksSeen++; hgRenderCountdown(); }
}
function hgSyncCountdown(contract) {
    if (!hgCd || hgCd.u === 't' || hgContractToRun[contract.contract_id] !== hgCd.runId || !contract.date_expiry) return;
    hgCd.endMs = contract.date_expiry * 1000;
    if (contract.date_start) hgCd.totalMs = Math.max(1000, hgCd.endMs - contract.date_start * 1000);
}
function hgFinishCountdown(runId) {
    if (!hgCd || hgCd.runId !== runId) return;
    hgCd.settled = true;
    if (hgCdTimer) { clearInterval(hgCdTimer); hgCdTimer = null; }
    hgRenderCountdown();
}


// --- Fire an action on the next incoming tick (keeps paired legs on the same entry spot) ---
let hgTickQueue = null, hgTickQueueTimer = null;
function hgFireOnNextTick(fn) {
    if (hgTickQueueTimer) clearTimeout(hgTickQueueTimer);
    hgTickQueue = fn;
    hgTickQueueTimer = setTimeout(() => { if (hgTickQueue) { const f = hgTickQueue; hgTickQueue = null; f(); } }, 4000); // fallback
}

// ---------------------------------------------------------------------
// AUTO CASH OUT (early sell) - Rise/Fall minute trades + timed hedge legs.
// Tick-based contracts cannot be sold early, so they are skipped.
// ---------------------------------------------------------------------
const acoEl = id => document.getElementById(id);
const acoSent = new Set();
const acoRunLegs = {};   // hedge run id -> { contract_id: {id, bid, buy} }

function acoSell(cid, why) {
    if (acoSent.has(cid)) return;
    acoSent.add(cid);
    hgProposal({ sell: cid, price: 0 }).then(r => {
        if (r.error) logToConsole(`[Cash Out] Could not sell #${cid}: ${r.error.message}`, "error-msg");
        else logToConsole(`[Cash Out] ${why} - sold #${cid}${r.sell && r.sell.sold_for != null ? ` for ${r.sell.sold_for}` : ''}.`, "success-msg");
    });
}

function autoCashOutCheck(c) {
    if (!c || !c.contract_id || c.is_sold || (c.status && c.status !== 'open')) return;
    if (c.tick_count != null || !c.date_expiry || !c.is_valid_to_sell) return;   // time-based, sellable only
    const bid = parseFloat(c.bid_price), buy = parseFloat(c.buy_price);
    if (isNaN(bid) || isNaN(buy) || buy <= 0) return;

    if (rfActiveContractIds.has(c.contract_id) && acoEl('rf-cashout') && acoEl('rf-cashout').checked) {
        const tp = parseFloat(acoEl('rf-cashout-tp').value) || 0, sl = parseFloat(acoEl('rf-cashout-sl').value) || 0;
        const pct = (bid - buy) / buy * 100;
        if (tp > 0 && pct >= tp) acoSell(c.contract_id, `Rise/Fall hit +${pct.toFixed(1)}%`);
        else if (sl > 0 && pct <= -sl) acoSell(c.contract_id, `Rise/Fall hit ${pct.toFixed(1)}%`);
        return;
    }

    const runId = hgContractToRun[c.contract_id];
    if (runId && acoEl('hg-cashout') && acoEl('hg-cashout').checked) {
        const legs = acoRunLegs[runId] || (acoRunLegs[runId] = {});
        legs[c.contract_id] = { id: c.contract_id, bid, buy };
        const list = Object.values(legs);
        const expected = hgRunState[runId] ? hgRunState[runId].legs : 2;
        if (list.length < expected) return;   // wait until every leg has reported a value
        const totalBuy = list.reduce((s, l) => s + l.buy, 0), totalBid = list.reduce((s, l) => s + l.bid, 0);
        const pct = (totalBid - totalBuy) / totalBuy * 100;
        const tp = parseFloat(acoEl('hg-cashout-tp').value) || 0, sl = parseFloat(acoEl('hg-cashout-sl').value) || 0;
        if (tp > 0 && pct >= tp) list.forEach(l => acoSell(l.id, `Hedge combined +${pct.toFixed(1)}%`));
        else if (sl > 0 && pct <= -sl) list.forEach(l => acoSell(l.id, `Hedge combined ${pct.toFixed(1)}%`));
    }
}


// --- Rise/Fall countdown: ticks remaining (tick trades) or mm:ss (minute trades) ---
let rfCd = null, rfCdTimer = null;
function rfRenderCountdown() {
    const box = document.getElementById('rf-countdown');
    if (!rfCd || !box) return;
    box.style.display = 'block';
    let label, value, pct;
    if (rfCd.settled) { label = 'Trade finished'; value = 'Settled'; pct = 100; }
    else if (rfCd.ticks != null) {
        const rem = Math.max(0, rfCd.ticks - rfCd.seen);
        label = 'Ticks remaining'; value = rem ? `${rem} / ${rfCd.ticks}` : 'settling...'; pct = rfCd.seen / rfCd.ticks * 100;
    } else {
        const ms = Math.max(0, rfCd.endMs - Date.now());
        label = 'Time remaining'; value = ms ? hgFmtClock(ms) : 'settling...'; pct = (1 - ms / rfCd.totalMs) * 100;
    }
    document.getElementById('rf-cd-label').textContent = label;
    document.getElementById('rf-cd-value').textContent = value;
    document.getElementById('rf-cd-bar').style.width = Math.min(100, Math.max(0, pct)) + '%';
}
function rfCountdownUpdate(c) {
    if (!c || !c.contract_id || !rfActiveContractIds.has(c.contract_id) && !(rfCd && rfCd.id === c.contract_id)) return;
    const finished = c.is_sold || (c.status && c.status !== 'open');
    if (finished) {
        if (rfCd && rfCd.id === c.contract_id) {
            rfCd.settled = true;
            if (rfCdTimer) { clearInterval(rfCdTimer); rfCdTimer = null; }
            rfRenderCountdown();
        }
        return;
    }
    if (!rfCd || rfCd.settled) {   // a new trade: start tracking it
        if (rfCdTimer) clearInterval(rfCdTimer);
        rfCd = { id: c.contract_id, settled: false, seen: 0, ticks: null, endMs: 0, totalMs: 1000 };
        if (c.tick_count != null) rfCd.ticks = parseInt(c.tick_count, 10);
        else rfCdTimer = setInterval(rfRenderCountdown, 500);
    }
    if (rfCd.id !== c.contract_id) return;
    if (rfCd.ticks != null && Array.isArray(c.tick_stream)) rfCd.seen = c.tick_stream.length;
    if (rfCd.ticks == null && c.date_expiry) {
        rfCd.endMs = c.date_expiry * 1000;
        if (c.date_start) rfCd.totalMs = Math.max(1000, rfCd.endMs - c.date_start * 1000);
    }
    rfRenderCountdown();
}
function rfTickCountdown() {
    if (rfCd && rfCd.ticks != null && !rfCd.settled) { rfCd.seen = Math.min(rfCd.ticks, rfCd.seen + 1); rfRenderCountdown(); }
}


// =====================================================================
// ENTRY ADVISOR - back-tests the exact hedge on recent ticks against the quoted
// payouts, warns when the setup has no edge, and scans other markets.
// NOTE: synthetic-index ticks are random. This measures recent conditions and
// how fairly the payouts are priced; it cannot predict the next tick.
// =====================================================================
const hgVerdictEl = document.getElementById('hg-verdict');
const hgAdviceEl = document.getElementById('hg-advice');
const hgSuggestEl = document.getElementById('hg-suggest');
const hgGuardEl = document.getElementById('hg-guard');
const hgHistCache = {};
let hgLastAnalysis = null;

async function hgGetHistory(symbol, count) {
    const c = hgHistCache[symbol];
    if (c && c.count >= count && Date.now() - c.t < 45000) return c.data;
    const r = await hgProposal({ ticks_history: symbol, count, end: 'latest', style: 'ticks' });
    if (!r.history || !r.history.prices || r.history.prices.length < 100) return null;
    const data = { prices: r.history.prices.map(Number), times: (r.history.times || []).map(Number) };
    hgHistCache[symbol] = { t: Date.now(), count, data };
    return data;
}
const hgStd = a => { if (a.length < 2) return 0; const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length); };
const hgDiffs = p => p.slice(1).map((x, i) => x - p[i]);
function hgTickSecs(times) {
    const d = hgDiffs(times).sort((a, b) => a - b);
    return d.length ? (d[Math.floor(d.length / 2)] || 2) : 2;
}
const hgDurTicks = (dur, interval) => dur.u === 't' ? dur.v : Math.max(1, Math.round(hgDurSecs(dur) / interval));
function hgDigitsOf(prices) {
    const dec = Math.max(...prices.slice(-200).map(p => (String(p).split('.')[1] || '').length));
    return prices.map(p => parseInt(p.toFixed(dec).slice(-1), 10));
}

function hgLegWins(leg, off, w) {
    const hi = w.mx - w.p0, lo = w.p0 - w.mn, dev = Math.max(hi, lo), end = Math.abs(w.exit - w.p0);
    switch (leg.type) {
        case 'ONETOUCH': return (leg.sign === '+' ? hi : lo) >= off;
        case 'NOTOUCH': return (leg.sign === '+' ? hi : lo) < off;
        case 'EXPIRYRANGE': return end < off;
        case 'EXPIRYMISS': return end >= off;
        case 'RANGE': return dev < off;
        case 'UPORDOWN': return dev >= off;
        case 'TICKHIGH': { const k = hgSelTick(leg) - 1; return !!w.ticks && w.ticks.every((p, x) => x === k || p < w.ticks[k]); }
        case 'TICKLOW': { const k = hgSelTick(leg) - 1; return !!w.ticks && w.ticks.every((p, x) => x === k || p > w.ticks[k]); }
        case 'ASIANU': return w.exit > w.avg;
        case 'ASIAND': return w.exit < w.avg;
        case 'RESETCALL': return w.exit > (w.mid < w.p0 ? w.mid : w.p0);
        case 'RESETPUT': return w.exit < (w.mid > w.p0 ? w.mid : w.p0);
        case 'RUNHIGH': return w.up;
        case 'RUNLOW': return w.dn;
    }
    return false;
}
function hgBarrierEV(prices, n, o) {
    let N = 0, a = 0, b = 0, none = 0;
    const needTicks = /^TICK/.test(o.legA.type) || /^TICK/.test(o.legB.type);
    for (let i = 0; i + n < prices.length; i++) {
        let mx = -Infinity, mn = Infinity, up = true, dn = true, prev = prices[i], sum = 0;
        for (let k = 1; k <= n; k++) {
            const p = prices[i + k];
            if (p > mx) mx = p; if (p < mn) mn = p;
            if (!(p > prev)) up = false; if (!(p < prev)) dn = false;
            prev = p; sum += p;
        }
        const w = { p0: prices[i], mx, mn, exit: prices[i + n], up, dn, avg: sum / n, mid: prices[i + Math.floor(n / 2)], ticks: needTicks ? prices.slice(i, i + 5) : null };
        const wa = hgLegWins(o.legA, o.offA, w), wb = hgLegWins(o.legB, o.offB, w);
        N++; if (wa) a++; if (wb) b++; if (!wa && !wb) none++;
    }
    const pA = a / N, pB = b / N, stake = o.askA + o.askB;
    const ev = pA * o.payA + pB * o.payB - stake;
    const varr = o.payA * o.payA * pA * (1 - pA) + o.payB * o.payB * pB * (1 - pB);
    return { N, ev, stake, evPct: ev / stake * 100, z: ev / (Math.sqrt(varr / Math.max(1, N / n)) || 1), pA, pB, bothLose: none / N };
}
function hgDigitEV(digs, o) {
    let N = 0, pO = 0, pU = 0, gap = 0; const pm = {};
    for (let i = o.n; i < digs.length; i++) {
        const d = digs[i]; N++;
        if (d > o.over) pO++; if (d < o.under) pU++;
        if (!(d > o.over) && !(d < o.under)) gap++;
        pm[d] = (pm[d] || 0) + 1;
    }
    pO /= N; pU /= N;
    let ev = pO * o.payO + pU * o.payU - o.askO - o.askU, stake = o.askO + o.askU;
    let varr = o.payO * o.payO * pO * (1 - pO) + o.payU * o.payU * pU * (1 - pU);
    (o.cover || []).forEach(c => { const p = (pm[c.d] || 0) / N; ev += p * c.pay - c.ask; stake += c.ask; varr += c.pay * c.pay * p * (1 - p); });
    return { N, ev, stake, evPct: ev / stake * 100, z: ev / (Math.sqrt(varr / Math.max(1, N / o.n)) || 1), pA: pO, pB: pU, bothLose: gap / N };
}

async function hgQuoteDigit(type, digit, ticks, stake) {
    const symKey = hgProposalStyle === 0 ? 'underlying_symbol' : 'symbol';
    const r = await hgProposal({ proposal: 1, amount: stake, basis: 'stake', contract_type: type, currency: currencyText.textContent || 'USD',
        duration: ticks, duration_unit: 't', barrier: String(digit), [symKey]: marketDropdown.value });
    return r.proposal || { error: r.error };
}

const hgPct = x => (x * 100).toFixed(1) + '%';
function hgVerdictOf(res, calmPref, volRatio) {
    let v = res.z >= 1 ? 'ENTER' : res.z > -1 ? 'MARGINAL' : 'AVOID';
    if (v === 'ENTER' && calmPref && volRatio > 1.5) v = 'MARGINAL';
    return v;
}
function hgShowVerdict(v) {
    hgVerdictEl.textContent = v === 'ENTER' ? 'ENTER' : v === 'MARGINAL' ? 'MARGINAL - NO CLEAR EDGE' : v === 'AVOID' ? 'AVOID' : v;
    hgVerdictEl.className = v === 'ENTER' ? 'success-msg' : v === 'AVOID' ? 'error-msg' : 'system-msg';
}

async function hgAnalyze(silent) {
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) { logToConsole("Error: connect the stream first.", "error-msg"); return null; }
    const sym = marketDropdown.value, key = hgStrategySelect.value;
    hgAdviceEl.textContent = 'Analyzing recent ticks...';
    hgSuggestEl.innerHTML = '';
    const hist = await hgGetHistory(sym, 1500);
    if (!hist) { hgAdviceEl.textContent = "Couldn't load tick history for this market, so no analysis is available."; hgShowVerdict('UNKNOWN'); return null; }
    const interval = hgTickSecs(hist.times);
    const diffs = hgDiffs(hist.prices);
    const volRatio = (hgStd(diffs.slice(-60)) / (hgStd(diffs) || 1)) || 1;
    const lines = [];
    if (key === 'vanilla') return hgAnalyzeVanilla(sym, hist, interval, volRatio);
    let res, info, calmPref = false;

    if (key === 'digits') {
        const d = getHedgeDigits();
        if (d.error) { hgAdviceEl.textContent = d.error; return null; }
        const n = Math.max(1, parseInt(hgDurationInput.value, 10) || 1), stake = parseFloat(hgStakeInput.value);
        const mStake = parseFloat(document.getElementById('hg-matches-stake').value);
        const [qo, qu] = await Promise.all([hgQuoteDigit('DIGITOVER', d.over, n, stake), hgQuoteDigit('DIGITUNDER', d.under, n, stake)]);
        if (qo.error || qu.error) { hgAdviceEl.textContent = `Quote failed: ${(qo.error || qu.error).message}`; return null; }
        const cover = [];
        if (document.getElementById('hg-matches-cover').checked && mStake > 0) {
            for (const g of hedgeGapDigits(d.over, d.under)) {
                const qm = await hgQuoteDigit('DIGITMATCH', g, n, mStake);
                if (!qm.error) cover.push({ d: g, pay: qm.payout, ask: qm.ask_price });
            }
        }
        info = { n, over: d.over, under: d.under, payO: qo.payout, askO: qo.ask_price, payU: qu.payout, askU: qu.ask_price, cover };
        const digs = hgDigitsOf(hist.prices);
        res = hgDigitEV(digs, info);
        const gapSet = hedgeGapDigits(d.over, d.under), last100 = digs.slice(-100);
        const gapNow = last100.filter(x => gapSet.includes(x)).length / last100.length;
        lines.push(`Over ${d.over} hit ${hgPct(res.pA)}, Under ${d.under} hit ${hgPct(res.pB)}; both lose ${hgPct(res.bothLose)} (last 100 ticks: gap digits ${hgPct(gapNow)}, expected ${hgPct(gapSet.length / 10)}).`);
        if (cover.length) lines.push(`Matches cover on ${cover.map(c => c.d).join(' & ')} included in the result.`);
        lines.push('Last digits are random, so a run of gap digits does not make the next digit more likely.');
    } else {
        if (!hgQuotes || hgQuotes.strat !== key || Date.now() - hgQuotes.time > 20000) { hgAdviceEl.textContent = 'Fetching quotes...'; if (!(await hgRefreshQuotes())) { hgAdviceEl.textContent = 'Could not get quotes, so no analysis is available.'; return null; } }
        const st = HG_STRATS[key], q = hgQuotes, n = hgDurTicks(q.dur, interval);
        info = { n, legA: st.a, legB: st.b, offA: q.a.off, offB: q.b.off, payA: q.a.q.payout, askA: q.a.q.ask_price, payB: q.b.q.payout, askB: q.b.q.ask_price, sigma: hgStd(diffs), dur: q.dur };
        res = hgBarrierEV(hist.prices, n, info);
        calmPref = ['RANGE', 'EXPIRYRANGE', 'NOTOUCH'].includes(st.a.type);
        lines.push(`${st.a.label} hit ${hgPct(res.pA)}, ${st.b.label} hit ${hgPct(res.pB)}; both lose ${hgPct(res.bothLose)}.`);
        if (/^RESET/.test(st.a.type)) lines.push('Note: Reset contracts use an approximate model in the back-test.');
        lines.push(`Trade length ~${n} ticks (${interval.toFixed(1)}s per tick).`);
    }
    lines.push(`Back-test: ${res.N} recent windows. Expected result per run: ${res.ev >= 0 ? '+' : ''}${res.ev.toFixed(2)} on ${res.stake.toFixed(2)} staked (${res.evPct.toFixed(1)}%, confidence z=${res.z.toFixed(1)}).`);
    lines.push(`Recent volatility is ${volRatio.toFixed(2)}x the longer-run level${volRatio > 1.5 ? ' (elevated)' : volRatio < 0.7 ? ' (calm)' : ' (normal)'}${calmPref && volRatio > 1.5 ? ', which works against a "stays inside" leg' : ''}.`);
    if (res.N < 300) lines.push('Warning: small sample, treat this loosely.');
    const verdict = hgVerdictOf(res, calmPref, volRatio);
    lines.push(verdict === 'ENTER' ? 'Result: the recent data supports this setup, but that can change quickly.'
        : verdict === 'AVOID' ? 'Result: on recent data this setup loses money on average. Skip it, change the setup, or try another market.'
        : 'Result: no statistically clear edge either way. Entering is a coin flip against the payout margin.');
    hgShowVerdict(verdict);
    hgAdviceEl.innerHTML = lines.map(l => `<div style="margin-bottom:3px;">${l}</div>`).join('');
    hgLastAnalysis = { key, sym, info, res, interval, verdict };
    return hgLastAnalysis;
}

async function hgScanMarkets() {
    if (hgStrategySelect.value === 'vanilla') { hgSuggestEl.textContent = 'Market scanning is not available for Vanilla straddles.'; return; }
    if (!hgLastAnalysis || hgLastAnalysis.sym !== marketDropdown.value || hgLastAnalysis.key !== hgStrategySelect.value) {
        if (!(await hgAnalyze(true))) return;
    }
    const base = hgLastAnalysis, info = base.info, key = base.key;
    const opts = [...marketDropdown.options].filter(o => o.value && o.value !== base.sym);
    const vols = opts.filter(o => /volatility/i.test(o.text));
    const list = (vols.length ? vols : opts).slice(0, 12);
    const found = [];
    for (let i = 0; i < list.length; i++) {
        hgSuggestEl.innerHTML = `<div style="font-size:0.8rem;color:var(--text-secondary);">Scanning markets ${i + 1}/${list.length}...</div>`;
        const o = list[i];
        const hist = await hgGetHistory(o.value, 800);
        if (!hist) continue;
        let r;
        if (key === 'digits') r = hgDigitEV(hgDigitsOf(hist.prices), info);
        else {
            const itv = hgTickSecs(hist.times), n = hgDurTicks(info.dur, itv), sig = hgStd(hgDiffs(hist.prices));
            const k = { a: info.offA / (info.sigma * Math.sqrt(info.n) || 1), b: info.offB / (info.sigma * Math.sqrt(info.n) || 1) };
            r = hgBarrierEV(hist.prices, n, { ...info, offA: k.a * sig * Math.sqrt(n), offB: k.b * sig * Math.sqrt(n) });
        }
        found.push({ sym: o.value, name: o.text, r });
    }
    found.sort((a, b) => b.r.z - a.r.z);
    const better = found.filter(f => f.r.z > base.res.z).slice(0, 3);
    hgSuggestEl.innerHTML = '';
    const head = document.createElement('div');
    head.style.cssText = 'font-size:0.8rem;margin-bottom:4px;';
    head.textContent = better.length ? `Markets that back-test better than ${marketDropdown.selectedOptions[0].text} right now:` : 'No scanned market looks better than the current one right now.';
    hgSuggestEl.appendChild(head);
    better.forEach(f => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:0.8rem;padding:4px 0;';
        const t = document.createElement('span');
        t.textContent = `${f.name}: ${f.r.evPct >= 0 ? '+' : ''}${f.r.evPct.toFixed(1)}% per run, both lose ${hgPct(f.r.bothLose)}`;
        const b = document.createElement('button');
        b.className = 'btn-secondary'; b.style.padding = '2px 10px'; b.textContent = 'Switch';
        b.addEventListener('click', () => {
            marketDropdown.value = f.sym;
            marketDropdown.dispatchEvent(new Event('change'));
            hgQuotes = null; hgLastAnalysis = null; hgSuggestEl.innerHTML = '';
            hgAdviceEl.textContent = `Switched to ${f.name}. Press Refresh quotes, then Analyze entry to confirm with real payouts.`;
            hgShowVerdict('Not analyzed');
            logToConsole(`[Hedge] Switched market to ${f.name}.`);
        });
        row.appendChild(t); row.appendChild(b); hgSuggestEl.appendChild(row);
    });
    const note = document.createElement('div');
    note.style.cssText = 'font-size:0.72rem;color:var(--text-secondary);';
    note.textContent = 'Estimate: assumes the same payouts as the current market (true for constant-volatility indices). Always confirm with fresh quotes after switching.';
    hgSuggestEl.appendChild(note);
}

// Gate used before real orders: runs the advisor and asks for confirmation unless it says ENTER.
async function hgGate() {
    if (!hgGuardEl || !hgGuardEl.checked) return true;
    const adv = await hgAnalyze(true);
    if (!adv) return confirm('The advisor could not analyze this setup. Execute anyway?');
    if (adv.verdict === 'ENTER') return true;
    return confirm(`Entry Advisor: ${adv.verdict}\nExpected result per run: ${adv.res.evPct.toFixed(1)}% (z=${adv.res.z.toFixed(1)}).\n\nExecute anyway?`);
}

document.getElementById('btn-hg-analyze').addEventListener('click', () => hgAnalyze(false));
document.getElementById('btn-hg-scan').addEventListener('click', hgScanMarkets);
hgStrategySelect.addEventListener('change', () => { hgLastAnalysis = null; hgShowVerdict('Not analyzed'); hgAdviceEl.textContent = ''; hgSuggestEl.innerHTML = ''; });


// Which tick (1-5) each High Tick / Low Tick leg is betting on
const hgSelTick = leg => Math.min(5, Math.max(1, parseInt(document.getElementById(leg.type === 'TICKHIGH' ? 'hg-high-tick' : 'hg-low-tick').value, 10) || 1));


// =====================================================================
// VANILLA STRADDLE - long call + long put at the same strike and expiry.
// Premium is the most you can lose; payout = payout-per-point x distance past the strike.
// =====================================================================
const hgVanillaStrike = () => (document.getElementById('hg-vanilla-strike').value || '+0.00');
const hgVanillaDur = () => hgParseDur(document.getElementById('hg-vanilla-expiry').value) || { v: 5, u: 'm' };

function hgVanillaNPC(q) {
    const v = [q.number_of_contracts, q.display_number_of_contracts, q.contract_details && q.contract_details.number_of_contracts, q.payout]
        .map(parseFloat).find(x => isFinite(x) && x > 0);
    return v || null;
}

async function hgPopulateVanilla() {
    const strikeSel = document.getElementById('hg-vanilla-strike'), expSel = document.getElementById('hg-vanilla-expiry');
    const prevStrike = strikeSel.value, prevExp = expSel.value;
    let list = null;
    if (optionsWebSocket && optionsWebSocket.readyState === WebSocket.OPEN) list = await hgLoadLimits(marketDropdown.value);
    const entry = list && list.find(e => e.contract_type === 'VANILLALONGCALL');
    const strikes = entry && Array.isArray(entry.barrier_choices) && entry.barrier_choices.length ? entry.barrier_choices.map(String) : ['+0.00'];
    strikeSel.innerHTML = strikes.map(s => `<option value="${s}">${s}${Number(s) === 0 ? ' (at the money)' : ''}</option>`).join('');
    strikeSel.value = strikes.includes(prevStrike) ? prevStrike : (strikes.includes('+0.00') ? '+0.00' : strikes[Math.floor(strikes.length / 2)]);
    const cands = [{ v: 1, u: 'm' }, { v: 3, u: 'm' }, { v: 5, u: 'm' }, { v: 15, u: 'm' }, { v: 30, u: 'm' }, { v: 1, u: 'h' }, { v: 4, u: 'h' }, { v: 1, u: 'd' }, { v: 3, u: 'd' }, { v: 7, u: 'd' }, { v: 30, u: 'd' }];
    let ok = list ? cands.filter(d => hgDurAllowed(list, 'VANILLALONGCALL', d)) : cands;
    if (!ok.length) ok = cands;
    expSel.innerHTML = ok.map(d => `<option value="${d.v}${d.u}">${hgDurLabel(d)}</option>`).join('');
    if ([...expSel.options].some(o => o.value === prevExp)) expSel.value = prevExp;
    if (list && !entry) {
        hgBarrierNote.textContent = 'Deriv does not list Vanilla options for this market. Pick another market.';
        logToConsole('[Hedge] Deriv does not list Vanilla options for this market.', "error-msg");
    }
}
marketDropdown.addEventListener('change', () => { hgQuotes = null; if (hgStrategySelect.value === 'vanilla') hgPopulateVanilla(); });

function hgVanillaEV(prices, n, o) {
    let N = 0, s = 0, s2 = 0, win = 0, m = 0, m2 = 0;
    for (let i = 0; i + n < prices.length; i++) {
        const F = prices[i + n] - prices[i];
        const pay = o.npcC * Math.max(F - o.strikeOff, 0) + o.npcP * Math.max(o.strikeOff - F, 0);
        N++; s += pay; s2 += pay * pay; if (pay > o.prem) win++; m += F; m2 += F * F;
    }
    const mean = s / N, sd = Math.sqrt(Math.max(0, s2 / N - mean * mean)), ev = mean - o.prem;
    return { N, ev, stake: o.prem, evPct: ev / o.prem * 100, z: ev / ((sd / Math.sqrt(Math.max(1, N / n))) || 1),
             pProfit: win / N, move: Math.sqrt(Math.max(0, m2 / N - (m / N) * (m / N))) };
}

async function hgAnalyzeVanilla(sym, hist0, interval0, volRatio) {
    const hist = (await hgGetHistory(sym, 5000)) || hist0;
    const interval = hgTickSecs(hist.times) || interval0;
    if (!hgQuotes || hgQuotes.strat !== 'vanilla' || Date.now() - hgQuotes.time > 20000) {
        hgAdviceEl.textContent = 'Fetching quotes...';
        if (!(await hgRefreshQuotes())) { hgAdviceEl.textContent = 'Could not get Vanilla quotes, so no analysis is available.'; return null; }
    }
    const q = hgQuotes, n = hgDurTicks(q.dur, interval);
    if (hist.prices.length < n * 3 + 100) {
        hgAdviceEl.textContent = `This expiry (${hgDurLabel(q.dur)}, about ${n} ticks) is too long to back-test with the recent ticks I can load. Choose a shorter expiry to get an analysis.`;
        hgShowVerdict('UNKNOWN');
        return null;
    }
    const info = { n, npcC: q.a.npc, npcP: q.b.npc, prem: q.a.q.ask_price + q.b.q.ask_price, strikeOff: parseFloat(hgVanillaStrike()) || 0 };
    const res = hgVanillaEV(hist.prices, n, info);
    const lines = [
        `Break-even: the price must finish more than ${(info.prem / info.npcC).toFixed(2)} points above or ${(info.prem / info.npcP).toFixed(2)} points below the strike. A typical ${hgDurLabel(q.dur)} move has been about ${res.move.toFixed(2)} points.`,
        `Back-test: ${res.N} recent windows. The straddle finished in profit ${hgPct(res.pProfit)} of the time.`,
        `Expected result per run: ${res.ev >= 0 ? '+' : ''}${res.ev.toFixed(2)} on ${res.stake.toFixed(2)} premium (${res.evPct.toFixed(1)}%, confidence z=${res.z.toFixed(1)}).`,
        `Recent volatility is ${volRatio.toFixed(2)}x the longer-run level${volRatio > 1.5 ? ' (elevated, which helps a straddle)' : volRatio < 0.7 ? ' (calm, which hurts a straddle)' : ' (normal)'}.`
    ];
    if (res.N < 300) lines.push('Warning: small sample, treat this loosely.');
    const verdict = hgVerdictOf(res, false, volRatio);
    lines.push(verdict === 'ENTER' ? 'Result: recent moves were large enough to support this straddle, but that can change quickly.'
        : verdict === 'AVOID' ? 'Result: on recent data the premium was more than the average payout. Skip it, or try a different strike or expiry.'
        : 'Result: no clear edge either way; the premium roughly matches what the price has been paying out.');
    hgShowVerdict(verdict);
    hgAdviceEl.innerHTML = lines.map(l => `<div style="margin-bottom:3px;">${l}</div>`).join('');
    hgLastAnalysis = { key: 'vanilla', sym, info, res, interval, verdict };
    return hgLastAnalysis;
}


// =====================================================================
// BULK RISE / FALL
// Modelled on the Deriv Bot "Quick strategy" (Up/Down > Rise/Fall, Contract Type: Both):
// stake per side, an even tick duration, a Trade Cycle counter and three status cards
// (filter, pair mode, entry check). Each cycle buys Rise (CALL) and Fall (PUT) together on
// the same tick - repeated "pairs per tick" times - waits for every leg to settle, then
// (in auto-mode) starts the next cycle.
// A Rise and a Fall on the same entry can never both win, so a Both cycle is only profitable
// when the winning leg pays more than both stakes combined: "Check payout" shows Deriv's
// real quote for that, and the live net / average per cycle shows what actually happened.
// =====================================================================
const btnBuyBRF = document.getElementById('btn-buy-brf');
const btnToggleAutoBRF = document.getElementById('btn-toggle-auto-brf');
const btnQuoteBRF = document.getElementById('btn-brf-quote');
const btnResetBRF = document.getElementById('btn-reset-brf');
const sideSelectBRF = document.getElementById('brf-side-select');
const tradeStakeBRF = document.getElementById('trade-stake-brf');
const tradeDurationBRF = document.getElementById('trade-duration-brf');
const maxTradesBRFInput = document.getElementById('max-trades-brf');
const maxCyclesBRFInput = document.getElementById('max-cycles-brf');
const gapTicksBRFInput = document.getElementById('gap-ticks-brf');
const takeProfitBRFInput = document.getElementById('take-profit-brf');
const stopLossBRFInput = document.getElementById('stop-loss-brf');
const stepFilterBRFCheckbox = document.getElementById('step-filter-brf');
const restartOnErrorBRFCheckbox = document.getElementById('restart-on-error-brf');
const maxErrorsBRFInput = document.getElementById('max-errors-brf');
const loopUntilTargetBRFCheckbox = document.getElementById('loop-until-target-brf');
const brfStatusEl = document.getElementById('brf-status');
const brfFilterEl = document.getElementById('brf-filter');
const brfPairModeEl = document.getElementById('brf-pairmode');
const brfEntryEl = document.getElementById('brf-entry');
const brfCycleEl = document.getElementById('brf-cycle');
const brfLegsEl = document.getElementById('brf-legs');
const brfNetEl = document.getElementById('brf-net');
const brfQuoteEl = document.getElementById('brf-quote');

const BRF_INPUTS_LOCKED_WHILE_RUNNING = [
    sideSelectBRF, tradeStakeBRF, tradeDurationBRF, maxTradesBRFInput, maxCyclesBRFInput, gapTicksBRFInput,
    takeProfitBRFInput, stopLossBRFInput, stepFilterBRFCheckbox, restartOnErrorBRFCheckbox, maxErrorsBRFInput,
    loopUntilTargetBRFCheckbox
];

const bulkRfActiveContractIds = new Set();   // every open Bulk Rise/Fall contract
const bulkRfIdToken = new Map();             // contract id -> the cycle (bulkRunId) it belongs to
const brfLimits = {};                        // symbol -> { minTicks, maxTicks, rows } read from Deriv (contracts_for)
let isAutoTradingBRF = false;
let brfCycleOpen = false;       // a cycle has been fired and has not fully settled yet
let brfRunToken = null;         // bulkRunId of the cycle in flight
let brfPendingBuys = 0;         // buy requests sent that have not been answered yet
let brfLegsOpened = 0;          // legs of the current cycle Deriv accepted
let brfCycleErrors = 0;         // legs of the current cycle Deriv rejected
let brfCycleNet = 0;
let brfCycleWins = 0;
let brfCycleLosses = 0;
let brfCycleEntryTimes = new Set(); // entry tick of every settled leg in the cycle (should be ONE value)
let brfCompleted = 0;           // settled cycles in this run
let brfRunNet = 0;              // net P/L of this run (drives Take-Profit / Stop-Loss)
let brfGapRemaining = 0;
let brfFailedCyclesInRow = 0;
let brfWatchdog = null;
let brfStopReason = '';
let brfLastDurationNote = '';
let brfStats = { cycles: 0, cyclesUp: 0, legsWon: 0, legsLost: 0, net: 0 };

const brfMoney = (v) => `${v < 0 ? '-' : '+'}$${Math.abs(v).toFixed(2)}`;
const brfWsOpen = () => !!(optionsWebSocket && optionsWebSocket.readyState === WebSocket.OPEN);

function brfIsStepIndex() {
    const value = marketDropdown.value || '';
    const opt = marketDropdown.selectedOptions && marketDropdown.selectedOptions[0];
    return /^stp/i.test(value) || /step\s*index/i.test(opt ? opt.textContent : '');
}
function brfFilterPass() {
    return !(stepFilterBRFCheckbox && stepFilterBRFCheckbox.checked) || brfIsStepIndex();
}
function brfMarketLabel() {
    if (brfIsStepIndex()) return 'STEP INDEX';
    const opt = marketDropdown.selectedOptions && marketDropdown.selectedOptions[0];
    return ((opt && opt.textContent) || 'NO MARKET').toUpperCase();
}
function brfSide() { return sideSelectBRF ? sideSelectBRF.value : 'BOTH'; }
function brfContractTypes() {
    const side = brfSide();
    return side === 'RISE' ? ['CALL'] : side === 'FALL' ? ['PUT'] : ['CALL', 'PUT'];
}
function brfPairLabel() {
    const side = brfSide();
    return side === 'RISE' ? 'RISE ONLY' : side === 'FALL' ? 'FALL ONLY' : 'RISE + FALL';
}
function brfMaxCycles() { return Math.max(1, parseInt(maxCyclesBRFInput.value, 10) || 1); }
function brfPairs() { return Math.min(100, Math.max(1, parseInt(maxTradesBRFInput.value, 10) || 1)); }

// Duration: sent exactly as typed. It is only changed if it falls outside what Deriv allows for this
// market (read from contracts_for). It is never rounded up to an even number or padded to a guessed minimum,
// because that silently made trades run longer than the ticks you set.
function brfDuration() {
    const known = brfLimits[marketDropdown.value];
    const typed = parseInt(tradeDurationBRF.value, 10);
    const lo = (known && known.minTicks) || 1;
    const hi = (known && known.maxTicks) || 10;
    let n = Number.isFinite(typed) ? typed : Math.max(lo, 2);
    n = Math.min(hi, Math.max(lo, n));
    if (n !== typed) {
        tradeDurationBRF.value = n;
        const note = `${Number.isFinite(typed) ? typed : 'blank'}->${n}@${marketDropdown.value}`;
        if (note !== brfLastDurationNote) {
            brfLastDurationNote = note;
            logToConsole(`[Bulk Rise/Fall] Duration set to ${n} ticks (this market allows ${lo}-${hi}).`, "system-msg");
        }
    }
    return n;
}

// --- Deriv's real duration limits for Rise/Fall on this market ---
async function brfLoadLimits(symbol) {
    if (!symbol || !brfWsOpen()) return null;
    if (brfLimits[symbol] !== undefined) return brfLimits[symbol];
    const list = await hgLoadLimits(symbol);
    if (!Array.isArray(list)) return (brfLimits[symbol] = {});
    const rows = list.filter(e => e.contract_type === 'CALL' || e.contract_type === 'PUT');
    let minTicks = null, maxTicks = null;
    rows.forEach(e => {
        const mn = hgParseDur(e.min_contract_duration), mx = hgParseDur(e.max_contract_duration);
        if (mn && mn.u === 't') {
            minTicks = minTicks === null ? mn.v : Math.min(minTicks, mn.v);
            if (mx && mx.u === 't') maxTicks = Math.max(maxTicks || 0, mx.v);
        }
    });
    brfLimits[symbol] = { minTicks, maxTicks, rows: rows.length };
    if (!rows.length) {
        logToConsole(`[Bulk Rise/Fall] Deriv does not list Rise/Fall (CALL/PUT) for ${symbol}.`, "error-msg");
    } else if (minTicks === null) {
        logToConsole(`[Bulk Rise/Fall] ${symbol}: Rise/Fall is not offered in ticks here (Deriv lists it by time only). Use the Rise/Fall Signal tab with minutes instead.`, "error-msg");
    } else {
        logToConsole(`[Bulk Rise/Fall] ${symbol}: Rise/Fall allows ${minTicks}-${maxTicks || '?'} ticks.`, "system-msg");
    }
    return brfLimits[symbol];
}

// --- live payout check: real proposals for the Rise and Fall legs ---
async function brfProposal(type, stake, duration, symbol) {
    for (let attempt = 0; attempt < 2; attempt++) {
        const symKey = hgProposalStyle === 0 ? 'underlying_symbol' : 'symbol';
        const r = await hgProposal({
            proposal: 1, amount: stake, basis: 'stake', contract_type: type,
            currency: currencyText.textContent || 'USD',
            duration, duration_unit: 't', [symKey]: symbol
        });
        if (r.proposal) return r;
        if (attempt === 0 && r.error && /symbol|underlying|additional|unrecogni|schema/i.test(r.error.message || '')) {
            hgProposalStyle = 1 - hgProposalStyle;
            continue;
        }
        return r;
    }
}

async function brfCheckPayout() {
    if (!brfWsOpen()) {
        logToConsole("Error: Real-time stream must be connected before checking a payout.", "error-msg");
        return;
    }
    const symbol = marketDropdown.value;
    const stake = parseFloat(tradeStakeBRF.value);
    if (!symbol || !(stake > 0)) {
        logToConsole("[Bulk Rise/Fall] Pick a market and enter a stake first.", "error-msg");
        return;
    }
    setButtonLoading(btnQuoteBRF, true, 'Checking...');
    try {
        await brfLoadLimits(symbol);
        const duration = brfDuration();
        const types = brfContractTypes();
        const results = await Promise.all(types.map(t => brfProposal(t, stake, duration, symbol)));
        const failed = results.findIndex(r => !r || !r.proposal);
        if (failed !== -1) {
            const msg = (results[failed] && results[failed].error && results[failed].error.message) || 'no quote returned';
            brfQuoteEl.textContent = `Deriv rejected the ${types[failed] === 'CALL' ? 'Rise' : 'Fall'} quote: ${msg}`;
            brfQuoteEl.className = 'error-msg';
            logToConsole(`[Bulk Rise/Fall] Quote rejected (${duration} ticks, $${stake.toFixed(2)}): ${msg}`, "error-msg");
            return;
        }
        const quotes = results.map((r, i) => {
            const ask = parseFloat(r.proposal.ask_price) || stake;
            const payout = parseFloat(r.proposal.payout) || 0;
            return { type: types[i], ask, payout, pct: ask > 0 ? (payout - ask) / ask * 100 : 0 };
        });
        const name = (q) => q.type === 'CALL' ? 'Rise' : 'Fall';
        const legsText = quotes.map(q => `${name(q)} pays $${q.payout.toFixed(2)} (+${q.pct.toFixed(1)}%)`).join(' | ');
        if (quotes.length === 2) {
            const cost = quotes[0].ask + quotes[1].ask;
            const nets = quotes.map(q => q.payout - cost);
            const worst = Math.min(...nets), best = Math.max(...nets);
            const range = Math.abs(best - worst) < 0.005 ? brfMoney(best) : `${brfMoney(worst)} to ${brfMoney(best)}`;
            brfQuoteEl.textContent = `${legsText}. Cost per pair $${cost.toFixed(2)}, so a pair where one leg wins nets ${range}.`;
            brfQuoteEl.className = best > 0 ? 'success-msg' : 'error-msg';
            if (best <= 0) {
                logToConsole(`[Bulk Rise/Fall] Heads up: with Both sides, only one leg can win and it pays less than the $${cost.toFixed(2)} you spend on the pair, so every pair that settles with one winner is a net loss of ${brfMoney(best)} or worse.`, "error-msg");
            }
        } else {
            const q = quotes[0];
            const breakEven = q.payout > 0 ? q.ask / q.payout * 100 : 0;
            brfQuoteEl.textContent = `${legsText}. You need to win ${breakEven.toFixed(1)}% of trades just to break even.`;
            brfQuoteEl.className = 'system-msg';
        }
        logToConsole(`[Bulk Rise/Fall] Payout check (${duration} ticks, $${stake.toFixed(2)} per side): ${legsText}.`, "system-msg");
    } finally {
        setButtonLoading(btnQuoteBRF, false);
        brfRender();
    }
}

// --- status panel ---
function brfEntryState() {
    if (!brfWsOpen()) return ['ENTRY CHECK: STREAM OFFLINE', 'bad'];
    if (isTradingLocked()) return ['ENTRY CHECK: LOCKED (SESSION)', 'bad'];
    if (!brfFilterPass()) return ['ENTRY CHECK: WRONG MARKET', 'bad'];
    if (brfCycleOpen) return ['ENTRY CHECK: ANALYSING', 'warn'];
    if (isAutoTradingBRF && brfGapRemaining > 0) {
        return [`ENTRY CHECK: WAIT ${brfGapRemaining} TICK${brfGapRemaining > 1 ? 'S' : ''}`, 'warn'];
    }
    return [isAutoTradingBRF ? 'ENTRY CHECK: READY ON NEXT TICK' : 'ENTRY CHECK: READY', 'ok'];
}

function brfRender() {
    if (!brfStatusEl) return;
    const market = brfMarketLabel();
    let status, statusClass;
    if (!brfWsOpen()) { status = 'OFFLINE - connect the stream'; statusClass = 'system-msg'; }
    else if (brfCycleOpen) { status = `CYCLE ${brfCompleted + 1} SETTLING - ${market} / ${brfPairLabel()}`; statusClass = 'system-msg'; }
    else if (isAutoTradingBRF) { status = `RUNNING - ${market} / ${brfPairLabel()}`; statusClass = 'success-msg'; }
    else if (brfStopReason) { status = `STOPPED - ${brfStopReason}`; statusClass = 'error-msg'; }
    else { status = `READY - ${market} / ${brfPairLabel()}`; statusClass = 'success-msg'; }
    brfStatusEl.textContent = status;
    brfStatusEl.className = statusClass;

    const filterOn = stepFilterBRFCheckbox && stepFilterBRFCheckbox.checked;
    let filterText, filterClass;
    if (!filterOn) { filterText = 'STEP INDEX FILTER: OFF'; filterClass = 'warn'; }
    else if (!marketDropdown.value) { filterText = 'STEP INDEX FILTER: ACTIVE'; filterClass = 'warn'; }
    else if (brfIsStepIndex()) { filterText = 'STEP INDEX FILTER: ACTIVE'; filterClass = 'ok'; }
    else { filterText = 'STEP INDEX FILTER: BLOCKED (NOT A STEP INDEX)'; filterClass = 'bad'; }
    brfFilterEl.textContent = filterText;
    brfFilterEl.className = `brf-chip ${filterClass}`;

    brfPairModeEl.textContent = `PAIR MODE: ${brfPairLabel()}`;
    brfPairModeEl.className = 'brf-chip ok';

    const [entryText, entryClass] = brfEntryState();
    brfEntryEl.textContent = entryText;
    brfEntryEl.className = `brf-chip ${entryClass}`;

    const loopMode = loopUntilTargetBRFCheckbox && loopUntilTargetBRFCheckbox.checked;
    brfCycleEl.textContent = loopMode ? `${brfCompleted} (until session target)` : `${brfCompleted} / ${brfMaxCycles()}`;

    brfLegsEl.textContent = `${brfStats.legsWon} / ${brfStats.legsLost}`;
    const avg = brfStats.cycles ? brfStats.net / brfStats.cycles : 0;
    brfNetEl.textContent = `${brfMoney(brfStats.net)} (avg ${brfMoney(avg)} / cycle, ${brfStats.cyclesUp} of ${brfStats.cycles} cycles in profit)`;
    brfNetEl.className = brfStats.net > 0 ? 'success-msg' : brfStats.net < 0 ? 'error-msg' : 'system-msg';
}

// --- firing a cycle ---
function brfFireCycle(isManual) {
    if (isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return false;
    }
    if (!brfWsOpen()) {
        logToConsole("Error: Real-time stream must be connected before running trades.", "error-msg");
        return false;
    }
    if (brfCycleOpen) {
        if (isManual) logToConsole("[Bulk Rise/Fall] The previous cycle is still settling - wait for it to finish.", "system-msg");
        return false;
    }
    const symbol = marketDropdown.value;
    if (!symbol) {
        logToConsole("[Bulk Rise/Fall] Pick a market first.", "error-msg");
        return false;
    }
    if (!brfFilterPass()) {
        logToConsole("[Bulk Rise/Fall] Step Index filter is on and the selected market is not a Step Index. Pick one (e.g. Step Index 100) or untick the filter.", "error-msg");
        brfRender();
        return false;
    }
    const stake = parseFloat(tradeStakeBRF.value);
    if (!(stake > 0)) {
        logToConsole("[Bulk Rise/Fall] Enter a stake above 0.", "error-msg");
        return false;
    }
    const duration = brfDuration();
    const types = brfContractTypes();
    const pairs = brfPairs();
    const legs = pairs * types.length;
    const currency = currencyText.textContent || "USD";
    const token = "BULK_RF_" + Date.now();

    challengeBatchExpectedCounts[token] = legs;
    batchSyncExpected[token] = legs;

    // Serialize each side once; the hot loop below is nothing but socket sends.
    const payloads = types.map(contractType => JSON.stringify({
        "buy": 1,
        "price": stake,
        "subscribe": 1,
        "parameters": {
            "amount": stake,
            "basis": "stake",
            "contract_type": contractType,
            "currency": currency,
            "duration": duration,
            "duration_unit": "t",
            "underlying_symbol": symbol
        },
        "passthrough": { "bulkRunId": token }
    }));

    brfCycleOpen = true;
    brfRunToken = token;
    brfPendingBuys = legs;
    brfLegsOpened = 0;
    brfCycleErrors = 0;
    brfCycleNet = 0;
    brfCycleWins = 0;
    brfCycleLosses = 0;
    brfCycleEntryTimes = new Set();
    brfCd = { token, duration, entryEpoch: null, cycleNo: brfCompleted + 1 };
    brfCdRender();

    const sendStart = performance.now();
    for (let i = 0; i < pairs; i++) {
        for (const payload of payloads) optionsWebSocket.send(payload);
    }
    const sendMs = (performance.now() - sendStart).toFixed(1);

    // If a receipt or settlement never arrives, release the cycle instead of freezing auto-mode forever.
    clearTimeout(brfWatchdog);
    brfWatchdog = setTimeout(() => {
        if (brfCycleOpen && brfRunToken === token) {
            logToConsole(`[Bulk Rise/Fall] Cycle ${brfCompleted + 1} did not report back in time - releasing it.`, "error-msg");
            brfCompleteCycle();
        }
    }, duration * 3000 + 20000);

    const what = types.length === 2 ? `${pairs} Rise + ${pairs} Fall` : `${pairs} ${types[0] === 'CALL' ? 'Rise' : 'Fall'}`;
    logToConsole(`[${token}] ${isManual ? 'Manual' : 'Auto'} cycle ${brfCompleted + 1}: fired ${what} (${legs} contract${legs > 1 ? 's' : ''}, $${stake.toFixed(2)} each, ${duration} ticks) on this tick. (send loop ${sendMs} ms)`, "success-msg");
    brfRender();
    return true;
}

// --- live tick countdown for the cycle in flight ---
// Deriv's entry tick is the first tick AFTER the buy is accepted; the contract then runs N more ticks.
// So a "2 tick" trade is: wait for entry tick -> tick 1 -> tick 2 (exit) -> Deriv confirms the result.
const brfCountdownEl = document.getElementById('brf-countdown');
let brfCd = null;                 // { token, duration, entryEpoch, cycleNo }
let brfCdEpochs = [];             // recent tick epochs seen on the stream
let brfCdLastText = '';

function brfCdSet(text, cls) {
    if (!brfCountdownEl) return;
    brfCountdownEl.textContent = text;
    brfCountdownEl.className = cls || 'system-msg';
}
function brfCdRender() {
    if (!brfCountdownEl) return;
    if (!brfCd) return;
    if (!brfCd.entryEpoch) {
        brfCdSet('Cycle fired - waiting for the entry tick...', 'system-msg');
        return;
    }
    const n = brfCd.duration;
    const seen = Math.min(n, brfCdEpochs.filter(e => e > brfCd.entryEpoch).length);
    const left = n - seen;
    if (left > 0) {
        brfCdSet(`Entry tick locked | tick ${seen} of ${n} | ${left} tick${left > 1 ? 's' : ''} left`, 'success-msg');
    } else {
        brfCdSet(`Exit tick reached (${n} of ${n}) - waiting for Deriv to settle...`, 'system-msg');
    }
    const t = brfCountdownEl.textContent;
    if (t !== brfCdLastText) { brfCdLastText = t; }
}
function brfCdTick(epoch) {
    if (!Number.isFinite(epoch)) return;
    brfCdEpochs.push(epoch);
    if (brfCdEpochs.length > 30) brfCdEpochs.shift();
    if (brfCd && brfCycleOpen) brfCdRender();
}
function brfCdContract(contract) {
    if (!brfCd || !brfCycleOpen || brfCd.entryEpoch) return;
    if (bulkRfIdToken.get(contract.contract_id) !== brfCd.token) return;
    const e = parseInt(contract.entry_tick_time, 10);
    if (Number.isFinite(e) && e > 0) {
        brfCd.entryEpoch = e;
        brfCdRender();
    }
}

let brfDurationChecked = null;
function brfOnReceipt(contractId, token, shortcode) {
    // Confirm Deriv accepted the same tick count the tool sent (once per cycle).
    if (brfCd && token === brfRunToken && brfDurationChecked !== token) {
        const m = /_(\d+)T_/.exec(String(shortcode || ''));
        if (m) {
            brfDurationChecked = token;
            const got = parseInt(m[1], 10);
            if (got === brfCd.duration) logToConsole(`[Bulk Rise/Fall] Verified: tool sent ${brfCd.duration} ticks and Deriv accepted ${got} ticks.`, "success-msg");
            else logToConsole(`[Bulk Rise/Fall] MISMATCH: tool sent ${brfCd.duration} ticks but Deriv accepted ${got}.`, "error-msg");
        }
    }
    bulkRfActiveContractIds.add(contractId);
    bulkRfIdToken.set(contractId, token);
    if (brfCycleOpen && token === brfRunToken) {
        brfPendingBuys = Math.max(0, brfPendingBuys - 1);
        brfLegsOpened++;
    }
}

function brfHandleBuyError(incoming) {
    const token = incoming.echo_req.passthrough.bulkRunId;
    // A rejected leg will never settle: shrink what the trackers wait for so the batch can still close out.
    if (challengeBatchExpectedCounts[token] !== undefined) {
        challengeBatchExpectedCounts[token] -= 1;
        if (challengeBatchExpectedCounts[token] <= 0) delete challengeBatchExpectedCounts[token];
    }
    if (batchSyncExpected[token] !== undefined) {
        batchSyncExpected[token] -= 1;
        if (batchSyncExpected[token] <= 0) delete batchSyncExpected[token];
    }
    if (brfCycleOpen && token === brfRunToken) {
        brfPendingBuys = Math.max(0, brfPendingBuys - 1);
        brfCycleErrors++;
    }
    if (isAutoTradingBRF && !(restartOnErrorBRFCheckbox && restartOnErrorBRFCheckbox.checked)) {
        brfStop(`a buy was rejected (${incoming.error.message})`);
    }
    brfMaybeFinishCycle();
}

function brfOnSettled(contract) {
    const id = contract.contract_id;
    const token = bulkRfIdToken.get(id);
    bulkRfActiveContractIds.delete(id);
    bulkRfIdToken.delete(id);
    const profit = parseFloat(contract.profit);
    const p = Number.isFinite(profit) ? profit : 0;
    const won = contract.status === 'won';
    brfStats.net += p;
    if (won) brfStats.legsWon++; else brfStats.legsLost++;
    if (brfCycleOpen && token === brfRunToken) {
        brfCycleNet += p;
        if (won) brfCycleWins++; else brfCycleLosses++;
        if (contract.entry_tick_time) brfCycleEntryTimes.add(contract.entry_tick_time);
        const tc = contract.tick_count || contract.tick_stream && contract.tick_stream.length;
        if (brfStats.legsWon + brfStats.legsLost <= 4) {
            logToConsole(`[Bulk Rise/Fall] Leg ${id}: entry tick ${contract.entry_tick_time || '?'} -> exit tick ${contract.exit_tick_time || '?'} (${tc || '?'} ticks), ${won ? 'won' : 'lost'}.`, "system-msg");
        }
    }
    brfMaybeFinishCycle();
    brfRender();
}

function brfMaybeFinishCycle() {
    if (!brfCycleOpen || brfPendingBuys > 0) return;
    for (const [, token] of bulkRfIdToken) {
        if (token === brfRunToken) return; // a leg of this cycle is still open
    }
    brfCompleteCycle();
}

function brfCompleteCycle() {
    if (!brfCycleOpen) return;
    clearTimeout(brfWatchdog);
    brfWatchdog = null;
    brfCycleOpen = false;
    if (brfCd) brfCdSet(`Cycle ${brfCd.cycleNo} settled`, 'success-msg');
    brfCd = null;
    brfGapRemaining = Math.max(0, parseInt(gapTicksBRFInput.value, 10) || 0);

    if (brfCycleEntryTimes.size > 1) {
        logToConsole(`[Bulk Rise/Fall] Warning: this cycle's legs entered on ${brfCycleEntryTimes.size} different ticks (the buys reached Deriv across a tick boundary), so they did not share one entry price and may both win or both lose.`, "error-msg");
    }
    if (brfLegsOpened > 0) {
        brfCompleted++;
        brfRunNet += brfCycleNet;
        brfStats.cycles++;
        if (brfCycleNet > 0) brfStats.cyclesUp++;
        brfFailedCyclesInRow = 0;
        logToConsole(`[Bulk Rise/Fall] Cycle ${brfCompleted} settled: ${brfCycleWins} won / ${brfCycleLosses} lost${brfCycleErrors ? ` / ${brfCycleErrors} rejected` : ''}, net ${brfMoney(brfCycleNet)}. Run total ${brfMoney(brfRunNet)}.`,
            brfCycleNet > 0 ? "success-msg" : brfCycleNet < 0 ? "error-msg" : "system-msg");
    } else {
        brfFailedCyclesInRow++;
        logToConsole(`[Bulk Rise/Fall] Cycle failed - none of its ${brfCycleErrors || 'buy'} request(s) opened a contract (${brfFailedCyclesInRow} in a row).`, "error-msg");
    }

    if (isAutoTradingBRF) {
        const tp = parseFloat(takeProfitBRFInput.value) || 0;
        const sl = parseFloat(stopLossBRFInput.value) || 0;
        const maxErrors = Math.max(1, parseInt(maxErrorsBRFInput.value, 10) || 1);
        const loopMode = loopUntilTargetBRFCheckbox && loopUntilTargetBRFCheckbox.checked;
        if (tp > 0 && brfRunNet >= tp) brfStop(`take-profit hit (${brfMoney(brfRunNet)})`);
        else if (sl > 0 && brfRunNet <= -sl) brfStop(`stop-loss hit (${brfMoney(brfRunNet)})`);
        else if (brfFailedCyclesInRow >= maxErrors) brfStop(`${brfFailedCyclesInRow} failed cycles in a row`);
        else if (!loopMode && brfCompleted >= brfMaxCycles()) brfStop(`max cycles reached (${brfCompleted}/${brfMaxCycles()})`);
    }
    brfRender();
}

// Stream dropped: open legs will never report, so forget them.
function brfAbortCycle() {
    clearTimeout(brfWatchdog);
    brfWatchdog = null;
    brfCycleOpen = false;
    brfCd = null;
    brfCdSet('Stream dropped - cycle released', 'error-msg');
    brfPendingBuys = 0;
    bulkRfActiveContractIds.clear();
    bulkRfIdToken.clear();
    brfRender();
}

// --- auto-mode ---
function handleBulkRfTick() {
    if (!isAutoTradingBRF) return;
    if (brfCycleOpen) { brfRender(); return; }
    if (brfGapRemaining > 0) {   // skip exactly N ticks, then fire on the next one
        brfGapRemaining--;
        brfRender();
        return;
    }
    brfFireCycle(false);
}

function brfStop(reason) {
    brfStopReason = reason;
    logToConsole(`[Bulk Rise/Fall] Auto-mode stopped - ${reason}.`, "system-msg");
    toggleAutoBRF(false);
}

function toggleAutoBRF(state) {
    if (!btnToggleAutoBRF) return;
    if (state && isTradingLocked()) {
        logToConsole(tradingLockMessage(), "error-msg");
        return;
    }
    if (state && !brfWsOpen()) {
        logToConsole("Error: Real-time stream must be connected before running trades.", "error-msg");
        return;
    }
    if (state && !brfFilterPass()) {
        logToConsole("[Bulk Rise/Fall] Step Index filter is on and the selected market is not a Step Index. Pick one (e.g. Step Index 100) or untick the filter.", "error-msg");
        brfRender();
        return;
    }
    if (state && !canStartLoopMode(loopUntilTargetBRFCheckbox, "Bulk Rise/Fall")) return;
    const wasRunning = isAutoTradingBRF;
    isAutoTradingBRF = state;
    btnToggleAutoBRF.textContent = state ? "Stop Bulk Rise/Fall" : "Start Bulk Rise/Fall";
    btnToggleAutoBRF.classList.toggle('stream-active', state);
    BRF_INPUTS_LOCKED_WHILE_RUNNING.forEach(el => { if (el) el.disabled = state; });
    if (btnBuyBRF) btnBuyBRF.disabled = state || !brfWsOpen();

    if (state) {
        brfStopReason = '';
        brfCompleted = 0;
        brfRunNet = 0;
        brfGapRemaining = 0;
        brfFailedCyclesInRow = 0;
        brfLoadLimits(marketDropdown.value).then(() => { if (isAutoTradingBRF) brfDuration(); });
        const loopMode = loopUntilTargetBRFCheckbox && loopUntilTargetBRFCheckbox.checked;
        logToConsole(`Bulk Rise/Fall Started: ${brfPairLabel()}, ${brfPairs()} pair(s) per cycle, $${(parseFloat(tradeStakeBRF.value) || 0).toFixed(2)} per side, ${loopMode ? 'until the session target is hit' : `up to ${brfMaxCycles()} cycles`}. Firing the first cycle on the next tick...`, "success-msg");
    } else if (wasRunning) {
        logToConsole("Bulk Rise/Fall Stopped." + (brfCycleOpen ? " The cycle in flight will still settle." : ""));
    }
    brfRender();
}

function brfResetStats() {
    brfStats = { cycles: 0, cyclesUp: 0, legsWon: 0, legsLost: 0, net: 0 };
    brfCompleted = 0;
    brfRunNet = 0;
    brfStopReason = '';
    brfQuoteEl.textContent = 'Not checked yet';
    brfQuoteEl.className = 'system-msg';
    logToConsole("[Bulk Rise/Fall] Stats reset.");
    brfRender();
}

// --- wiring ---
if (btnBuyBRF) btnBuyBRF.addEventListener('click', () => brfFireCycle(true));
if (btnToggleAutoBRF) btnToggleAutoBRF.addEventListener('click', () => toggleAutoBRF(!isAutoTradingBRF));
if (btnQuoteBRF) btnQuoteBRF.addEventListener('click', brfCheckPayout);
if (btnResetBRF) btnResetBRF.addEventListener('click', brfResetStats);
[sideSelectBRF, stepFilterBRFCheckbox, maxCyclesBRFInput, loopUntilTargetBRFCheckbox].forEach(el => {
    if (el) el.addEventListener('change', brfRender);
});
if (tradeDurationBRF) tradeDurationBRF.addEventListener('change', () => { if (brfWsOpen()) brfDuration(); });
marketDropdown.addEventListener('change', () => {
    brfRender();
    if (brfWsOpen() && marketDropdown.value) brfLoadLimits(marketDropdown.value);
});
brfRender();
// Keep the status cards fresh (market loaded, session lock, stream state) while this tab is open.
setInterval(() => { if (activeTabId === 'tab-bulk-rf') brfRender(); }, 1000);


// =====================================================================
// COUNTER-TREND RUNS (was Run Flip)  +  EVEN/ODD MARTINGALE (was Parity Beast)
// Ported from the Deriv Bot XML strategies "Only Ups strategy" and "Tuomoke beast v1.5",
// then upgraded: one-contract-at-a-time gating, take-profit / stop-loss, loss-streak and
// max-stake limits, real payout checks, live status panels, and full hooks into the shared
// ledger, Session Tracker, Challenge Mode and the global halt.
// =====================================================================
const pkEl = (id) => document.getElementById(id);
const pkMoney = (v) => `${v < 0 ? '-' : '+'}$${Math.abs(v).toFixed(2)}`;
const pkRound2 = (v) => Math.round(v * 100) / 100;
const pkCeil2 = (v) => Math.ceil(v * 100 - 1e-9) / 100;
const pkClamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pkWsOpen = () => !!(optionsWebSocket && optionsWebSocket.readyState === WebSocket.OPEN);
const pkNum = (id, fallback) => { const el = pkEl(id); const v = el ? parseFloat(el.value) : NaN; return Number.isFinite(v) ? v : fallback; };
let pkSeq = 0;
function pkNewToken(prefix, auto) { return `${prefix}${auto ? 'A' : 'M'}_${Date.now()}_${++pkSeq}`; }

function pkSetText(id, text, cls) {
    const el = pkEl(id);
    if (!el) return;
    el.textContent = text;
    if (cls !== undefined) el.className = cls;
}
// A button handler that can never fail silently: any error lands in the Log panel.
function pkSafe(label, fn) {
    return (...args) => {
        const report = (e) => { logToConsole(`[${label}] Error: ${e && e.message ? e.message : e}`, "error-msg"); console.error(e); };
        try { const r = fn(...args); if (r && typeof r.catch === 'function') r.catch(report); } catch (e) { report(e); }
    };
}
// Explains why the buttons look dead (they only unlock once the stream is live and no lock is active).
function pkSetHint(id, open, locked) {
    const el = pkEl(id);
    if (!el) return;
    let msg = '';
    if (!open) msg = 'Buttons are locked until the live stream is on: Connect, pick your account, then press Stream Digits.';
    else if (locked) msg = 'Buttons are locked by your Session Tracker / Challenge Mode until the next window opens.';
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}

function pkSetChip(id, text, cls) {
    const el = pkEl(id);
    if (!el) return;
    el.textContent = text;
    el.className = `tk-chip ${cls || ''}`.trim();
}

// One single-contract buy, tagged so the receipt / settlement can be routed back to its tab.
function pkBuy(prefix, auto, contractType, stake, ticks) {
    const token = pkNewToken(prefix, auto);
    challengeBatchExpectedCounts[token] = 1;   // lets the Session Tracker / Challenge Mode count it
    optionsWebSocket.send(JSON.stringify({
        "buy": 1,
        "price": stake,
        "subscribe": 1,
        "parameters": {
            "amount": stake,
            "basis": "stake",
            "contract_type": contractType,
            "currency": currencyText.textContent || "USD",
            "duration": ticks,
            "duration_unit": "t",
            "underlying_symbol": marketDropdown.value
        },
        "passthrough": { "bulkRunId": token }
    }));
    return token;
}

// ---------------------------------------------------------------------
// COUNTER-TREND RUNS  (Only Ups / Only Downs, closed-candle + live-tick signal, flips after a loss)
// ---------------------------------------------------------------------
const btnToggleAutoFlip = pkEl('btn-toggle-auto-flip');
const btnBuyFlipUp = pkEl('btn-buy-flip-up');
const btnBuyFlipDown = pkEl('btn-buy-flip-down');
const btnQuoteFlip = pkEl('btn-quote-flip');
const btnResetFlip = pkEl('btn-reset-flip');
const FLIP_INPUT_IDS = ['flip-candle-tf', 'flip-stake', 'flip-ticks', 'flip-loss-ticks', 'flip-mult', 'flip-max-stake',
    'flip-cap-action', 'flip-tick-confirm', 'flip-min-body', 'flip-tp', 'flip-sl', 'flip-max-losses', 'flip-max-trades',
    'flip-on-loss', 'flip-stop-on-recovery', 'flip-bias'];
const FLIP_TF_LABEL = { 60: '1m', 120: '2m', 180: '3m', 300: '5m', 600: '10m', 900: '15m', 1800: '30m', 3600: '1h' };

let isAutoTradingFlip = false;
let flipRun = null;                 // live state of the current auto run
let flipRunId = 0;                  // bumps on every start so a late settlement from an old run is ignored
let flipOpen = false;               // an auto trade is in flight
let flipWatchdog = null;
let flipStopReason = '';
let flipErrorsInRow = 0;
let flipStats = { w: 0, l: 0, net: 0 };
const flipPendingTokens = new Map();   // token -> run id, until Deriv's receipt arrives
const flipActive = new Map();          // contract id -> { auto, token, runId }

let flipLastQuote = null, flipLastEpoch = 0, flipTickDir = 0, flipTickRun = 0;
let flipCandle = null, flipCandleKey = null, flipCandleFetching = false, flipCandleRetryAt = 0;

function flipReadConfig() {
    const cfg = {
        gran: parseInt((pkEl('flip-candle-tf') || {}).value, 10) || 300,
        bias: (pkEl('flip-bias') || {}).value === 'WITH' ? 'WITH' : 'OPPOSITE',   // OPPOSITE = fade the move
        stake: pkRound2(pkNum('flip-stake', 0.5)),
        ticks: pkClamp(Math.round(pkNum('flip-ticks', 2)), 2, 10),
        lossTicks: pkClamp(Math.round(pkNum('flip-loss-ticks', 3)), 2, 10),
        mult: Math.max(1, pkNum('flip-mult', 1)),
        maxStake: Math.max(0, pkNum('flip-max-stake', 0)),
        capAction: (pkEl('flip-cap-action') || {}).value || 'reset',
        tickConfirm: pkClamp(Math.round(pkNum('flip-tick-confirm', 1)), 1, 5),
        minBody: pkClamp(pkNum('flip-min-body', 0), 0, 100),
        tp: Math.max(0, pkNum('flip-tp', 0)),
        sl: Math.max(0, pkNum('flip-sl', 0)),
        maxLosses: Math.max(0, Math.round(pkNum('flip-max-losses', 0))),
        maxTrades: Math.max(0, Math.round(pkNum('flip-max-trades', 0))),
        flipOnLoss: !!(pkEl('flip-on-loss') && pkEl('flip-on-loss').checked),
        stopOnRecovery: !!(pkEl('flip-stop-on-recovery') && pkEl('flip-stop-on-recovery').checked)
    };
    if (!(cfg.stake >= 0.35)) cfg.error = 'Stake must be at least $0.35.';
    else if (cfg.maxStake > 0 && cfg.maxStake < cfg.stake) cfg.error = 'Max stake is lower than your base stake.';
    return cfg;
}

function flipPrice(v) {
    const d = getSymbolDecimals(marketDropdown.value);
    return Number(v).toFixed(d > 0 ? d : 2);
}
const flipDirName = (dir) => dir === 'UP' ? 'Only Ups' : 'Only Downs';

// --- tick + candle feed (runs on every tick, kept very light) ---
function flipOnTick(price, epoch) {
    if (Number.isFinite(price)) {
        if (flipLastQuote !== null) {
            const d = price > flipLastQuote ? 1 : price < flipLastQuote ? -1 : 0;
            if (d === 0) { flipTickDir = 0; flipTickRun = 0; }
            else if (d === flipTickDir) flipTickRun++;
            else { flipTickDir = d; flipTickRun = 1; }
        }
        flipLastQuote = price;
    }
    if (Number.isFinite(epoch) && epoch > 0) {
        flipLastEpoch = epoch;
        flipEnsureCandle();
    }
}

function flipCandleKeyNow(gran) {
    return `${marketDropdown.value}|${gran}|${Math.floor(flipLastEpoch / gran)}`;
}

// The "last closed candle" only changes at a timeframe boundary, so it is fetched once per boundary
// (and again after a market / timeframe change) instead of on every tick.
function flipEnsureCandle() {
    if (!(isAutoTradingFlip || activeTabId === 'tab-run-flip')) return;
    if (!pkWsOpen() || !marketDropdown.value || !flipLastEpoch) return;
    const gran = (isAutoTradingFlip && flipRun) ? flipRun.cfg.gran : (parseInt((pkEl('flip-candle-tf') || {}).value, 10) || 300);
    const key = flipCandleKeyNow(gran);
    if (flipCandleKey === key || flipCandleFetching || Date.now() < flipCandleRetryAt) return;
    flipCandleFetching = true;
    const nowEpoch = flipLastEpoch;
    hgProposal({ ticks_history: marketDropdown.value, end: 'latest', style: 'candles', granularity: gran, count: 4 }).then(r => {
        flipCandleFetching = false;
        const list = r && Array.isArray(r.candles) ? r.candles : null;
        if (!list) {
            flipCandleRetryAt = Date.now() + 5000;
            logToConsole(`[Counter-Trend Runs] Couldn't load the ${FLIP_TF_LABEL[gran] || gran + 's'} candle (${(r && r.error && r.error.message) || 'no data'}). Retrying shortly.`, "error-msg");
            return;
        }
        const closed = list.filter(c => Number(c.epoch) + gran <= nowEpoch);
        const c = closed[closed.length - 1];
        if (!c) { flipCandleRetryAt = Date.now() + 5000; return; }
        flipCandle = { epoch: Number(c.epoch), open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) };
        flipCandleKey = key;
        flipRender();
    });
}

// The candle and the live ticks must AGREE on which way price is moving (the "move").
// Counter-trend (default) then buys the OPPOSITE run: a bullish candle + rising ticks buys Only Downs,
// a bearish candle + falling ticks buys Only Ups. "With the move" keeps the original behaviour.
function flipSignal(cfg) {
    const c = flipCandle;
    if (!c || !flipLastEpoch || flipCandleKey !== flipCandleKeyNow(cfg.gran)) {
        return { dir: null, wait: true, why: 'Syncing the last closed candle...' };
    }
    const candleDir = c.close > c.open ? 1 : c.close < c.open ? -1 : 0;
    const range = c.high - c.low;
    const bodyPct = range > 0 ? Math.abs(c.close - c.open) / range * 100 : 0;
    const base = { candleDir, bodyPct };
    if (candleDir === 0) return { ...base, dir: null, why: 'The last closed candle was flat' };
    if (cfg.minBody > 0 && bodyPct < cfg.minBody) return { ...base, dir: null, why: `Candle body ${bodyPct.toFixed(0)}% is under your ${cfg.minBody}% minimum` };
    const moveName = candleDir > 0 ? 'bullish' : 'bearish';
    const tickName = candleDir > 0 ? 'rising' : 'falling';
    if (flipTickDir === candleDir && flipTickRun >= cfg.tickConfirm) {
        const withDir = candleDir > 0 ? 'UP' : 'DOWN';
        const dir = cfg.bias === 'WITH' ? withDir : (withDir === 'UP' ? 'DOWN' : 'UP');
        const how = cfg.bias === 'WITH' ? 'trading with it' : `fading it (buying ${flipDirName(dir)})`;
        return { ...base, dir, why: `${FLIP_TF_LABEL[cfg.gran] || ''} candle ${moveName} + ${flipTickRun} ${tickName} tick${flipTickRun > 1 ? 's' : ''}, ${how}` };
    }
    return { ...base, dir: null, why: `Candle ${moveName}, waiting for ${cfg.tickConfirm} ${tickName} tick${cfg.tickConfirm > 1 ? 's' : ''}` };
}

// --- trading ---
function handleFlipTick() {
    if (!isAutoTradingFlip || flipOpen || !flipRun) return;
    const run = flipRun;
    let dir = run.force, why = 'flipped after a loss';
    if (!dir) {
        const s = flipSignal(run.cfg);
        if (!s.dir) return;
        dir = s.dir; why = s.why;
    }
    flipFire(dir, true, why);
}

function flipFire(dir, auto, why) {
    if (isTradingLocked()) { logToConsole(tradingLockMessage(), "error-msg"); return false; }
    if (!pkWsOpen()) { logToConsole("Error: Real-time stream must be connected before running trades.", "error-msg"); return false; }
    if (!marketDropdown.value) { logToConsole("[Counter-Trend Runs] Pick a market first.", "error-msg"); return false; }
    let stake, ticks;
    if (auto) {
        stake = flipRun.stake; ticks = flipRun.ticks;
    } else {
        const cfg = flipReadConfig();
        if (cfg.error) { logToConsole(`[Counter-Trend Runs] ${cfg.error}`, "error-msg"); return false; }
        stake = cfg.stake; ticks = cfg.ticks;
    }
    const token = pkBuy('RUNFLIP_', auto, dir === 'UP' ? 'RUNHIGH' : 'RUNLOW', stake, ticks);
    flipPendingTokens.set(token, auto ? flipRunId : null);
    if (auto) {
        flipOpen = true;
        flipRun.lastDir = dir;
        flipRun.force = null;
        clearTimeout(flipWatchdog);
        const runId = flipRunId;
        flipWatchdog = setTimeout(() => {
            if (flipOpen && runId === flipRunId) {
                flipOpen = false;
                logToConsole("[Counter-Trend Runs] The trade didn't report back in time - releasing it.", "error-msg");
                flipRender();
            }
        }, ticks * 3000 + 25000);
    }
    logToConsole(`[Counter-Trend Runs] ${auto ? 'Auto' : 'Manual'}: ${flipDirName(dir)}, $${stake.toFixed(2)}, ${ticks} ticks (${why}).`, "success-msg");
    flipRender();
    return true;
}

function flipOnReceipt(contractId, token) {
    const runId = flipPendingTokens.get(token);
    flipPendingTokens.delete(token);
    flipActive.set(contractId, { auto: token.startsWith('RUNFLIP_A_'), token, runId: runId === undefined ? null : runId });
    flipErrorsInRow = 0;
}

function flipHandleBuyError(incoming) {
    const token = incoming.echo_req.passthrough.bulkRunId;
    delete challengeBatchExpectedCounts[token];
    const runId = flipPendingTokens.get(token);
    flipPendingTokens.delete(token);
    if (token.startsWith('RUNFLIP_A_') && runId === flipRunId && isAutoTradingFlip) {
        flipOpen = false;
        flipErrorsInRow++;
        if (flipErrorsInRow >= 3) flipStop(`Deriv rejected ${flipErrorsInRow} buys in a row (${incoming.error.message})`);
    }
    flipRender();
}

function flipOnSettled(contract) {
    const info = flipActive.get(contract.contract_id);
    if (!info) return;
    flipActive.delete(contract.contract_id);
    const profit = parseFloat(contract.profit);
    const p = Number.isFinite(profit) ? profit : 0;
    const won = contract.status === 'won';
    flipStats.net += p;
    if (won) flipStats.w++; else flipStats.l++;

    const live = info.auto && info.runId === flipRunId && isAutoTradingFlip && flipRun;
    if (!live) { flipRender(); return; }

    clearTimeout(flipWatchdog);
    flipOpen = false;
    const run = flipRun, cfg = run.cfg;
    run.net += p;
    run.trades++;
    if (won) { run.wins++; run.lossStreak = 0; } else { run.losses++; run.lossStreak++; }

    // 1) run-level exits (same order as the original: take-profit first)
    if (cfg.tp > 0 && run.net >= cfg.tp) return flipStop(`take-profit hit (${pkMoney(run.net)})`);
    if (cfg.sl > 0 && run.net <= -cfg.sl) return flipStop(`stop-loss hit (${pkMoney(run.net)})`);

    if (won) {
        // original bot: a first-trade win or a net-positive win ends the session
        if (cfg.stopOnRecovery && (run.trades === 1 || run.net > 0)) return flipStop(`won and the run is in profit (${pkMoney(run.net)})`);
        run.stake = cfg.stake;                      // a win resets the stake
        run.recovery = run.net < 0;                 // still under water -> keep the longer run
        run.ticks = run.recovery ? cfg.lossTicks : cfg.ticks;
        run.force = null;                           // read the candle again
    } else {
        run.recovery = true;
        run.ticks = cfg.lossTicks;
        run.force = cfg.flipOnLoss ? (run.lastDir === 'UP' ? 'DOWN' : 'UP') : null;
        if (cfg.maxLosses > 0 && run.lossStreak >= cfg.maxLosses) return flipStop(`${run.lossStreak} losses in a row`);
        let next = pkRound2(cfg.stake * Math.pow(cfg.mult, run.lossStreak));
        if (cfg.maxStake > 0 && next > cfg.maxStake) {
            if (cfg.capAction === 'stop') return flipStop(`next stake $${next.toFixed(2)} would pass your $${cfg.maxStake.toFixed(2)} cap`);
            logToConsole(`[Counter-Trend Runs] Next stake $${next.toFixed(2)} would pass the $${cfg.maxStake.toFixed(2)} cap - back to the base stake.`, "system-msg");
            next = cfg.stake;
        }
        run.stake = next;
    }
    if (cfg.maxTrades > 0 && run.trades >= cfg.maxTrades) return flipStop(`max trades reached (${run.trades}/${cfg.maxTrades})`);
    logToConsole(`[Counter-Trend Runs] ${won ? 'Won' : 'Lost'} ${pkMoney(p)} | run ${pkMoney(run.net)} | next: ${run.force ? flipDirName(run.force) + ' (flip)' : 'wait for signal'}, $${run.stake.toFixed(2)}, ${run.ticks} ticks.`, won ? "success-msg" : "error-msg");
    flipRender();
}

function flipStop(reason) {
    flipStopReason = reason;
    logToConsole(`[Counter-Trend Runs] Auto-mode stopped - ${reason}.`, "system-msg");
    toggleAutoFlip(false);
}

function toggleAutoFlip(state) {
    if (!btnToggleAutoFlip) return;
    if (!state && !isAutoTradingFlip) return;
    if (state) {
        if (isAutoTradingFlip) return;
        if (isTradingLocked()) { logToConsole(tradingLockMessage(), "error-msg"); return; }
        if (!pkWsOpen()) { logToConsole("Error: Real-time stream must be connected before running trades.", "error-msg"); return; }
        if (!marketDropdown.value) { logToConsole("[Counter-Trend Runs] Pick a market first.", "error-msg"); return; }
        const cfg = flipReadConfig();
        if (cfg.error) { logToConsole(`[Counter-Trend Runs] ${cfg.error}`, "error-msg"); return; }
        pkEl('flip-ticks').value = cfg.ticks;
        pkEl('flip-loss-ticks').value = cfg.lossTicks;
        flipRunId++;
        flipRun = { cfg, net: 0, trades: 0, wins: 0, losses: 0, lossStreak: 0, stake: cfg.stake, ticks: cfg.ticks, recovery: false, force: null, lastDir: null };
        flipOpen = false;
        flipErrorsInRow = 0;
        flipStopReason = '';
        clearTimeout(flipWatchdog);
    }
    isAutoTradingFlip = state;
    btnToggleAutoFlip.textContent = state ? "Stop Counter-Trend Runs" : "Start Counter-Trend Runs";
    btnToggleAutoFlip.classList.toggle('stream-active', state);
    FLIP_INPUT_IDS.forEach(id => { const el = pkEl(id); if (el) el.disabled = state; });
    if (state) {
        flipEnsureCandle();             // the cache key (market + timeframe + time bucket) refetches only when needed
        const c = flipRun.cfg;
        logToConsole(`[Counter-Trend Runs] Started (${c.bias === 'WITH' ? 'with the move' : 'counter-trend: buying the opposite run'}): $${c.stake.toFixed(2)} stake, ${c.ticks} ticks (${c.lossTicks} in recovery), ${FLIP_TF_LABEL[c.gran] || c.gran + 's'} candles, TP ${c.tp > 0 ? '$' + c.tp.toFixed(2) : 'off'}, SL ${c.sl > 0 ? '$' + c.sl.toFixed(2) : 'off'}. Waiting for the candle and ticks to agree...`, "success-msg");
    } else {
        flipOpen = false;
        clearTimeout(flipWatchdog);
        logToConsole("[Counter-Trend Runs] Stopped." + (flipActive.size ? " Any trade already open will still settle." : ""));
    }
    flipRender();
}

async function flipCheckPayout() {
    if (!pkWsOpen()) { logToConsole("Error: Real-time stream must be connected before checking a payout.", "error-msg"); return; }
    const cfg = flipReadConfig();
    if (cfg.error) { logToConsole(`[Counter-Trend Runs] ${cfg.error}`, "error-msg"); return; }
    const symbol = marketDropdown.value;
    setButtonLoading(btnQuoteFlip, true, 'Checking...');
    try {
        const types = ['RUNHIGH', 'RUNLOW'];
        const res = await Promise.all(types.map(t => brfProposal(t, cfg.stake, cfg.ticks, symbol)));
        const bad = res.findIndex(r => !r || !r.proposal);
        if (bad !== -1) {
            const msg = (res[bad] && res[bad].error && res[bad].error.message) || 'no quote returned';
            pkSetText('flip-quote', `Deriv rejected the ${bad === 0 ? 'Only Ups' : 'Only Downs'} quote: ${msg}`, 'error-msg');
            return;
        }
        const q = res.map((r, i) => {
            const ask = parseFloat(r.proposal.ask_price) || cfg.stake, payout = parseFloat(r.proposal.payout) || 0;
            return { name: i === 0 ? 'Only Ups' : 'Only Downs', ask, payout, pct: ask > 0 ? (payout - ask) / ask * 100 : 0 };
        });
        const breakEven = q[0].payout > 0 ? q[0].ask / q[0].payout * 100 : 0;
        const fair = Math.pow(0.5, cfg.ticks) * 100;
        pkSetText('flip-quote', `${q.map(x => `${x.name} pays $${x.payout.toFixed(2)} (+${x.pct.toFixed(0)}%)`).join(' | ')}. Break-even needs ${breakEven.toFixed(1)}% wins; a clean ${cfg.ticks}-tick run is ~${fair.toFixed(1)}% likely on a random walk.`, 'system-msg');
        logToConsole(`[Counter-Trend Runs] Payout check (${cfg.ticks} ticks, $${cfg.stake.toFixed(2)}): ${q.map(x => `${x.name} $${x.payout.toFixed(2)}`).join(' | ')}.`, "system-msg");
    } finally {
        setButtonLoading(btnQuoteFlip, false);
    }
}

function flipRender() {
    if (!pkEl('flip-status')) return;
    const running = !!(isAutoTradingFlip && flipRun);
    const cfg = running ? flipRun.cfg : flipReadConfig();
    const run = flipRun;
    const open = pkWsOpen(), locked = isTradingLocked();
    pkSetHint('flip-hint', open, locked);
    const sig = flipSignal(cfg);
    const tf = FLIP_TF_LABEL[cfg.gran] || `${cfg.gran}s`;

    let status, cls = 'system-msg';
    if (!open) status = 'OFFLINE - connect the stream';
    else if (running && flipOpen) status = 'TRADE OPEN - waiting for it to settle';
    else if (running) { status = run.force ? `RUNNING - next trade is a forced flip to ${flipDirName(run.force)}` : 'RUNNING - waiting for the candle and ticks to agree'; cls = 'success-msg'; }
    else if (flipStopReason) { status = `STOPPED - ${flipStopReason}`; cls = 'error-msg'; }
    else { status = 'READY'; cls = 'success-msg'; }
    pkSetText('flip-status', status, cls);

    const rec = running && run.recovery;
    pkSetChip('flip-chip-mode', rec ? 'MODE: RECOVERY' : 'MODE: NORMAL', rec ? 'warn' : 'ok');
    if (running && run.force) pkSetChip('flip-chip-signal', `SIGNAL: FORCED ${run.force === 'UP' ? 'UPS' : 'DOWNS'}`, 'warn');
    else if (sig.dir) pkSetChip('flip-chip-signal', `SIGNAL: ${sig.dir === 'UP' ? 'ONLY UPS' : 'ONLY DOWNS'}${cfg.bias === 'WITH' ? '' : ' (FADE)'}`, 'ok');
    else if (sig.wait) pkSetChip('flip-chip-signal', 'SIGNAL: SYNCING', 'warn');
    else pkSetChip('flip-chip-signal', 'SIGNAL: NONE', '');
    if (!open) pkSetChip('flip-chip-entry', 'ENTRY: STREAM OFFLINE', 'bad');
    else if (locked) pkSetChip('flip-chip-entry', 'ENTRY: LOCKED (SESSION)', 'bad');
    else if (running && flipOpen) pkSetChip('flip-chip-entry', 'ENTRY: TRADE OPEN', 'warn');
    else if (running) pkSetChip('flip-chip-entry', (run.force || sig.dir) ? 'ENTRY: READY ON NEXT TICK' : 'ENTRY: WAITING FOR SIGNAL', (run.force || sig.dir) ? 'ok' : 'warn');
    else pkSetChip('flip-chip-entry', 'ENTRY: READY', 'ok');

    if (flipCandle && flipCandleKey === flipCandleKeyNow(cfg.gran)) {
        const c = flipCandle;
        const arrow = c.close > c.open ? '\u25B2 bullish' : c.close < c.open ? '\u25BC bearish' : '\u2194 flat';
        pkSetText('flip-candle', `${tf} candle ${arrow} | open ${flipPrice(c.open)} close ${flipPrice(c.close)} | body ${sig.bodyPct !== undefined ? sig.bodyPct.toFixed(0) : '--'}%`,
            c.close > c.open ? 'success-msg' : c.close < c.open ? 'error-msg' : 'system-msg');
    } else {
        pkSetText('flip-candle', open ? `Loading the last closed ${tf} candle...` : '--', 'system-msg');
    }
    if (flipLastQuote === null) pkSetText('flip-tick', '--', 'system-msg');
    else if (flipTickDir === 0) pkSetText('flip-tick', 'Last tick unchanged - no direction yet', 'system-msg');
    else pkSetText('flip-tick', `${flipTickDir > 0 ? '\u25B2 rising' : '\u25BC falling'} x${flipTickRun} (needs ${cfg.tickConfirm})`, flipTickDir > 0 ? 'success-msg' : 'error-msg');

    const stakeNow = running ? run.stake : cfg.stake, ticksNow = running ? run.ticks : cfg.ticks;
    pkSetText('flip-next', `${running && run.force ? flipDirName(run.force) + ' (flip)' : 'signal-driven'} | $${stakeNow.toFixed(2)} | ${ticksNow} ticks`, 'system-msg');
    pkSetText('flip-wl', `${flipStats.w} / ${flipStats.l}${run ? ` (this run: ${run.wins} / ${run.losses}, loss streak ${run.lossStreak})` : ''}`, 'system-msg');
    const net = run ? run.net : 0;
    pkSetText('flip-net', `${run ? 'This run ' + pkMoney(net) + ' | ' : ''}All time ${pkMoney(flipStats.net)}`, flipStats.net > 0 ? 'success-msg' : flipStats.net < 0 ? 'error-msg' : 'system-msg');
}

// ---------------------------------------------------------------------
// EVEN/ODD MARTINGALE  (Digit Even / Odd with a recovery ladder and hard limits)
// ---------------------------------------------------------------------
const btnToggleAutoBeast = pkEl('btn-toggle-auto-beast');
const btnBuyBeast = pkEl('btn-buy-beast');
const btnQuoteBeast = pkEl('btn-quote-beast');
const btnResetBeast = pkEl('btn-reset-beast');
const BEAST_INPUT_IDS = ['beast-side', 'beast-stake', 'beast-ticks', 'beast-mode', 'beast-mult', 'beast-cap-on', 'beast-max-stake',
    'beast-cap-action', 'beast-tp', 'beast-sl', 'beast-max-losses', 'beast-max-trades', 'beast-wait-digits', 'beast-gap'];

let isAutoTradingBeast = false;
let beastRun = null;
let beastRunId = 0;
let beastOpen = false;
let beastWatchdog = null;
let beastStopReason = '';
let beastErrorsInRow = 0;
let beastGapRemaining = 0;
let beastRatio = 0.95;              // profit per $1 staked on a win; replaced by Deriv's real quote / the last win
let beastDigits = [];
let beastStats = { w: 0, l: 0, net: 0 };
const beastPendingTokens = new Map();
const beastActive = new Map();

function beastReadConfig() {
    const cfg = {
        side: (pkEl('beast-side') || {}).value === 'ODD' ? 'ODD' : 'EVEN',
        stake: pkRound2(pkNum('beast-stake', 1)),
        ticks: pkClamp(Math.round(pkNum('beast-ticks', 1)), 1, 10),
        mode: (pkEl('beast-mode') || {}).value === 'SMART' ? 'SMART' : 'MULT',
        mult: Math.max(1, pkNum('beast-mult', 1.5)),
        capOn: !!(pkEl('beast-cap-on') && pkEl('beast-cap-on').checked),
        maxStake: Math.max(0, pkNum('beast-max-stake', 0)),
        capAction: (pkEl('beast-cap-action') || {}).value || 'reset',
        tp: Math.max(0, pkNum('beast-tp', 0)),
        sl: Math.max(0, pkNum('beast-sl', 0)),
        maxLosses: Math.max(0, Math.round(pkNum('beast-max-losses', 0))),
        maxTrades: Math.max(0, Math.round(pkNum('beast-max-trades', 0))),
        waitDigits: pkClamp(Math.round(pkNum('beast-wait-digits', 0)), 0, 10),
        gap: pkClamp(Math.round(pkNum('beast-gap', 0)), 0, 60)
    };
    cfg.type = cfg.side === 'EVEN' ? 'DIGITEVEN' : 'DIGITODD';
    if (!(cfg.stake >= 0.35)) cfg.error = 'Base stake must be at least $0.35.';
    else if (cfg.capOn && !(cfg.maxStake >= cfg.stake)) cfg.error = 'Max stake must be at least your base stake.';
    return cfg;
}

function beastOnTick(digit) {
    beastDigits.push(digit);
    if (beastDigits.length > 12) beastDigits.shift();
}

// Optional entry filter: for Even wait for N Odd digits in a row first (and the reverse for Odd).
function beastTriggerMet(cfg) {
    if (cfg.waitDigits <= 0) return true;
    if (beastDigits.length < cfg.waitDigits) return false;
    const want = cfg.side === 'EVEN' ? 1 : 0;
    return beastDigits.slice(-cfg.waitDigits).every(d => d % 2 === want);
}

function handleBeastTick() {
    if (!isAutoTradingBeast || beastOpen || !beastRun) return;
    if (beastGapRemaining > 0) { beastGapRemaining--; return; }
    if (!beastTriggerMet(beastRun.cfg)) return;
    beastFire(true);
}

function beastFire(auto) {
    if (isTradingLocked()) { logToConsole(tradingLockMessage(), "error-msg"); return false; }
    if (!pkWsOpen()) { logToConsole("Error: Real-time stream must be connected before running trades.", "error-msg"); return false; }
    if (!marketDropdown.value) { logToConsole("[Even/Odd Martingale] Pick a market first.", "error-msg"); return false; }
    let cfg, stake;
    if (auto) { cfg = beastRun.cfg; stake = beastRun.stake; }
    else {
        cfg = beastReadConfig();
        if (cfg.error) { logToConsole(`[Even/Odd Martingale] ${cfg.error}`, "error-msg"); return false; }
        stake = cfg.stake;
    }
    const token = pkBuy('PBEAST_', auto, cfg.type, stake, cfg.ticks);
    beastPendingTokens.set(token, auto ? beastRunId : null);
    if (auto) {
        beastOpen = true;
        beastDigits = [];               // a fresh trigger is needed for the next entry
        clearTimeout(beastWatchdog);
        const runId = beastRunId;
        beastWatchdog = setTimeout(() => {
            if (beastOpen && runId === beastRunId) {
                beastOpen = false;
                logToConsole("[Even/Odd Martingale] The trade didn't report back in time - releasing it.", "error-msg");
                beastRender();
            }
        }, cfg.ticks * 3000 + 25000);
    }
    logToConsole(`[Even/Odd Martingale] ${auto ? 'Auto' : 'Manual'}: Digit ${cfg.side === 'EVEN' ? 'Even' : 'Odd'}, $${stake.toFixed(2)}, ${cfg.ticks} tick${cfg.ticks > 1 ? 's' : ''}${auto && beastRun.lossStreak ? ` (loss streak ${beastRun.lossStreak})` : ''}.`, "success-msg");
    beastRender();
    return true;
}

function beastOnReceipt(contractId, token) {
    const runId = beastPendingTokens.get(token);
    beastPendingTokens.delete(token);
    beastActive.set(contractId, { auto: token.startsWith('PBEAST_A_'), token, runId: runId === undefined ? null : runId });
    beastErrorsInRow = 0;
}

function beastHandleBuyError(incoming) {
    const token = incoming.echo_req.passthrough.bulkRunId;
    delete challengeBatchExpectedCounts[token];
    const runId = beastPendingTokens.get(token);
    beastPendingTokens.delete(token);
    if (token.startsWith('PBEAST_A_') && runId === beastRunId && isAutoTradingBeast) {
        beastOpen = false;
        beastErrorsInRow++;
        if (beastErrorsInRow >= 3) beastStop(`Deriv rejected ${beastErrorsInRow} buys in a row (${incoming.error.message})`);
    }
    beastRender();
}

// Smart recovery: the next win must repay every loss in the streak AND earn one base-stake profit.
function beastNextStake(run, cfg) {
    if (cfg.mode === 'SMART') return pkCeil2(run.lossTotal / beastRatio + cfg.stake);
    return pkRound2(cfg.stake * Math.pow(cfg.mult, run.lossStreak));
}

function beastOnSettled(contract) {
    const info = beastActive.get(contract.contract_id);
    if (!info) return;
    beastActive.delete(contract.contract_id);
    const profit = parseFloat(contract.profit);
    const p = Number.isFinite(profit) ? profit : 0;
    const won = contract.status === 'won';
    const buy = parseFloat(contract.buy_price);
    beastStats.net += p;
    if (won) beastStats.w++; else beastStats.l++;
    if (won && p > 0 && buy > 0) beastRatio = pkClamp(p / buy, 0.05, 20);

    const live = info.auto && info.runId === beastRunId && isAutoTradingBeast && beastRun;
    if (!live) { beastRender(); return; }

    clearTimeout(beastWatchdog);
    beastOpen = false;
    const run = beastRun, cfg = run.cfg;
    run.net += p;
    run.trades++;
    beastGapRemaining = cfg.gap;
    if (won) {
        run.wins++; run.lossStreak = 0; run.lossTotal = 0; run.stake = cfg.stake;
    } else {
        run.losses++; run.lossStreak++; run.lossTotal += Math.abs(p) || (buy > 0 ? buy : run.stake);
    }

    if (cfg.tp > 0 && run.net >= cfg.tp) return beastStop(`take-profit hit (${pkMoney(run.net)})`);
    if (cfg.sl > 0 && run.net <= -cfg.sl) return beastStop(`stop-loss hit (${pkMoney(run.net)})`);
    if (!won) {
        if (cfg.maxLosses > 0 && run.lossStreak >= cfg.maxLosses) return beastStop(`${run.lossStreak} losses in a row`);
        let next = beastNextStake(run, cfg);
        if (cfg.capOn && cfg.maxStake > 0 && next > cfg.maxStake) {
            if (cfg.capAction === 'stop') return beastStop(`next stake $${next.toFixed(2)} would pass your $${cfg.maxStake.toFixed(2)} cap`);
            logToConsole(`[Even/Odd Martingale] Next stake $${next.toFixed(2)} would pass the $${cfg.maxStake.toFixed(2)} cap - back to the base stake.`, "system-msg");
            next = cfg.stake;
            run.lossTotal = 0;          // the recovery ladder starts over
        }
        run.stake = next;
    }
    if (cfg.maxTrades > 0 && run.trades >= cfg.maxTrades) return beastStop(`max trades reached (${run.trades}/${cfg.maxTrades})`);
    logToConsole(`[Even/Odd Martingale] ${won ? 'Won' : 'Lost'} ${pkMoney(p)} | run ${pkMoney(run.net)} | next stake $${run.stake.toFixed(2)}.`, won ? "success-msg" : "error-msg");
    beastRender();
}

function beastStop(reason) {
    beastStopReason = reason;
    logToConsole(`[Even/Odd Martingale] Auto-mode stopped - ${reason}.`, "system-msg");
    toggleAutoBeast(false);
}

function toggleAutoBeast(state) {
    if (!btnToggleAutoBeast) return;
    if (!state && !isAutoTradingBeast) return;
    if (state) {
        if (isAutoTradingBeast) return;
        if (isTradingLocked()) { logToConsole(tradingLockMessage(), "error-msg"); return; }
        if (!pkWsOpen()) { logToConsole("Error: Real-time stream must be connected before running trades.", "error-msg"); return; }
        if (!marketDropdown.value) { logToConsole("[Even/Odd Martingale] Pick a market first.", "error-msg"); return; }
        const cfg = beastReadConfig();
        if (cfg.error) { logToConsole(`[Even/Odd Martingale] ${cfg.error}`, "error-msg"); return; }
        pkEl('beast-ticks').value = cfg.ticks;
        beastRunId++;
        beastRun = { cfg, net: 0, trades: 0, wins: 0, losses: 0, lossStreak: 0, lossTotal: 0, stake: cfg.stake };
        beastOpen = false;
        beastErrorsInRow = 0;
        beastGapRemaining = 0;
        beastStopReason = '';
        beastDigits = [];
        clearTimeout(beastWatchdog);
        if (cfg.mode === 'SMART') beastLearnRatio(cfg);
    }
    isAutoTradingBeast = state;
    btnToggleAutoBeast.textContent = state ? "Stop Even/Odd Martingale" : "Start Even/Odd Martingale";
    btnToggleAutoBeast.classList.toggle('stream-active', state);
    BEAST_INPUT_IDS.forEach(id => { const el = pkEl(id); if (el) el.disabled = state; });
    if (state) {
        const c = beastRun.cfg;
        logToConsole(`[Even/Odd Martingale] Started: Digit ${c.side === 'EVEN' ? 'Even' : 'Odd'}, $${c.stake.toFixed(2)} base stake, ${c.ticks} tick${c.ticks > 1 ? 's' : ''}, ${c.mode === 'SMART' ? 'smart recovery' : c.mult + 'x multiplier'}, cap ${c.capOn ? '$' + c.maxStake.toFixed(2) : 'off'}, TP ${c.tp > 0 ? '$' + c.tp.toFixed(2) : 'off'}, SL ${c.sl > 0 ? '$' + c.sl.toFixed(2) : 'off'}.`, "success-msg");
    } else {
        beastOpen = false;
        clearTimeout(beastWatchdog);
        logToConsole("[Even/Odd Martingale] Stopped." + (beastActive.size ? " Any trade already open will still settle." : ""));
    }
    beastRender();
}

// Reads Deriv's real payout ratio so Smart recovery sizes the first recovery stake correctly.
async function beastLearnRatio(cfg) {
    try {
        const r = await brfProposal(cfg.type, cfg.stake, cfg.ticks, marketDropdown.value);
        if (r && r.proposal) {
            const ask = parseFloat(r.proposal.ask_price), pay = parseFloat(r.proposal.payout);
            if (ask > 0 && pay > ask) beastRatio = pkClamp((pay - ask) / ask, 0.05, 20);
        }
    } catch (e) { /* keep the previous ratio */ }
}

async function beastCheckPayout() {
    if (!pkWsOpen()) { logToConsole("Error: Real-time stream must be connected before checking a payout.", "error-msg"); return; }
    const cfg = beastReadConfig();
    if (cfg.error) { logToConsole(`[Even/Odd Martingale] ${cfg.error}`, "error-msg"); return; }
    setButtonLoading(btnQuoteBeast, true, 'Checking...');
    try {
        const r = await brfProposal(cfg.type, cfg.stake, cfg.ticks, marketDropdown.value);
        if (!r || !r.proposal) {
            pkSetText('beast-quote', `Deriv rejected the quote: ${(r && r.error && r.error.message) || 'no quote returned'}`, 'error-msg');
            return;
        }
        const ask = parseFloat(r.proposal.ask_price) || cfg.stake, pay = parseFloat(r.proposal.payout) || 0;
        const ratio = ask > 0 ? (pay - ask) / ask : 0;
        if (ratio > 0) beastRatio = pkClamp(ratio, 0.05, 20);
        const be = pay > 0 ? ask / pay * 100 : 0;
        // After n losses a flat-multiplier ladder only repays everything if the multiplier is at least 1 + 1/ratio
        const need = ratio > 0 ? 1 + 1 / ratio : 0;
        pkSetText('beast-quote', `Digit ${cfg.side === 'EVEN' ? 'Even' : 'Odd'} pays $${pay.toFixed(2)} on $${ask.toFixed(2)} (+${(ratio * 100).toFixed(1)}%). Break-even needs ${be.toFixed(1)}% wins vs 50% chance. A multiplier below ${need.toFixed(2)}x can't fully repay a losing streak; Smart recovery sizes it exactly.`, 'system-msg');
        logToConsole(`[Even/Odd Martingale] Payout check: $${pay.toFixed(2)} on $${ask.toFixed(2)} stake (+${(ratio * 100).toFixed(1)}%).`, "system-msg");
    } finally {
        setButtonLoading(btnQuoteBeast, false);
    }
}

function beastRender() {
    if (!pkEl('beast-status')) return;
    const running = !!(isAutoTradingBeast && beastRun);
    const cfg = running ? beastRun.cfg : beastReadConfig();
    const run = beastRun;
    const open = pkWsOpen(), locked = isTradingLocked();
    pkSetHint('beast-hint', open, locked);

    let status, cls = 'system-msg';
    if (!open) status = 'OFFLINE - connect the stream';
    else if (running && beastOpen) status = 'TRADE OPEN - waiting for it to settle';
    else if (running && beastGapRemaining > 0) { status = `RUNNING - skipping ${beastGapRemaining} tick${beastGapRemaining > 1 ? 's' : ''} before the next trade`; cls = 'success-msg'; }
    else if (running) { status = cfg.waitDigits > 0 ? `RUNNING - waiting for ${cfg.waitDigits} ${cfg.side === 'EVEN' ? 'odd' : 'even'} digit${cfg.waitDigits > 1 ? 's' : ''} in a row` : 'RUNNING - buying on the next tick'; cls = 'success-msg'; }
    else if (beastStopReason) { status = `STOPPED - ${beastStopReason}`; cls = 'error-msg'; }
    else { status = 'READY'; cls = 'success-msg'; }
    pkSetText('beast-status', status, cls);

    pkSetChip('beast-chip-mode', cfg.mode === 'SMART' ? 'RECOVERY: SMART (LIVE PAYOUT)' : `RECOVERY: ${cfg.mult}x MULTIPLIER`, 'ok');
    const stakeNow = running ? run.stake : cfg.stake;
    pkSetChip('beast-chip-stake', `STAKE: $${stakeNow.toFixed(2)}${cfg.capOn ? ` / CAP $${cfg.maxStake.toFixed(2)}` : ' / NO CAP'}`, running && run.lossStreak ? 'warn' : 'ok');
    if (!open) pkSetChip('beast-chip-entry', 'ENTRY: STREAM OFFLINE', 'bad');
    else if (locked) pkSetChip('beast-chip-entry', 'ENTRY: LOCKED (SESSION)', 'bad');
    else if (running && beastOpen) pkSetChip('beast-chip-entry', 'ENTRY: TRADE OPEN', 'warn');
    else if (running) pkSetChip('beast-chip-entry', beastGapRemaining > 0 || !beastTriggerMet(cfg) ? 'ENTRY: WAITING' : 'ENTRY: READY ON NEXT TICK', beastGapRemaining > 0 || !beastTriggerMet(cfg) ? 'warn' : 'ok');
    else pkSetChip('beast-chip-entry', 'ENTRY: READY', 'ok');

    const digitsEl = pkEl('beast-digits');
    if (digitsEl) digitsEl.textContent = beastDigits.length ? beastDigits.slice(-12).map(d => `${d}${d % 2 === 0 ? 'e' : 'o'}`).join(' ') : '--';
    pkSetText('beast-streak', running ? `${run.lossStreak} loss${run.lossStreak === 1 ? '' : 'es'} in a row (${pkMoney(-run.lossTotal)} to recover)` : '0', 'system-msg');
    pkSetText('beast-next', `Digit ${cfg.side === 'EVEN' ? 'Even' : 'Odd'} | $${stakeNow.toFixed(2)} | ${cfg.ticks} tick${cfg.ticks > 1 ? 's' : ''}`, 'system-msg');
    pkSetText('beast-wl', `${beastStats.w} / ${beastStats.l}${run ? ` (this run: ${run.wins} / ${run.losses})` : ''}`, 'system-msg');
    pkSetText('beast-net', `${run ? 'This run ' + pkMoney(run.net) + ' | ' : ''}All time ${pkMoney(beastStats.net)}`, beastStats.net > 0 ? 'success-msg' : beastStats.net < 0 ? 'error-msg' : 'system-msg');
}

// ---------------------------------------------------------------------
// Shared hooks + wiring
// ---------------------------------------------------------------------
function pkOnTick(price, epoch, digit) {
    flipOnTick(price, epoch);
    beastOnTick(digit);
    gdOnTick(price, digit);
}
function pkOnSymbolChange() {
    flipLastQuote = null; flipTickDir = 0; flipTickRun = 0;
    flipCandle = null; flipCandleKey = null; flipCandleRetryAt = 0;
    beastDigits = [];
    gdDigits = []; gdPrices = [];
}
function pkRenderOnTick() {
    if (isAutoTradingFlip || activeTabId === 'tab-run-flip') flipRender();
    if (isAutoTradingBeast || activeTabId === 'tab-parity-beast') beastRender();
}

if (btnToggleAutoFlip) btnToggleAutoFlip.addEventListener('click', pkSafe('Counter-Trend Runs', () => toggleAutoFlip(!isAutoTradingFlip)));
if (btnBuyFlipUp) btnBuyFlipUp.addEventListener('click', pkSafe('Counter-Trend Runs', () => flipFire('UP', false, 'manual buy')));
if (btnBuyFlipDown) btnBuyFlipDown.addEventListener('click', pkSafe('Counter-Trend Runs', () => flipFire('DOWN', false, 'manual buy')));
if (btnQuoteFlip) btnQuoteFlip.addEventListener('click', pkSafe('Counter-Trend Runs', () => flipCheckPayout()));
if (btnResetFlip) btnResetFlip.addEventListener('click', () => {
    flipStats = { w: 0, l: 0, net: 0 };
    flipStopReason = '';
    if (!isAutoTradingFlip) flipRun = null;
    pkSetText('flip-quote', 'Not checked yet', 'system-msg');
    logToConsole("[Counter-Trend Runs] Stats reset.");
    flipRender();
});
if (btnToggleAutoBeast) btnToggleAutoBeast.addEventListener('click', pkSafe('Even/Odd Martingale', () => toggleAutoBeast(!isAutoTradingBeast)));
if (btnBuyBeast) btnBuyBeast.addEventListener('click', pkSafe('Even/Odd Martingale', () => beastFire(false)));
if (btnQuoteBeast) btnQuoteBeast.addEventListener('click', pkSafe('Even/Odd Martingale', () => beastCheckPayout()));
if (btnResetBeast) btnResetBeast.addEventListener('click', () => {
    beastStats = { w: 0, l: 0, net: 0 };
    beastStopReason = '';
    if (!isAutoTradingBeast) beastRun = null;
    pkSetText('beast-quote', 'Not checked yet', 'system-msg');
    logToConsole("[Even/Odd Martingale] Stats reset.");
    beastRender();
});
FLIP_INPUT_IDS.forEach(id => { const el = pkEl(id); if (el) el.addEventListener('change', () => { if (id === 'flip-candle-tf') flipEnsureCandle(); flipRender(); }); });
BEAST_INPUT_IDS.forEach(id => { const el = pkEl(id); if (el) el.addEventListener('change', beastRender); });
// Refresh the panel (and the lock hint) the instant its tab is opened.
document.querySelectorAll('.tab-btn[data-target="tab-run-flip"]').forEach(b => b.addEventListener('click', () => flipRender()));
document.querySelectorAll('.tab-btn[data-target="tab-parity-beast"]').forEach(b => b.addEventListener('click', () => beastRender()));
flipRender();
beastRender();
// Keep the panels fresh (stream state, session lock) while one of these tabs is open.
setInterval(() => { if (activeTabId === 'tab-run-flip') flipRender(); if (activeTabId === 'tab-parity-beast') beastRender(); }, 1000);


// =====================================================================
// GEMINI GUIDE  (advisory only - it NEVER places a trade)
// Adds a "Gemini Guide" card to Bulk Over/Under, Pattern Over/Under (Over 2 / Under 7), Over 1 / Under 8 and
// Bulk Rise/Fall. It watches the live ticks, sends a compact statistical summary to Google's Gemini API when
// you ask (or every N seconds if you switch auto-refresh on), and Gemini answers with the entry to wait for.
// The app then watches every tick by itself and flashes "ENTRY NOW" the moment that entry appears, so Gemini is
// only called occasionally, not on every tick. Your API key lives in this browser (localStorage) and is sent
// only to Google.
// =====================================================================
const GD_STORE = 'geminiGuideSettings_v1';
const GD_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
const GD_DEFAULTS = { key: '', model: 'gemini-3.8-flash', beep: true, everySec: 60 };
const GD_CFG = (() => {
    try { return Object.assign({}, GD_DEFAULTS, JSON.parse(localStorage.getItem(GD_STORE) || '{}')); }
    catch (e) { return Object.assign({}, GD_DEFAULTS); }
})();
function gdSaveCfg() { try { localStorage.setItem(GD_STORE, JSON.stringify(GD_CFG)); } catch (e) { /* ignore */ } }

const GD_MAX = 1000;
let gdDigits = [];
let gdPrices = [];
let gdCalls = 0;
const GD_STATE = {};

const GD_MODES = ['ANY_ORDER', 'SEQUENCE', 'PAIR_EITHER_ORDER', 'SAME_TWICE', 'PRICE_RUN'];

// What each guided tab does, what Gemini may suggest, and how an entry is judged afterwards.
const GD_ADAPTERS = {
    OU: {
        label: 'Bulk Over/Under', anchor: 'btn-buy-ou', kind: 'digit', fixed: null,
        duration: () => Math.max(1, parseInt(tradeDurationOU.value, 10) || 1),
        describe() {
            const po = parseInt(predOverInput.value, 10), pu = parseInt(predUnderInput.value, 10);
            return `Bulk Over/Under buys a batch of PAIRS on one tick: an OVER ${po} contract plus an UNDER ${pu} contract, `
                + `duration ${this.duration()} tick(s). The OVER leg wins when the final digit is greater than ${po}, the UNDER leg wins when it is less than ${pu}; `
                + `both win when the digit lands strictly between them. Its optional "pattern trigger" waits until the last TWO digits are each one of the two prediction digits {${po}, ${pu}}. `
                + `The same tab also has a Bulk Over panel: it waits for a trigger digit (single mode: the last digit equals it; double mode: two chosen digits back-to-back in either order) and then buys several OVER contracts with a barrier you choose. `
                + `Current settings: OVER ${po}, UNDER ${pu}.`;
        },
        ask: `Recommend up to 2 entries.
Entry 1 (name "Pair trigger"): the two prediction digits for the pair. Return side "PAIR", over = the OVER prediction (0-8), under = the UNDER prediction (1-9), mode "ANY_ORDER", count 2, digits = [over, under]. how_to_set must say: set OVER to X and UNDER to Y and tick the pattern trigger.
Entry 2 (name "Bulk Over trigger"): a trigger digit (or two digits) for the Bulk Over panel. Return side "OVER", barrier = the OVER barrier (0-8), and either mode "ANY_ORDER" with count 1 and digits [d] (single digit), or mode "PAIR_EITHER_ORDER" with count 2 and digits [a, b] (double mode). how_to_set must say which mode and digit(s) and which barrier to enter.
Only include an entry if the statistics give a reason; otherwise say WAIT with an empty entries list.`
    },
    POU: {
        label: 'Pattern Over/Under (Over 2 / Under 7)', anchor: 'btn-toggle-auto-pou', kind: 'digit',
        duration: () => Math.max(1, parseInt(tradeDurationPOU.value, 10) || 1),
        describe() {
            return `Pattern Over/Under watches for two fixed digit patterns and then buys one contract: `
                + `the digits 2 and 0 back-to-back in either order -> OVER 2 (wins when the final digit is > 2); `
                + `the digits 7 and 9 back-to-back in either order -> UNDER 7 (wins when the final digit is < 7). Duration ${this.duration()} tick(s).`;
        },
        fixed: [
            { id: 'OVER2', name: 'Over 2 (2 and 0 back-to-back)', side: 'OVER', barrier: 2, mode: 'PAIR_EITHER_ORDER', digits: [2, 0], count: 2, base: 0.7 },
            { id: 'UNDER7', name: 'Under 7 (7 and 9 back-to-back)', side: 'UNDER', barrier: 7, mode: 'PAIR_EITHER_ORDER', digits: [7, 9], count: 2, base: 0.7 }
        ]
    },
    PO18: {
        label: 'Over 1 / Under 8', anchor: 'btn-toggle-auto-po18', kind: 'digit',
        duration: () => Math.max(1, parseInt(tradeDurationPO18.value, 10) || 1),
        describe() {
            return `Over 1 / Under 8 watches for the SAME digit twice in a row and then buys one contract: `
                + `0,0 or 1,1 -> OVER 1 (wins when the final digit is > 1); 8,8 or 9,9 -> UNDER 8 (wins when the final digit is < 8). Duration ${this.duration()} tick(s).`;
        },
        fixed: [
            { id: 'OVER1', name: 'Over 1 (0,0 or 1,1)', side: 'OVER', barrier: 1, mode: 'SAME_TWICE', digits: [0, 1], count: 2, base: 0.8 },
            { id: 'UNDER8', name: 'Under 8 (8,8 or 9,9)', side: 'UNDER', barrier: 8, mode: 'SAME_TWICE', digits: [8, 9], count: 2, base: 0.8 }
        ]
    },
    BRF: {
        label: 'Bulk Rise/Fall', anchor: 'btn-buy-brf', kind: 'price', fixed: null,
        duration: () => Math.max(1, parseInt(tradeDurationBRF.value, 10) || 2),
        describe() {
            const side = (document.getElementById('brf-side-select') || {}).value || 'BOTH';
            return `Bulk Rise/Fall buys Rise and/or Fall contracts (currently: ${side}) with a duration of ${this.duration()} ticks, intended for Step Index markets where every tick moves up or down by one fixed step. `
                + `A Rise contract wins when the exit price is above the entry price, a Fall contract when it is below.`;
        },
        ask: `Recommend up to 2 entries. Use side "RISE" or "FALL" (or "BOTH" only if you see no directional lean), mode "PRICE_RUN", dir "UP" or "DOWN", and count = how many consecutive ticks in that direction must have just happened before entering (1-5). 
how_to_set must say which contract side to run (Rise only / Fall only / Both) and what to wait for. If there is no usable pattern say WAIT with an empty entries list.`
    }
};

function gdOnTick(price, digit) {
    if (!Number.isInteger(digit)) return;
    gdDigits.push(digit); gdPrices.push(Number(price));
    if (gdDigits.length > GD_MAX) { gdDigits.shift(); gdPrices.shift(); }
    gdCheckAlerts();
}

// ---- trigger evaluation ----
function gdHitAt(e, ds, ps, i) {
    const n = e.count || 1;
    switch (e.mode) {
        case 'ANY_ORDER':
            if (i - n + 1 < 0) return false;
            for (let k = 0; k < n; k++) if (!e.digits.includes(ds[i - k])) return false;
            return true;
        case 'SEQUENCE': {
            const L = e.digits.length;
            if (i - L + 1 < 0) return false;
            for (let k = 0; k < L; k++) if (ds[i - L + 1 + k] !== e.digits[k]) return false;
            return true;
        }
        case 'PAIR_EITHER_ORDER':
            return i >= 1 && ((ds[i - 1] === e.digits[0] && ds[i] === e.digits[1]) || (ds[i - 1] === e.digits[1] && ds[i] === e.digits[0]));
        case 'SAME_TWICE':
            return i >= 1 && ds[i] === ds[i - 1] && e.digits.includes(ds[i]);
        case 'PRICE_RUN':
            if (i - n < 0) return false;
            for (let k = 0; k < n; k++) {
                const up = ps[i - k] > ps[i - k - 1], down = ps[i - k] < ps[i - k - 1];
                if (e.dir === 'DOWN' ? !down : !up) return false;
            }
            return true;
    }
    return false;
}
function gdTriggerText(e) {
    const d = e.digits.join(', ');
    switch (e.mode) {
        case 'ANY_ORDER': return e.count === 1 ? `the last digit is ${d}` : `the last ${e.count} digits are each one of {${d}}`;
        case 'SEQUENCE': return `the last digits are ${e.digits.join(' then ')}`;
        case 'PAIR_EITHER_ORDER': return `${e.digits[0]} and ${e.digits[1]} back-to-back (either order)`;
        case 'SAME_TWICE': return `the same digit twice in a row, ${e.digits.join(' or ')}`;
        case 'PRICE_RUN': return `${e.count} ${e.dir === 'DOWN' ? 'falling' : 'rising'} tick${e.count > 1 ? 's' : ''} in a row`;
    }
    return '';
}
function gdContractText(e) {
    if (e.side === 'PAIR') return `Over ${e.over} + Under ${e.under}`;
    if (e.side === 'OVER' || e.side === 'UNDER') return `${e.side === 'OVER' ? 'Over' : 'Under'} ${e.barrier}`;
    return e.side === 'RISE' ? 'Rise' : e.side === 'FALL' ? 'Fall' : 'Rise + Fall';
}

// How this exact entry would have done on the ticks we hold (a check on what Gemini claims).
function gdTrack(e, ds, ps, D) {
    const N = ds.length;
    const judge = (i) => {
        if (e.side === 'OVER') return ds[i + D] > e.barrier;
        if (e.side === 'UNDER') return ds[i + D] < e.barrier;
        if (e.side === 'PAIR') return (ds[i + D] > e.over) && (ds[i + D] < e.under);   // both legs win
        if (e.side === 'RISE') return ps[i + D] > ps[i];
        if (e.side === 'FALL') return ps[i + D] < ps[i];
        return null;
    };
    if (judge(Math.max(1, 0)) === null && e.side !== 'PAIR') return null;
    let n = 0, w = 0, bn = 0, bw = 0;
    for (let i = 1; i + D < N; i++) {
        bn++; if (judge(i)) bw++;
    }
    for (let i = 1; i + D < N; i++) {
        if (!gdHitAt(e, ds, ps, i)) continue;
        n++; if (judge(i)) w++;
        i += D;
    }
    return { n, rate: n ? w / n : null, base: bn ? bw / bn : null, pair: e.side === 'PAIR' };
}
function gdPct(v) { return v === null || v === undefined ? 'n/a' : `${(v * 100).toFixed(0)}%`; }

// ---- statistics sent to Gemini ----
function gdFreq(ds) { const f = Array(10).fill(0); ds.forEach(d => f[d]++); return f; }
function gdDigitStats(ds) {
    const last300 = ds.slice(-300), last100 = ds.slice(-100);
    const trans = Array.from({ length: 10 }, () => Array(10).fill(0));
    for (let i = 1; i < last300.length; i++) trans[last300[i - 1]][last300[i]]++;
    const follow = trans.map((row, d) => {
        const tot = row.reduce((a, b) => a + b, 0);
        const top = row.map((c, nxt) => [nxt, c]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => `${x[0]}(${x[1]})`).join(' ');
        return `after ${d} (${tot}x): ${top}`;
    });
    let run = 1; for (let i = ds.length - 1; i > 0 && ds[i] === ds[i - 1]; i--) run++;
    const parityRun = (() => { let r = 1; for (let i = ds.length - 1; i > 0 && ds[i] % 2 === ds[i - 1] % 2; i--) r++; return `${r} ${ds[ds.length - 1] % 2 === 0 ? 'even' : 'odd'}`; })();
    return {
        ticks: ds.length, last40: ds.slice(-40).join(' '),
        freq300: gdFreq(last300).join(' '), freq100: gdFreq(last100).join(' '),
        followers: follow.join('\n'), sameDigitRun: run, parityRun,
        expected300: (last300.length / 10).toFixed(1), sd300: Math.sqrt(last300.length * 0.1 * 0.9).toFixed(1)
    };
}
function gdPriceStats(ps) {
    const dirs = []; for (let i = 1; i < ps.length; i++) dirs.push(ps[i] > ps[i - 1] ? 'U' : ps[i] < ps[i - 1] ? 'D' : '-');
    const recent = dirs.slice(-400);
    const cont = (ch) => [1, 2, 3, 4].map(k => {
        let n = 0, same = 0;
        for (let i = k; i < recent.length; i++) {
            let all = true; for (let j = 1; j <= k; j++) if (recent[i - j] !== ch) { all = false; break; }
            if (!all) continue; n++; if (recent[i] === ch) same++;
        }
        return `after ${k} ${ch === 'U' ? 'up' : 'down'}: next tick continues ${n ? Math.round(same / n * 100) : 'n/a'}% (n=${n})`;
    });
    let run = 0, ch = dirs[dirs.length - 1]; for (let i = dirs.length - 1; i >= 0 && dirs[i] === ch; i--) run++;
    const ups = recent.filter(x => x === 'U').length, downs = recent.filter(x => x === 'D').length;
    return { ticks: ps.length, last80: dirs.slice(-80).join(''), ups, downs, currentRun: `${run} ${ch === 'U' ? 'up' : ch === 'D' ? 'down' : 'flat'}`, cont: cont('U').concat(cont('D')).join('\n') };
}

const GD_SYSTEM = `You are a cautious assistant that reads statistics from recent ticks of Deriv synthetic indices and tells a trader what entry to wait for in a specific strategy.
Rules you must follow:
- Digits and tick directions on these indices come from a random number generator. You cannot predict the next digit. You only point out recent patterns and say whether a trigger looks favourable or not.
- Use ONLY the statistics provided. Differences from the expected value that are within about two standard deviations are normal randomness: when that is all you see, say WAIT or AVOID and give a LOW confidence. Never invent numbers.
- Never exaggerate. Confidence above 70 requires a clear, large deviation that the "track record" data also supports.
- Keep "advice" to at most two short sentences and always name the exact digit(s) or tick pattern to enter on.
- Reply with ONE JSON object only, no markdown, matching exactly this shape:
{"verdict":"ENTER_SOON"|"WAIT"|"AVOID","confidence":0-100,"advice":"...","risks":"one short sentence","entries":[ ... ]}
Each entry: {"id":"...","name":"...","side":"OVER"|"UNDER"|"PAIR"|"RISE"|"FALL"|"BOTH","barrier":number|null,"over":number|null,"under":number|null,"mode":"ANY_ORDER"|"SEQUENCE"|"PAIR_EITHER_ORDER"|"SAME_TWICE"|"PRICE_RUN","digits":[0-9 ints],"count":1-5,"dir":"UP"|"DOWN"|null,"how_to_set":"short instruction"}`;

function gdBuildPrompt(id) {
    const A = GD_ADAPTERS[id];
    const sym = marketDropdown.value || 'unknown';
    const D = A.duration();
    let out = `STRATEGY: ${A.label}\n${A.describe()}\nMARKET: ${sym}\n\n`;
    if (A.kind === 'digit') {
        const s = gdDigitStats(gdDigits);
        out += `LAST DIGITS DATA (${s.ticks} ticks held, newest last):\nlast 40 digits: ${s.last40}\ndigit counts 0..9 over last 300: ${s.freq300} (expected about ${s.expected300} each, one standard deviation about ${s.sd300})\ndigit counts 0..9 over last 100: ${s.freq100}\ncurrent run of the same digit: ${s.sameDigitRun}; current parity run: ${s.parityRun}\nmost common next digits (last 300 ticks):\n${s.followers}\n\n`;
    } else {
        const s = gdPriceStats(gdPrices);
        out += `TICK DIRECTION DATA (${s.ticks} ticks held, U = up, D = down, newest last):\nlast 80 ticks: ${s.last80}\nover the last 400 ticks: ${s.ups} up, ${s.downs} down; current run: ${s.currentRun}\ncontinuation statistics:\n${s.cont}\n\n`;
    }
    if (A.fixed) {
        out += `ALLOWED ENTRIES (choose only from these ids; return the ids you recommend arming now; return an empty list if none look favourable). Track record = how that exact entry did on the ticks held:\n`;
        A.fixed.forEach(e => {
            const t = gdTrack(e, gdDigits, gdPrices, D);
            out += `- id ${e.id}: ${e.name}; wins if final digit ${e.side === 'OVER' ? '>' : '<'} ${e.barrier}; normal win rate ${gdPct(e.base)}; track record: ${t && t.n ? `${gdPct(t.rate)} over ${t.n} signals` : 'no signals yet'}\n`;
        });
        out += `\nFor each recommended entry return {"id": "<one of the ids>", "how_to_set": "..."}; other fields may be omitted.`;
    } else {
        out += `TASK:\n${A.ask}`;
    }
    return out;
}

// ---- reading Gemini's answer safely ----
function gdIntList(v, lo, hi) { return Array.isArray(v) ? [...new Set(v.map(x => Math.round(Number(x))).filter(x => Number.isFinite(x) && x >= lo && x <= hi))].slice(0, 10) : []; }
function gdParseAdvice(text, A) {
    let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const s = t.indexOf('{'), e = t.lastIndexOf('}');
    if (s < 0 || e < s) throw new Error('Gemini did not return a JSON answer');
    const raw = JSON.parse(t.slice(s, e + 1));
    const verdict = ['ENTER_SOON', 'WAIT', 'AVOID'].includes(raw.verdict) ? raw.verdict : 'WAIT';
    const entries = [];
    (Array.isArray(raw.entries) ? raw.entries : []).slice(0, 3).forEach(r => {
        if (!r || typeof r !== 'object') return;
        if (A.fixed) {
            const f = A.fixed.find(x => x.id === r.id);
            if (f && !entries.some(x => x.id === f.id)) entries.push(Object.assign({}, f, { how_to_set: String(r.how_to_set || '').slice(0, 200) }));
            return;
        }
        if (!GD_MODES.includes(r.mode)) return;
        const side = ['OVER', 'UNDER', 'PAIR', 'RISE', 'FALL', 'BOTH'].includes(r.side) ? r.side : null;
        if (!side) return;
        const e2 = { id: String(r.id || r.name || 'entry').slice(0, 30), name: String(r.name || 'Entry').slice(0, 60), side, mode: r.mode,
            digits: gdIntList(r.digits, 0, 9), count: Math.min(5, Math.max(1, Math.round(Number(r.count)) || 1)), dir: r.dir === 'DOWN' ? 'DOWN' : 'UP',
            barrier: Math.min(9, Math.max(0, Math.round(Number(r.barrier)))), over: Math.min(8, Math.max(0, Math.round(Number(r.over)))), under: Math.min(9, Math.max(1, Math.round(Number(r.under)))),
            how_to_set: String(r.how_to_set || '').slice(0, 200) };
        if (A.kind === 'digit' && r.mode === 'PRICE_RUN') return;
        if (A.kind === 'price' && r.mode !== 'PRICE_RUN') return;
        if (r.mode === 'PAIR_EITHER_ORDER' && e2.digits.length < 2) return;
        if (r.mode !== 'PRICE_RUN' && !e2.digits.length) return;
        if (e2.side === 'PAIR' && !(Number.isFinite(e2.over) && Number.isFinite(e2.under))) return;
        entries.push(e2);
    });
    return { verdict, confidence: Math.min(100, Math.max(0, Math.round(Number(raw.confidence)) || 0)),
        advice: String(raw.advice || '').slice(0, 400), risks: String(raw.risks || '').slice(0, 250), entries };
}

// A key is plain visible ASCII. If it holds "..." / spaces / line breaks the browser refuses to send it at all.
function gdKeyProblem(k) {
    if (!k) return 'Paste your Gemini API key first.';
    if (/[^\x21-\x7E]/.test(k)) return 'The key you pasted contains a space, a line break or a symbol such as "\u2026" that cannot be part of a key. This usually means the shortened text shown on screen was copied. In AI Studio tap the copy icon next to the key, then paste again.';
    if (k.length < 25) return 'That key looks too short. Copy the whole key with the copy icon in AI Studio and paste it again.';
    return '';
}

async function gdPost(url, headers, body) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 45000);
    try { return await fetch(url, { method: 'POST', signal: ctl.signal, headers, body }); }
    finally { clearTimeout(timer); }
}

// Tells "no route to Google" apart from "the browser blocked this particular request".
async function gdDiagnose(err) {
    const why = err && err.message ? err.message : String(err);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Your device is offline - check the internet connection and try again.';
    let reachable = false;
    try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
        await fetch('https://generativelanguage.googleapis.com/', { mode: 'no-cors', cache: 'no-store', signal: ctl.signal });
        clearTimeout(t); reachable = true;
    } catch (e) { /* not reachable */ }
    if (!reachable) return 'This browser cannot reach Google\'s Gemini service (generativelanguage.googleapis.com) at all. Check mobile data / Wi-Fi, switch network, and turn off any VPN, Private DNS, data-saver or ad-blocker. Tip: open https://generativelanguage.googleapis.com in a new tab - if that does not load, your network is blocking it.';
    return `Google's Gemini service is reachable, but the browser blocked the request itself (browser says: "${why}"). Open the app in a normal Chrome tab (not an in-app browser) and turn off extensions / ad-blockers for this page. If it still fails, send this message to your developer.`;
}

async function gdCallGemini(prompt) {
    const problem = gdKeyProblem(GD_CFG.key);
    if (problem) throw new Error(problem);
    const model = encodeURIComponent(GD_CFG.model || GD_DEFAULTS.model);
    const base = `${GD_ENDPOINT}${model}:generateContent`;
    const withKey = `${base}?key=${encodeURIComponent(GD_CFG.key)}`;
    const body = JSON.stringify({
        systemInstruction: { parts: [{ text: GD_SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
    });
    // Three ways of sending the same request. The first that the browser lets through is remembered for next time.
    const modes = {
        header: () => gdPost(base, { 'Content-Type': 'application/json', 'x-goog-api-key': GD_CFG.key }, body),
        query: () => gdPost(withKey, { 'Content-Type': 'application/json' }, body),
        plain: () => gdPost(withKey, { 'Content-Type': 'text/plain;charset=UTF-8' }, body)     // a "simple" request: no CORS pre-check
    };
    const first = modes[GD_CFG.authMode] ? GD_CFG.authMode : 'header';
    const order = [first].concat(['header', 'query', 'plain'].filter(m => m !== first));
    let res = null, lastErr = null;
    for (const m of order) {
        try { res = await modes[m](); if (GD_CFG.authMode !== m) { GD_CFG.authMode = m; gdSaveCfg(); } break; }
        catch (e) {
            if (e && e.name === 'AbortError') throw new Error('Gemini took too long to answer (45 s).');
            lastErr = e;                      // the browser refused to send it - try the next way
        }
    }
    if (!res) throw new Error(await gdDiagnose(lastErr));
    let data = null;
    try { data = await res.json(); } catch (e) { /* not JSON */ }
    if (!res.ok) {
        const msg = (data && data.error && data.error.message) ? data.error.message : `HTTP ${res.status}`;
        if (res.status === 400 && /api key/i.test(msg)) throw new Error('Google says the API key is not valid. Make sure you copied the whole key.');
        if (res.status === 401) throw new Error(`Google did not accept the key (${msg}).`);
        if (res.status === 403) throw new Error(`Google refused the request (${msg}).`);
        if (res.status === 404) throw new Error(`Model "${GD_CFG.model}" was not found - check the model name.`);
        if (res.status === 429) throw new Error('Gemini rate limit reached - wait a minute or lengthen the auto-refresh time.');
        throw new Error(`Gemini error: ${msg}`);
    }
    const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const text = (parts || []).filter(p => p && typeof p.text === 'string' && !p.thought).map(p => p.text).join('');
    if (!text) {
        const why = data && data.promptFeedback && data.promptFeedback.blockReason;
        throw new Error(why ? `Gemini blocked the request (${why}).` : 'Gemini returned an empty answer.');
    }
    return text;
}

async function gdAsk(id) {
    const S = GD_STATE[id], A = GD_ADAPTERS[id];
    if (!S || S.busy) return;
    if (!GD_CFG.key) { S.msg = 'Paste your Gemini API key above first.'; gdRender(id); return; }
    S.busy = true; S.msg = 'Reading the market and asking Gemini...'; gdRender(id);
    try {
        if (gdDigits.length < 150 && typeof hgGetHistory === 'function' && optionsWebSocket && optionsWebSocket.readyState === WebSocket.OPEN) {
            const hist = await hgGetHistory(marketDropdown.value, 500);      // warm up from recent history instead of waiting
            if (hist && hist.prices && hist.prices.length >= 100) {
                const ps = hist.prices.map(Number), ds = hgDigitsOf(hist.prices);
                gdPrices = ps.slice(-GD_MAX); gdDigits = ds.slice(-GD_MAX);
            }
        }
        if (gdDigits.length < 100) throw new Error(`Only ${gdDigits.length} ticks collected - connect the stream and wait a little (100 needed).`);
        const prompt = gdBuildPrompt(id);
        gdCalls++;
        const text = await gdCallGemini(prompt);
        const adv = gdParseAdvice(text, A);
        adv.at = Date.now(); adv.symbol = marketDropdown.value; adv.D = A.duration();
        adv.entries.forEach(e => { e.track = gdTrack(e, gdDigits, gdPrices, adv.D); });
        S.advice = adv; S.lastAskAt = Date.now(); S.hits = 0; S.lastHit = '';
        S.msg = '';
        logToConsole(`[Gemini Guide] ${A.label}: ${adv.verdict} (${adv.confidence}%) - ${adv.advice}`, adv.verdict === 'AVOID' ? 'error-msg' : 'success-msg');
    } catch (e) {
        S.msg = e.message; S.lastAskAt = Date.now();
        logToConsole(`[Gemini Guide] ${A.label}: ${e.message}`, 'error-msg');
    }
    S.busy = false;
    gdRender(id);
}

// ---- watching: runs on every tick, cheap ----
function gdBeep() {
    try {
        const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
        const ctx = new C(), o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.12;
        o.start(); o.stop(ctx.currentTime + 0.18);
    } catch (e) { /* ignore */ }
}
function gdCheckAlerts() {
    const i = gdDigits.length - 1;
    if (i < 1) return;
    const now = Date.now();
    for (const id in GD_STATE) {
        const S = GD_STATE[id], adv = S.advice;
        if (!adv || adv.verdict === 'AVOID' || adv.symbol !== marketDropdown.value) continue;
        for (const e of adv.entries) {
            if (!gdHitAt(e, gdDigits, gdPrices, i)) continue;
            if (e.lastAlert && now - e.lastAlert < 4000) continue;
            e.lastAlert = now; e.hitAt = now;
            S.hits = (S.hits || 0) + 1;
            S.lastHit = `${e.name} @ ${new Date().toLocaleTimeString()}`;
            logToConsole(`[Gemini Guide] ENTRY NOW - ${GD_ADAPTERS[id].label}: ${e.name} (${gdTriggerText(e)}).`, 'success-msg');
            if (GD_CFG.beep) gdBeep();
        }
    }
}

// ---- card ----
function gdEsc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function gdRender(id) {
    const S = GD_STATE[id], A = GD_ADAPTERS[id];
    if (!S || !S.root) return;
    const q = sel => S.root.querySelector(sel) || { style: {}, classList: { toggle() {} } };
    const open = optionsWebSocket && optionsWebSocket.readyState === WebSocket.OPEN;
    const adv = S.advice;
    const stale = !!(adv && adv.symbol !== marketDropdown.value);
    q('.gd-ask').disabled = !!S.busy || !GD_CFG.key;
    q('.gd-calls').textContent = `Gemini calls this session: ${gdCalls}`;
    q('.gd-status').textContent = S.msg || (stale ? 'The market changed since this advice - ask again.' : (adv ? '' : (GD_CFG.key ? (open ? 'Press "Ask Gemini now".' : 'Connect and stream digits first, then ask.') : 'Paste your Gemini API key to begin.')));

    // watcher
    const recent = gdDigits.slice(-12);
    const marked = new Set(); (adv && !stale ? adv.entries : []).forEach(e => (e.digits || []).forEach(d => marked.add(d)));
    q('.gd-digits').innerHTML = A.kind === 'digit'
        ? (recent.length ? recent.map(d => marked.has(d) ? `<span class="success-msg">${d}</span>` : `<span>${d}</span>`).join(' ') : '-- --')
        : (() => { const ps = gdPrices.slice(-11), out = []; for (let j = 1; j < ps.length; j++) out.push(ps[j] > ps[j - 1] ? '<span class="success-msg">&#9650;</span>' : ps[j] < ps[j - 1] ? '<span class="error-msg">&#9660;</span>' : '<span>&bull;</span>'); return out.length ? out.join(' ') : '-- --'; })();
    q('.gd-last').textContent = S.lastHit ? `${S.lastHit}${S.hits ? ` (${S.hits}x)` : ''}` : 'None';

    // verdict + entries
    const box = q('.gd-result');
    if (!adv) { box.innerHTML = ''; return; }
    const col = adv.verdict === 'ENTER_SOON' ? 'var(--accent-green)' : adv.verdict === 'AVOID' ? 'var(--accent-red)' : 'var(--text-secondary)';
    const label = adv.verdict === 'ENTER_SOON' ? 'ENTER SOON' : adv.verdict;
    const nowHit = (e) => e.hitAt && Date.now() - e.hitAt < 6000;
    const rows = adv.entries.map(e => {
        const t = e.track;
        const rec = t ? (t.n ? `Track record on the last ${gdDigits.length} ticks: ${gdPct(t.rate)}${t.pair ? ' (both legs win)' : ''} over ${t.n} signals vs ${gdPct(t.base)} normally.` : 'This trigger has not appeared in the ticks held, so there is no track record.') : '';
        return `<div style="border:1px solid ${nowHit(e) && !stale ? 'var(--accent-green)' : 'var(--border-color)'}; border-radius:6px; padding:8px; margin-top:6px;${nowHit(e) && !stale ? ' background: rgba(0,200,120,0.12);' : ''}">`
            + `<div style="font-weight:600;">${nowHit(e) && !stale ? '&#9889; ENTRY NOW - ' : ''}${gdEsc(e.name)} <span style="font-weight:400; opacity:0.8;">(${gdEsc(gdContractText(e))})</span></div>`
            + `<div>Enter when: <strong>${gdEsc(gdTriggerText(e))}</strong></div>`
            + (e.how_to_set ? `<div>${gdEsc(e.how_to_set)}</div>` : '')
            + (rec ? `<div style="color:var(--text-secondary); font-size:0.78rem;">${gdEsc(rec)}</div>` : '')
            + `</div>`;
    }).join('');
    box.innerHTML = `<div style="margin-top:8px;"><span style="font-weight:700; color:${col};">${gdEsc(label)}</span> <span style="opacity:0.8;">- confidence ${adv.confidence}%</span> <span style="opacity:0.6; font-size:0.75rem;">(asked ${new Date(adv.at).toLocaleTimeString()})</span></div>`
        + `<div style="margin-top:4px;">${gdEsc(adv.advice)}</div>`
        + (adv.risks ? `<div style="margin-top:4px; color:var(--text-secondary); font-size:0.8rem;">Risk: ${gdEsc(adv.risks)}</div>` : '')
        + (rows || '<div style="margin-top:6px; color:var(--text-secondary);">No entry recommended right now.</div>');
}

function gdSyncSettings() {
    Object.keys(GD_STATE).forEach(id => {
        const r = GD_STATE[id].root;
        const k = r.querySelector('.gd-key'), m = r.querySelector('.gd-model'), b = r.querySelector('.gd-beep'), a = r.querySelector('.gd-auto'), s = r.querySelector('.gd-every');
        if (k && k.value !== GD_CFG.key) k.value = GD_CFG.key;
        if (m && m.value !== GD_CFG.model) m.value = GD_CFG.model;
        if (b) b.checked = !!GD_CFG.beep;
        if (s && String(s.value) !== String(GD_CFG.everySec)) s.value = GD_CFG.everySec;
        if (a) a.checked = !!GD_STATE[id].auto;
    });
}

function gdMount(id) {
    const A = GD_ADAPTERS[id];
    const btn = document.getElementById(A.anchor);
    if (!btn || !btn.parentElement) return;
    const root = document.createElement('div');
    root.className = 'gd-card';
    root.style.cssText = 'border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-top: 14px;';
    root.innerHTML = `
        <div style="font-weight: 600;">Gemini Guide <span style="font-weight: 400; font-size: 0.78rem; color: var(--text-secondary);">(advice only - it never trades)</span></div>
        <p style="font-size: 0.78rem; color: var(--text-secondary); margin: 4px 0 8px 0;">
            Gemini reads the last ticks and tells you which entry to wait for. The app then watches every tick and flashes
            ENTRY NOW when it appears. Digits are random, so treat this as a second opinion, not a prediction.
        </p>
        <div class="form-row">
            <div class="form-group"><label>Gemini API key:</label><input type="password" class="gd-key" placeholder="paste your key" autocomplete="off"></div>
            <div class="form-group"><label>Model:</label><input type="text" class="gd-model"></div>
        </div>
        <div style="display:flex; gap:10px; margin-top:8px; align-items:center; flex-wrap:wrap;">
            <button class="btn-secondary gd-ask" style="flex:1; min-width:150px;">Ask Gemini now</button>
            <label style="margin:0; display:flex; gap:6px; align-items:center; font-size:0.8rem;"><input type="checkbox" class="gd-auto" style="width:auto;"> auto-refresh every</label>
            <input type="number" class="gd-every" min="30" max="600" step="10" style="width:70px;"><span style="font-size:0.8rem;">s</span>
            <label style="margin:0; display:flex; gap:6px; align-items:center; font-size:0.8rem;"><input type="checkbox" class="gd-beep" style="width:auto;"> beep on entry</label>
        </div>
        <p class="gd-status" style="font-size: 0.8rem; margin: 8px 0 0 0;"></p>
        <div class="gd-result" style="font-size: 0.85rem;"></div>
        <div class="balance-display" style="padding: 10px 12px; font-size: 0.85rem; justify-content: space-between; flex-wrap: wrap; gap: 6px 18px; margin-top: 8px;">
            <span>Watching: <strong class="gd-digits">-- --</strong></span>
            <span>Last entry alert: <strong class="gd-last system-msg">None</strong></span>
        </div>
        <div class="gd-calls" style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 6px;"></div>`;
    btn.parentElement.parentElement.insertBefore(root, btn.parentElement);
    const S = GD_STATE[id] = { root, advice: null, msg: '', busy: false, auto: false, lastAskAt: 0, hits: 0, lastHit: '' };
    const on = (sel, ev, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener(ev, fn); };
    on('.gd-key', 'change', () => { GD_CFG.key = root.querySelector('.gd-key').value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim(); gdSaveCfg(); gdSyncSettings(); Object.keys(GD_STATE).forEach(gdRender); });
    on('.gd-model', 'change', () => { GD_CFG.model = root.querySelector('.gd-model').value.trim() || GD_DEFAULTS.model; gdSaveCfg(); gdSyncSettings(); });
    on('.gd-beep', 'change', () => { GD_CFG.beep = root.querySelector('.gd-beep').checked; gdSaveCfg(); gdSyncSettings(); });
    on('.gd-every', 'change', () => { GD_CFG.everySec = Math.min(600, Math.max(30, Math.round(Number(root.querySelector('.gd-every').value) || 60))); gdSaveCfg(); gdSyncSettings(); });
    on('.gd-auto', 'change', () => { S.auto = root.querySelector('.gd-auto').checked; if (S.auto && !GD_CFG.key) { S.auto = false; S.msg = 'Paste your Gemini API key first.'; } gdSyncSettings(); gdRender(id); });
    on('.gd-ask', 'click', pkSafe('Gemini Guide', () => gdAsk(id)));
    gdSyncSettings();
    gdRender(id);
}

function gdTimer() {
    const now = Date.now();
    Object.keys(GD_STATE).forEach(id => {
        const S = GD_STATE[id];
        if (S.auto && !S.busy && GD_CFG.key && gdDigits.length >= 100 && now - S.lastAskAt >= GD_CFG.everySec * 1000) gdAsk(id);
        else gdRender(id);
    });
}

Object.keys(GD_ADAPTERS).forEach(gdMount);
setInterval(pkSafe('Gemini Guide', gdTimer), 1000);
