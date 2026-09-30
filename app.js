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
    { digits: [2, 1], contract_type: 'DIGITOVER', barrier: '2', label: 'Over 2 (1\u2194 2 pattern)' },
    { digits: [9, 7], contract_type: 'DIGITUNDER', barrier: '7', label: 'Under 7 (7\u2194 8 pattern)' }
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
    if (isBulkOver2Armed) disarmBulkOver2();
    if (isAutoModeTN) toggleAutoTN(false);
    if (isEdgeRotationActive) stopEdgeRotation("Stopped - session TP/SL hit.");
    if (isAutoTradingHG) toggleAutoHG(false);
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

    updateRiseFallSignal(Number(tickData.quote));

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
        logToConsole(`Pattern Auto-Mode Started. Cap Target: ${maxTradesPOUInput.value} trades. Watching for 1/2 and 7/8 sequences...`, "success-msg");
    } else {
        logToConsole("Pattern Auto-Mode Stopped.");
    }
}

// --- PATTERN OVER 1 / UNDER 8 ---
// 0 & 1 back-to-back (either order) -> Over 1.   8 & 9 back-to-back (either order) -> Under 8.
const btnToggleAutoPO18 = document.getElementById('btn-toggle-auto-po18');
const tradeStakePO18 = document.getElementById('trade-stake-po18');
const tradeDurationPO18 = document.getElementById('trade-duration-po18');
const maxTradesPO18Input = document.getElementById('max-trades-po18');
const po18DigitHistoryDisplay = document.getElementById('po18-digit-history');
const po18LastMatchDisplay = document.getElementById('po18-last-match');

const DIGIT_PATTERNS_O1U8 = [
    { digits: [1, 0], contract_type: 'DIGITOVER', barrier: '1', label: 'Over 1 (0\u2194 1 pattern)' },
    { digits: [9, 8], contract_type: 'DIGITUNDER', barrier: '8', label: 'Under 8 (8\u2194 9 pattern)' }
];

function matchDigitPatternO1U8(history) {
    if (history.length < 2) return null;
    const [a, b] = history;
    return DIGIT_PATTERNS_O1U8.find(p =>
        (a === p.digits[0] && b === p.digits[1]) || (a === p.digits[0] && b === p.digits[1])
    ) || null;
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
        logToConsole(`Over 1 / Under 8 Auto-Mode Started. Cap Target: ${maxTradesPO18Input.value} trades. Watching for 0/1 and 8/9 sequences...`, "success-msg");
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

// --- indicator math (shared by tick mode and candle mode; both feed in a plain price array) ---
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

function computeRfSignal(prices) {
    const fast = sma(prices, RF_FAST_PERIOD);
    const slow = sma(prices, RF_SLOW_PERIOD);
    const rsiVal = rsi(prices, RF_RSI_PERIOD);
    if (fast === null || slow === null || rsiVal === null) {
        return { signal: 'WARMING_UP', fast, slow, rsi: rsiVal };
    }
    let signal = 'NEUTRAL';
    if (fast > slow && rsiVal >= 50) signal = 'RISE';
    else if (fast < slow && rsiVal <= 50) signal = 'FALL';
    return { signal, fast, slow, rsi: rsiVal };
}

// How many of the most recent bars (ticks or candle closes) keep moving the same way as
// `direction`. Used only to size the suggested trade duration - it is NOT part of the
// signal decision itself.
function computeRfPersistence(prices, direction) {
    let count = 0;
    for (let i = prices.length - 1; i > 0; i--) {
        const up = prices[i] > prices[i - 1];
        if ((direction === 'RISE' && up) || (direction === 'FALL' && !up)) count++; else break;
    }
    return count;
}

function currentRfMode() {
    return rfChartIntervalSelect ? rfChartIntervalSelect.value : 'ticks'; // 'ticks' or a granularity in seconds (string)
}

function currentRfPrices() {
    return currentRfMode() === 'ticks' ? rfPriceHistory : rfCandles.map(c => c.close);
}

// --- suggested duration: unit follows the chart timeframe, so "how many ticks" only ever
// appears when you're reading a tick chart, and "how many minutes" only when reading candles ---
function updateRfSuggestion(signal, prices) {
    if (signal !== 'RISE' && signal !== 'FALL') {
        if (rfSuggestionBanner) rfSuggestionBanner.style.display = 'none';
        return;
    }
    const persistence = computeRfPersistence(prices, signal);
    const mode = currentRfMode();
    let durationValue, unit, unitLabel;

    if (mode === 'ticks') {
        durationValue = Math.min(10, Math.max(5, persistence + 3));
        unit = 't';
        unitLabel = `${durationValue} tick${durationValue === 1 ? '' : 's'}`;
    } else {
        const granularityMinutes = Math.max(1, Math.round(parseInt(mode, 10) / 60));
        const candleHold = Math.min(10, Math.max(1, persistence));
        durationValue = Math.max(1, candleHold * granularityMinutes);
        unit = 'm';
        unitLabel = `${durationValue} minute${durationValue === 1 ? '' : 's'}`;
    }

    // Auto-fill the trade controls; the person can still override either field before buying.
    if (tradeDurationRF) tradeDurationRF.value = durationValue;
    if (tradeDurationUnitRF) tradeDurationUnitRF.value = unit;
    applyRfDurationUnitUI(unit);

    if (rfSuggestionBanner && rfSuggestionText) {
        rfSuggestionBanner.style.display = 'flex';
        rfSuggestionText.textContent = `${signal === 'RISE' ? 'Buy Rise' : 'Buy Fall'} \u2014 hold for ${unitLabel}`;
        rfSuggestionText.className = signal === 'RISE' ? 'success-msg' : 'error-msg';
    }
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
    const { signal, fast, slow, rsi: rsiVal } = computeRfSignal(prices);
    rfCurrentSignal = signal;

    const lastPrice = prices.length ? prices[prices.length - 1] : null;
    if (rfLastPriceDisplay) rfLastPriceDisplay.textContent = lastPrice !== null ? String(lastPrice) : '--';
    if (rfSmaFastDisplay) rfSmaFastDisplay.textContent = fast !== null ? fast.toFixed(4) : '--';
    if (rfSmaSlowDisplay) rfSmaSlowDisplay.textContent = slow !== null ? slow.toFixed(4) : '--';
    if (rfRsiDisplay) rfRsiDisplay.textContent = rsiVal !== null ? rsiVal.toFixed(1) : '--';

    if (rfSignalBadge) {
        if (signal === 'WARMING_UP') {
            rfSignalBadge.textContent = `Warming up\u2026 (${prices.length}/${RF_SLOW_PERIOD})`;
            rfSignalBadge.className = 'system-msg';
        } else if (signal === 'RISE') {
            rfSignalBadge.textContent = '\u2197 RISE';
            rfSignalBadge.className = 'success-msg';
        } else if (signal === 'FALL') {
            rfSignalBadge.textContent = '\u2198 FALL';
            rfSignalBadge.className = 'error-msg';
        } else {
            rfSignalBadge.textContent = '\u2194 NEUTRAL';
            rfSignalBadge.className = 'system-msg';
        }
    }

    updateRfSuggestion(signal, prices);
    drawRfChart(fast, slow);
}

// Called on every raw tick regardless of chart mode, so tick-mode data is always warm even
// while a candle timeframe is being displayed.
function updateRiseFallSignal(price) {
    if (!price || isNaN(price)) return;
    rfPriceHistory.push(price);
    if (rfPriceHistory.length > RF_MAX_POINTS) rfPriceHistory.shift();
    if (currentRfMode() === 'ticks') refreshRfIndicatorsAndSignal();
}

// --- candle subscription lifecycle ---
function maybeSetupRfCandles(symbolCode) {
    if (!optionsWebSocket || optionsWebSocket.readyState !== WebSocket.OPEN) return;
    const mode = currentRfMode();
    optionsWebSocket.send(JSON.stringify({ "forget_all": ["candles"] }));
    rfCandles = [];
    if (mode === 'ticks') return; // plain tick flow already covers this mode
    optionsWebSocket.send(JSON.stringify({
        "ticks_history": symbolCode,
        "end": "latest",
        "style": "candles",
        "granularity": parseInt(mode, 10),
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
    refreshRfIndicatorsAndSignal();
}

function handleRfOhlcUpdate(ohlc) {
    if (!ohlc) return;
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
    refreshRfIndicatorsAndSignal();
}

if (rfChartIntervalSelect) {
    rfChartIntervalSelect.addEventListener('change', () => {
        rfPriceHistory = [];
        maybeSetupRfCandles(marketDropdown.value);
        if (rfSignalBadge) { rfSignalBadge.textContent = "Warming up\u2026"; rfSignalBadge.className = "system-msg"; }
        if (rfSuggestionBanner) rfSuggestionBanner.style.display = 'none';
    });
}

// --- chart rendering ---
function drawRfChart(fastVal, slowVal) {
    if (!rfChartCtx || !rfChartCanvas) return;
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

    const pad = { top: 10, right: 10, bottom: 10, left: 10 };
    const w = cssWidth - pad.left - pad.right;
    const h = cssHeight - pad.top - pad.bottom;

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 3; g++) {
        const gy = pad.top + (h / 3) * g;
        ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(pad.left + w, gy); ctx.stroke();
    }

    const greenColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim() || '#1fd8a4';
    const redColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-red').trim() || '#f2455f';

    if (currentRfMode() === 'ticks') {
        const prices = rfPriceHistory;
        if (prices.length < 2) return;
        const min = Math.min(...prices), max = Math.max(...prices);
        const range = (max - min) || 1;
        const xFor = (i) => pad.left + (i / (prices.length - 1)) * w;
        const yFor = (v) => pad.top + h - ((v - min) / range) * h;
        const plotLine = (values, color, width) => {
            ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
            values.forEach((v, i) => {
                if (v === null || v === undefined) return;
                const x = xFor(i), y = yFor(v);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
        };
        const trendColor = prices[prices.length - 1] >= prices[0] ? greenColor : redColor;
        plotLine(prices, trendColor, 2);
        if (prices.length >= RF_FAST_PERIOD) {
            plotLine(prices.map((_, i) => i + 1 >= RF_FAST_PERIOD ? sma(prices.slice(0, i + 1), RF_FAST_PERIOD) : null), 'rgba(77, 141, 255, 0.85)', 1.5);
        }
        if (prices.length >= RF_SLOW_PERIOD) {
            plotLine(prices.map((_, i) => i + 1 >= RF_SLOW_PERIOD ? sma(prices.slice(0, i + 1), RF_SLOW_PERIOD) : null), 'rgba(255, 255, 255, 0.55)', 1.5);
        }
        const lastX = xFor(prices.length - 1), lastY = yFor(prices[prices.length - 1]);
        ctx.fillStyle = trendColor;
        ctx.beginPath(); ctx.arc(lastX, lastY, 3, 0, Math.PI * 2); ctx.fill();
        return;
    }

    // candle mode
    const candles = rfCandles;
    if (candles.length < 2) return;
    const closes = candles.map(c => c.close);
    const allLows = candles.map(c => c.low), allHighs = candles.map(c => c.high);
    const min = Math.min(...allLows), max = Math.max(...allHighs);
    const range = (max - min) || 1;
    const yFor = (v) => pad.top + h - ((v - min) / range) * h;
    const slotW = w / candles.length;
    const bodyW = Math.max(2, slotW * 0.6);

    candles.forEach((c, i) => {
        const xCenter = pad.left + slotW * (i + 0.5);
        const isUp = c.close >= c.open;
        const color = isUp ? greenColor : redColor;
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1;
        // wick
        ctx.beginPath(); ctx.moveTo(xCenter, yFor(c.high)); ctx.lineTo(xCenter, yFor(c.low)); ctx.stroke();
        // body
        const yOpen = yFor(c.open), yClose = yFor(c.close);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
        ctx.fillRect(xCenter - bodyW / 2, bodyTop, bodyW, bodyHeight);
    });

    const plotOverlay = (values, color) => {
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
        let started = false;
        values.forEach((v, i) => {
            if (v === null || v === undefined) return;
            const x = pad.left + slotW * (i + 0.5), y = yFor(v);
            if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        });
        ctx.stroke();
    };
    if (closes.length >= RF_FAST_PERIOD) {
        plotOverlay(closes.map((_, i) => i + 1 >= RF_FAST_PERIOD ? sma(closes.slice(0, i + 1), RF_FAST_PERIOD) : null), 'rgba(77, 141, 255, 0.85)');
    }
    if (closes.length >= RF_SLOW_PERIOD) {
        plotOverlay(closes.map((_, i) => i + 1 >= RF_SLOW_PERIOD ? sma(closes.slice(0, i + 1), RF_SLOW_PERIOD) : null), 'rgba(255, 255, 255, 0.55)');
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

    if (buyReceipt.balance_after) {
        balanceText.textContent = buyReceipt.balance_after.toLocaleString(undefined, { minimumFractionDigits: 2 });
    }

    if (emptyRow) emptyRow.remove();

    const isOver = buyReceipt.shortcode.includes("DIGITOVER") || buyReceipt.shortcode.includes("RUNHIGH");
    const isUnder = buyReceipt.shortcode.includes("DIGITUNDER") || buyReceipt.shortcode.includes("RUNLOW");
    const directionArrow = isOver 
        ? `<span style="color: var(--accent-green); font-weight: bold; font-size: 1.1rem;">↗</span>` 
        : isUnder
            ? `<span style="color: var(--accent-red); font-weight: bold; font-size: 1.1rem;">↘</span>`
            : `<span style="color: var(--text-secondary); font-weight: bold; font-size: 1.1rem;">→</span>`;

    const marketRaw = marketDropdown.value || "";
    const marketBadge = marketRaw.includes("10") ? "10s" : "100s"; 

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
    if (contract.exit_spot || contract.current_spot) {
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
    'btn-buy-bulk-over2',
    'btn-buy-tn', 'btn-toggle-auto-tn',
    'btn-toggle-edge-rotation'
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
