const $ = (selector) => document.querySelector(selector);
const monthPicker = $('#monthPicker');
const typeFilter = $('#typeFilter');
const rowsElement = $('#transactionRows');
const emptyState = $('#emptyState');
const form = $('#transactionForm');
const categories = {
  expense: ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Contas', 'Compras', 'Outros'],
  income: ['Salário', 'Freelance', 'Investimentos', 'Vendas', 'Reembolso', 'Outros']
};
let toastTimer;

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}
function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function showToast(message, error = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Ocorreu um erro. Tente novamente.');
  }
  return response.status === 204 ? null : response.json();
}
function renderTransactions(items) {
  rowsElement.innerHTML = items.map((item) => {
    const income = item.type === 'income';
    const date = new Date(`${item.transaction_date}T12:00:00`);
    const formattedDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', '');
    return `<tr><td><div class="transaction-name"><span class="transaction-icon ${income ? '' : 'expense'}">${income ? '↗' : '↘'}</span>${escapeHtml(item.description)}</div></td><td><span class="category-pill">${escapeHtml(item.category)}</span></td><td>${formattedDate}</td><td><span class="amount ${income ? 'income' : 'expense'}">${income ? '+' : '−'} ${money(item.amount)}</span></td><td><button class="row-menu" data-delete="${Number(item.id)}" aria-label="Excluir ${escapeHtml(item.description)}" title="Excluir lançamento">×</button></td></tr>`;
  }).join('');
  emptyState.classList.toggle('visible', items.length === 0);
  $('#transactionCount').textContent = `${items.length} ${items.length === 1 ? 'lançamento' : 'lançamentos'}`;
}
async function loadData() {
  const month = monthPicker.value;
  if (!month) return;
  try {
    const [summary, items] = await Promise.all([
      api(`/api/summary?month=${encodeURIComponent(month)}`),
      api(`/api/transactions?month=${encodeURIComponent(month)}${typeFilter.value !== 'all' ? `&type=${typeFilter.value}` : ''}`)
    ]);
    $('#balanceValue').textContent = money(summary.balance);
    $('#incomeValue').textContent = money(summary.income);
    $('#expenseValue').textContent = money(summary.expense);
    $('#balanceCaption').textContent = summary.balance < 0 ? 'Atenção: despesas acima das receitas' : 'Resultado das movimentações';
    $('#balanceIndicator').style.color = summary.balance < 0 ? '#f2b4ac' : '#a5d6b3';
    renderTransactions(items);
  } catch (error) {
    showToast(error.message || 'Não foi possível conectar ao servidor.', true);
  }
}
function setCategories(type, selected = '') {
  $('#categorySelect').innerHTML = `<option value="" disabled ${selected ? '' : 'selected'}>Selecione uma categoria</option>${categories[type].map((name) => `<option ${name === selected ? 'selected' : ''}>${name}</option>`).join('')}`;
}
function openModal() {
  $('#formError').textContent = '';
  $('#modalBackdrop').classList.add('open');
  $('#modalBackdrop').setAttribute('aria-hidden', 'false');
  setTimeout(() => form.elements.description.focus(), 50);
}
function closeModal() {
  $('#modalBackdrop').classList.remove('open');
  $('#modalBackdrop').setAttribute('aria-hidden', 'true');
}

monthPicker.value = localDate().slice(0, 7);
$('#todayLabel').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
form.elements.transaction_date.value = localDate();
setCategories('expense');
loadData();

$('#openModal').addEventListener('click', openModal);
$('#emptyAddButton').addEventListener('click', openModal);
$('#closeModal').addEventListener('click', closeModal);
$('#cancelModal').addEventListener('click', closeModal);
$('#refreshButton').addEventListener('click', loadData);
monthPicker.addEventListener('change', loadData);
typeFilter.addEventListener('change', loadData);
document.querySelectorAll('input[name="type"]').forEach((radio) => radio.addEventListener('change', () => setCategories(radio.value)));
$('#modalBackdrop').addEventListener('click', (event) => { if (event.target === $('#modalBackdrop')) closeModal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = $('#saveButton');
  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  payload.amount = Number(payload.amount);
  submit.disabled = true;
  submit.textContent = 'Salvando…';
  $('#formError').textContent = '';
  try {
    await api('/api/transactions', { method: 'POST', body: JSON.stringify(payload) });
    const addedMonth = payload.transaction_date.slice(0, 7);
    if (monthPicker.value !== addedMonth) { monthPicker.value = addedMonth; typeFilter.value = 'all'; }
    form.reset();
    form.elements.transaction_date.value = localDate();
    document.querySelector('input[name="type"][value="expense"]').checked = true;
    setCategories('expense');
    closeModal();
    await loadData();
    showToast('Lançamento salvo com sucesso.');
  } catch (error) {
    $('#formError').textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Salvar lançamento <span>→</span>';
  }
});

rowsElement.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  try {
    await api(`/api/transactions/${button.dataset.delete}`, { method: 'DELETE' });
    await loadData();
    showToast('Lançamento removido.');
  } catch (error) { showToast(error.message, true); }
});
