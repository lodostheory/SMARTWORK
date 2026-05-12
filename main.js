const STORAGE_KEY = 'traveltrack-expenses';

const CATEGORIES = {
  transport:     { label: 'Transport',     emoji: '✈️' },
  accommodation: { label: 'Accommodation', emoji: '🏨' },
  food:          { label: 'Food & Drink',  emoji: '🍽️' },
  entertainment: { label: 'Entertainment', emoji: '🎭' },
  shopping:      { label: 'Shopping',      emoji: '🛒' },
  health:        { label: 'Health',        emoji: '💊' },
  communication: { label: 'Communication', emoji: '📡' },
  other:         { label: 'Other',         emoji: '📦' },
};

let expenses = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function formatAmount(amount, currency) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function getFiltered() {
  const cat = document.getElementById('filter-cat').value;
  const sort = document.getElementById('sort-by').value;

  let result = cat ? expenses.filter(e => e.category === cat) : [...expenses];

  result.sort((a, b) => {
    switch (sort) {
      case 'date-asc':    return a.date.localeCompare(b.date);
      case 'date-desc':   return b.date.localeCompare(a.date);
      case 'amount-asc':  return a.amount - b.amount;
      case 'amount-desc': return b.amount - a.amount;
      default:            return 0;
    }
  });

  return result;
}

function renderExpenseList() {
  const list = document.getElementById('expense-list');
  const items = getFiltered();

  if (items.length === 0) {
    const msg = expenses.length === 0
      ? 'No expenses yet.<br>Add your first one!'
      : 'No expenses match the filter.';
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">🧾</span><p>${msg}</p></div>`;
    return;
  }

  list.innerHTML = items.map(e => {
    const cat = CATEGORIES[e.category] ?? CATEGORIES.other;
    return `
      <div class="expense-item" role="listitem" data-id="${e.id}">
        <div class="expense-cat-badge badge-${e.category}" aria-hidden="true">${cat.emoji}</div>
        <div class="expense-details">
          <span class="expense-desc">${escapeHtml(e.description)}</span>
          <span class="expense-meta">${cat.label} · ${formatDate(e.date)}</span>
        </div>
        <span class="expense-amount">${formatAmount(e.amount, e.currency)}</span>
        <button class="delete-btn" data-id="${e.id}" aria-label="Delete ${escapeHtml(e.description)}" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
  }).join('');
}

function renderStats() {
  const count = expenses.length;
  document.getElementById('stat-count').textContent = count;

  if (count === 0) {
    document.getElementById('stat-total').textContent = '—';
    document.getElementById('stat-top-category').textContent = '—';
    document.getElementById('stat-days').textContent = '0';
    return;
  }

  // Totals per currency
  const byCurrency = {};
  expenses.forEach(e => {
    byCurrency[e.currency] = (byCurrency[e.currency] ?? 0) + e.amount;
  });
  const currencies = Object.keys(byCurrency);
  const totalEl = document.getElementById('stat-total');
  const totalsText = currencies.map(c => formatAmount(byCurrency[c], c)).join(' + ');
  totalEl.textContent = totalsText;
  totalEl.style.fontSize = currencies.length > 1 ? '0.875rem' : '';

  // Top category by count
  const byCat = {};
  expenses.forEach(e => { byCat[e.category] = (byCat[e.category] ?? 0) + 1; });
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0][0];
  const cat = CATEGORIES[topCat] ?? CATEGORIES.other;
  document.getElementById('stat-top-category').textContent = `${cat.emoji} ${cat.label}`;

  // Unique days
  const days = new Set(expenses.map(e => e.date)).size;
  document.getElementById('stat-days').textContent = days;
}

function renderBreakdown() {
  const el = document.getElementById('breakdown');

  if (expenses.length === 0) {
    el.innerHTML = '<p class="muted-hint">Add expenses to see breakdown.</p>';
    return;
  }

  // Sum amounts per category per currency, track item count for bar width
  const byCat = {};
  expenses.forEach(e => {
    if (!byCat[e.category]) byCat[e.category] = { count: 0, totals: {} };
    byCat[e.category].count++;
    byCat[e.category].totals[e.currency] = (byCat[e.category].totals[e.currency] ?? 0) + e.amount;
  });

  const total = expenses.length;
  const sorted = Object.entries(byCat).sort((a, b) => b[1].count - a[1].count);

  el.innerHTML = sorted.map(([key, data]) => {
    const cat = CATEGORIES[key] ?? CATEGORIES.other;
    const pct = Math.round((data.count / total) * 100);
    const totalsStr = Object.entries(data.totals).map(([c, a]) => formatAmount(a, c)).join(', ');
    return `
      <div class="breakdown-item">
        <div class="breakdown-row">
          <span class="breakdown-label">
            <span class="cat-dot dot-${key}"></span>
            ${cat.emoji} ${cat.label}
          </span>
          <span class="breakdown-value">${totalsStr}</span>
        </div>
        <div class="breakdown-bar-bg">
          <div class="breakdown-bar bar-${key}" style="width: ${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

function render() {
  renderExpenseList();
  renderStats();
  renderBreakdown();
}

// ── Toast ──────────────────────────────────────────────────
let toastTimer;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2800);
}

// ── Confirm dialog ─────────────────────────────────────────
function showConfirm({ title, message, okLabel = 'Delete' }) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-ok').textContent = okLabel;
    overlay.classList.remove('hidden');

    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    function cleanup(result) {
      overlay.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    }

    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onOverlayClick = e => { if (e.target === overlay) cleanup(false); };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick, { once: true });
  });
}

// ── Form validation ────────────────────────────────────────
function validateForm() {
  const date = document.getElementById('exp-date');
  const desc = document.getElementById('exp-desc');
  const cat = document.getElementById('exp-category');
  const amount = document.getElementById('exp-amount');
  const errorEl = document.getElementById('form-error');

  [date, desc, cat, amount].forEach(el => el.classList.remove('invalid'));
  errorEl.textContent = '';

  if (!date.value) {
    date.classList.add('invalid');
    errorEl.textContent = 'Please select a date.';
    date.focus();
    return false;
  }
  if (!desc.value.trim()) {
    desc.classList.add('invalid');
    errorEl.textContent = 'Description is required.';
    desc.focus();
    return false;
  }
  if (!cat.value) {
    cat.classList.add('invalid');
    errorEl.textContent = 'Please select a category.';
    cat.focus();
    return false;
  }
  const amt = parseFloat(amount.value);
  if (!amount.value || isNaN(amt) || amt <= 0) {
    amount.classList.add('invalid');
    errorEl.textContent = 'Enter a valid amount greater than 0.';
    amount.focus();
    return false;
  }

  return true;
}

// ── Event: Add expense ──────────────────────────────────────
document.getElementById('expense-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!validateForm()) return;

  const expense = {
    id: crypto.randomUUID(),
    date: document.getElementById('exp-date').value,
    description: document.getElementById('exp-desc').value.trim(),
    category: document.getElementById('exp-category').value,
    amount: parseFloat(document.getElementById('exp-amount').value),
    currency: document.getElementById('exp-currency').value,
  };

  expenses.unshift(expense);
  save();
  render();

  e.target.reset();
  document.getElementById('exp-date').value = todayISO();
  document.getElementById('form-error').textContent = '';
  showToast('Expense added!');
});

// Clear validation state on input
['exp-date', 'exp-desc', 'exp-category', 'exp-amount'].forEach(id => {
  document.getElementById(id).addEventListener('input', function () {
    this.classList.remove('invalid');
    document.getElementById('form-error').textContent = '';
  });
});

// ── Event: Delete expense (delegation) ─────────────────────
document.getElementById('expense-list').addEventListener('click', async e => {
  const btn = e.target.closest('.delete-btn');
  if (!btn) return;
  const expense = expenses.find(ex => ex.id === btn.dataset.id);
  if (!expense) return;

  const ok = await showConfirm({
    title: 'Delete Expense',
    message: `Remove "${expense.description}"?`,
  });
  if (!ok) return;

  expenses = expenses.filter(ex => ex.id !== expense.id);
  save();
  render();
  showToast('Expense deleted.', 'info');
});

// ── Event: Clear all ────────────────────────────────────────
document.getElementById('clear-all-btn').addEventListener('click', async () => {
  if (expenses.length === 0) return;

  const ok = await showConfirm({
    title: 'Clear All Expenses',
    message: `Remove all ${expenses.length} expense${expenses.length !== 1 ? 's' : ''}? This cannot be undone.`,
    okLabel: 'Clear All',
  });
  if (!ok) return;

  expenses = [];
  save();
  render();
  showToast('All expenses cleared.', 'info');
});

// ── Event: Filter & sort ────────────────────────────────────
document.getElementById('filter-cat').addEventListener('change', renderExpenseList);
document.getElementById('sort-by').addEventListener('change', renderExpenseList);

// ── Init: expense tracker ──────────────────────────────────
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

document.getElementById('exp-date').value = todayISO();
render();

// ════════════════════════════════════════════════════════════
// 여비정산서 변환기
// ════════════════════════════════════════════════════════════

// ── Tab switching ───────────────────────────────────────────
const tabBtns = document.querySelectorAll('.tab-btn');
const views = { tracker: document.getElementById('view-tracker'), converter: document.getElementById('view-converter') };
const clearAllBtn = document.getElementById('clear-all-btn');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;
    tabBtns.forEach(b => { b.classList.toggle('active', b === btn); b.setAttribute('aria-selected', b === btn); });
    Object.entries(views).forEach(([key, el]) => el.classList.toggle('hidden', key !== target));
    clearAllBtn.classList.toggle('hidden', target !== 'tracker');
  });
});

// ── Converter state ─────────────────────────────────────────
let selectedFile = null;

const uploadArea = document.getElementById('upload-area');
const fileInput  = document.getElementById('xlsx-file');
const fileChip   = document.getElementById('file-chip');
const fileChipName = document.getElementById('file-chip-name');
const convertBtn = document.getElementById('convert-btn');
const convertError = document.getElementById('convert-error');
const convertResult = document.getElementById('convert-result');
const convertLoading = document.getElementById('convert-loading');

function setFile(file) {
  if (!file || !file.name.toLowerCase().endsWith('.xlsx')) {
    convertError.textContent = '.xlsx 파일만 업로드할 수 있습니다.';
    return;
  }
  selectedFile = file;
  fileChipName.textContent = file.name;
  fileChip.classList.remove('hidden');
  uploadArea.classList.add('hidden');
  convertBtn.disabled = false;
  convertError.textContent = '';
  convertResult.classList.add('hidden');
}

function clearFile() {
  selectedFile = null;
  fileInput.value = '';
  fileChip.classList.add('hidden');
  uploadArea.classList.remove('hidden');
  convertBtn.disabled = true;
  convertError.textContent = '';
  convertResult.classList.add('hidden');
}

// Click to open file dialog
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });

// File input change
fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });

// Drag & drop
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});

// Remove file
document.getElementById('remove-file-btn').addEventListener('click', clearFile);

// ── Submit: convert ─────────────────────────────────────────
document.getElementById('converter-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!selectedFile) { convertError.textContent = '파일을 선택해주세요.'; return; }

  const department = document.getElementById('dept-input').value.trim();
  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('department', department);

  convertLoading.classList.remove('hidden');
  convertError.textContent = '';
  convertResult.classList.add('hidden');

  try {
    const resp = await fetch('/api/convert', { method: 'POST', body: formData });

    if (!resp.ok) {
      let msg = '변환에 실패했습니다.';
      try { msg = (await resp.json()).error ?? msg; } catch { /* ignore */ }
      throw new Error(msg);
    }

    const count = resp.headers.get('X-Record-Count');
    const blob = await resp.blob();

    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '출장여비정산서_일괄.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);

    convertResult.className = 'convert-result success';
    convertResult.innerHTML = `✅ ${count ? `${count}건의` : ''} 여비정산서가 생성되어 다운로드되었습니다.`;
    convertResult.classList.remove('hidden');
    showToast(`${count ?? ''}건 변환 완료!`);
    clearFile();

  } catch (err) {
    const isNetwork = err instanceof TypeError;
    convertError.textContent = isNetwork
      ? '서버에 연결할 수 없습니다. python app.py 로 서버를 먼저 실행해주세요.'
      : err.message;
  } finally {
    convertLoading.classList.add('hidden');
  }
});
