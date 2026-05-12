let selectedFile = null;

const uploadArea    = document.getElementById('upload-area');
const fileInput     = document.getElementById('xlsx-file');
const fileChip      = document.getElementById('file-chip');
const fileChipName  = document.getElementById('file-chip-name');
const convertBtn    = document.getElementById('convert-btn');
const convertError  = document.getElementById('convert-error');
const convertResult = document.getElementById('convert-result');
const convertLoading = document.getElementById('convert-loading');

// ── 파일 선택 ──────────────────────────────────────────────
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

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });

uploadArea.addEventListener('dragover',  e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
});

document.getElementById('remove-file-btn').addEventListener('click', clearFile);

// ── 변환 제출 ──────────────────────────────────────────────
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
    const blob  = await resp.blob();

    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
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

// ── 토스트 ─────────────────────────────────────────────────
let toastTimer;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2800);
}
