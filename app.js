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
    { digits: [1, 2], contract_type: 'DIGITOVER', barrier: '2', label: 'Over 2 (1\u2194 2 pattern)' },
    { digits: [7, 8], contract_type: 'DIGITUNDER', barrier: '7', label: 'Under 7 (7\u2194 8 pattern)' }
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
    if (isBulkOver2Armed) disarmBulkOver2();
    if (isAutoModeTN) toggleAutoTN(false);
    if (isEdgeRotationActive) stopEdgeRotation("Stopped - session TP/SL hit.");
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
    if (patternDigitHistoryDisplay) {
        patternDigitHistoryDisplay.textContent = recentDigitHistory.join(' ') || '--';
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
    btnBuyBulkOver2.disabled = !isReady;
    btnBuyOUD.disabled = !isReady;
    btnToggleAutoOUD.disabled = !isReady;
    if (!isReady) { toggleAutoEO(false); toggleAutoOU(false); toggleAutoPOU(false); toggleAutoOUD(false); if (isBulkOver2Armed) disarmBulkOver2(); }
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
