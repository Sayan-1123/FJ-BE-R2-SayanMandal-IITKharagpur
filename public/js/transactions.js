/**
 * Transactions Module
 */
const Transactions = {
  categories: [],
  filters: { page: 1, limit: 15, type: '', category_id: '', search: '', sort_by: 'date', sort_order: 'DESC' },

  async render() {
    await this.loadCategories();
    const currency = Auth.currentUser?.default_currency || 'USD';
    const content = `
      <div class="filters-bar">
        <input type="text" class="form-control" placeholder="🔍 Search transactions..." id="tx-search" value="${this.filters.search}" oninput="Transactions.debounceSearch(this.value)">
        <select class="form-control" id="tx-type" onchange="Transactions.filters.type=this.value;Transactions.filters.page=1;Transactions.load()">
          <option value="">All Types</option>
          <option value="income" ${this.filters.type==='income'?'selected':''}>Income</option>
          <option value="expense" ${this.filters.type==='expense'?'selected':''}>Expense</option>
        </select>
        <select class="form-control" id="tx-category" onchange="Transactions.filters.category_id=this.value;Transactions.filters.page=1;Transactions.load()">
          <option value="">All Categories</option>
          ${this.categories.map(c => `<option value="${c.id}" ${this.filters.category_id===c.id?'selected':''}>${c.icon} ${c.name}</option>`).join('')}
        </select>
        <input type="date" class="form-control" id="tx-start" onchange="Transactions.filters.start_date=this.value;Transactions.filters.page=1;Transactions.load()">
        <input type="date" class="form-control" id="tx-end" onchange="Transactions.filters.end_date=this.value;Transactions.filters.page=1;Transactions.load()">
      </div>
      <div class="card">
        <div class="card-header">
          <h3>💳 Transactions</h3>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-outline btn-sm" onclick="Transactions.showImportModal()">📥 Import Statement</button>
            <button class="btn btn-primary btn-sm" onclick="Transactions.showAddModal()">+ Add Transaction</button>
          </div>
        </div>
        <div id="tx-table"><div class="loading"><div class="spinner"></div></div></div>
        <div id="tx-pagination"></div>
      </div>
    `;

    document.getElementById('app').innerHTML = renderLayout('transactions', 'Transactions', content);
    await this.load();
  },

  _searchTimer: null,
  debounceSearch(val) {
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => { this.filters.search = val; this.filters.page = 1; this.load(); }, 400);
  },

  async loadCategories() {
    try {
      const data = await API.get('/categories');
      this.categories = data.categories;
    } catch { this.categories = []; }
  },

  async load() {
    try {
      const params = {};
      Object.entries(this.filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const data = await API.get('/transactions', params);
      const currency = Auth.currentUser?.default_currency || 'USD';

      const el = document.getElementById('tx-table');
      if (!data.transactions.length) {
        el.innerHTML = '<div class="empty-state"><div class="icon">💳</div><h3>No transactions found</h3><p>Add your first transaction or adjust filters</p></div>';
      } else {
        el.innerHTML = `<table>
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Currency</th><th>Amount</th><th>Actions</th></tr></thead>
          <tbody>${data.transactions.map(tx => `
            <tr>
              <td>${formatDate(tx.date)}</td>
              <td>
                ${tx.description || '—'}
                ${tx.is_anomaly ? '<span class="badge badge-anomaly" title="'+( tx.anomaly_reason || '')+'">⚠️</span>' : ''}
                ${tx.receipt_path ? ' 🧾' : ''}
              </td>
              <td>${tx.category ? `<span style="color:${tx.category.color}">${tx.category.icon} ${tx.category.name}</span>` : '—'}</td>
              <td>${tx.currency}</td>
              <td class="${tx.type==='income'?'amount-positive':'amount-negative'}">${tx.type==='income'?'+':'-'}${formatCurrency(Math.abs(tx.amount), tx.currency)}</td>
              <td>
                <button class="btn btn-outline btn-sm" onclick="Transactions.showEditModal('${tx.id}')">✏️</button>
                <button class="btn btn-outline btn-sm" onclick="Transactions.showReceiptModal('${tx.id}')">🧾</button>
                <button class="btn btn-danger btn-sm" onclick="Transactions.delete('${tx.id}')">🗑️</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>`;
      }

      // Pagination
      const p = data.pagination;
      document.getElementById('tx-pagination').innerHTML = `
        <div class="pagination">
          <button ${p.page<=1?'disabled':''} onclick="Transactions.filters.page=${p.page-1};Transactions.load()">← Prev</button>
          <span>Page ${p.page} of ${p.pages} (${p.total} total)</span>
          <button ${p.page>=p.pages?'disabled':''} onclick="Transactions.filters.page=${p.page+1};Transactions.load()">Next →</button>
        </div>
      `;
    } catch (err) { showToast('Failed to load transactions', 'error'); }
  },

  showAddModal() {
    const cats = this.categories;
    showModal(`
      <h3>Add Transaction</h3>
      <form onsubmit="Transactions.create(event)">
        <div class="form-group">
          <label>Type</label>
          <select class="form-control" id="add-type" onchange="Transactions.filterCatOptions('add')">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <div class="form-group">
          <label>Amount</label>
          <input type="number" step="0.01" class="form-control" id="add-amount" required placeholder="0.00">
        </div>
        <div class="form-group">
          <label>Currency</label>
          <select class="form-control" id="add-currency">
            ${['USD','EUR','GBP','INR','JPY','CAD','AUD','CHF'].map(c => `<option value="${c}" ${c===Auth.currentUser?.default_currency?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Category</label>
          <select class="form-control" id="add-category">
            <option value="">— None —</option>
            ${cats.filter(c=>c.type==='expense').map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Description</label>
          <input type="text" class="form-control" id="add-desc" placeholder="e.g., Grocery shopping">
        </div>
        <div class="form-group">
          <label>Date</label>
          <input type="date" class="form-control" id="add-date" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="hideModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Transaction</button>
        </div>
      </form>
    `);
  },

  filterCatOptions(prefix) {
    const type = document.getElementById(`${prefix}-type`).value;
    const sel = document.getElementById(`${prefix}-category`);
    sel.innerHTML = '<option value="">— None —</option>' +
      this.categories.filter(c => c.type === type).map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  },

  async create(e) {
    e.preventDefault();
    try {
      await API.post('/transactions', {
        type: document.getElementById('add-type').value,
        amount: document.getElementById('add-amount').value,
        currency: document.getElementById('add-currency').value,
        category_id: document.getElementById('add-category').value || null,
        description: document.getElementById('add-desc').value,
        date: document.getElementById('add-date').value,
      });
      hideModal();
      showToast('Transaction added!', 'success');
      this.load();
    } catch (err) { showToast(err.error || err.details?.[0]?.message || 'Failed to add', 'error'); }
  },

  async showEditModal(id) {
    try {
      const data = await API.get(`/transactions/${id}`);
      const tx = data.transaction;
      showModal(`
        <h3>Edit Transaction</h3>
        <form onsubmit="Transactions.update(event, '${id}')">
          <div class="form-group">
            <label>Type</label>
            <select class="form-control" id="edit-type" onchange="Transactions.filterCatOptions('edit')">
              <option value="expense" ${tx.type==='expense'?'selected':''}>Expense</option>
              <option value="income" ${tx.type==='income'?'selected':''}>Income</option>
            </select>
          </div>
          <div class="form-group"><label>Amount</label><input type="number" step="0.01" class="form-control" id="edit-amount" value="${tx.amount}" required></div>
          <div class="form-group">
            <label>Currency</label>
            <select class="form-control" id="edit-currency">
              ${['USD','EUR','GBP','INR','JPY','CAD','AUD','CHF'].map(c => `<option value="${c}" ${c===tx.currency?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Category</label>
            <select class="form-control" id="edit-category">
              <option value="">— None —</option>
              ${this.categories.filter(c=>c.type===tx.type).map(c => `<option value="${c.id}" ${c.id===tx.category_id?'selected':''}>${c.icon} ${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Description</label><input type="text" class="form-control" id="edit-desc" value="${tx.description||''}"></div>
          <div class="form-group"><label>Date</label><input type="date" class="form-control" id="edit-date" value="${tx.date}"></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" onclick="hideModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      `);
    } catch (err) { showToast('Failed to load transaction', 'error'); }
  },

  async update(e, id) {
    e.preventDefault();
    try {
      await API.put(`/transactions/${id}`, {
        type: document.getElementById('edit-type').value,
        amount: document.getElementById('edit-amount').value,
        currency: document.getElementById('edit-currency').value,
        category_id: document.getElementById('edit-category').value || null,
        description: document.getElementById('edit-desc').value,
        date: document.getElementById('edit-date').value,
      });
      hideModal();
      showToast('Transaction updated!', 'success');
      this.load();
    } catch (err) { showToast(err.error || 'Update failed', 'error'); }
  },

  async delete(id) {
    if (!confirm('Delete this transaction?')) return;
    try {
      await API.delete(`/transactions/${id}`);
      showToast('Transaction deleted', 'success');
      this.load();
    } catch (err) { showToast(err.error || 'Delete failed', 'error'); }
  },

  showReceiptModal(id) {
    showModal(`
      <h3>🧾 Receipt</h3>
      <form onsubmit="Transactions.uploadReceipt(event, '${id}')">
        <div class="form-group">
          <label>Upload Receipt (image or PDF)</label>
          <input type="file" class="form-control" id="receipt-file" accept="image/*,.pdf" required>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="hideModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Upload</button>
        </div>
      </form>
    `);
  },

  async uploadReceipt(e, id) {
    e.preventDefault();
    const file = document.getElementById('receipt-file').files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('receipt', file);
    try {
      await API.upload(`/receipts/${id}`, fd);
      hideModal();
      showToast('Receipt uploaded!', 'success');
      this.load();
    } catch (err) { showToast(err.error || 'Upload failed', 'error'); }
  },

  showImportModal() {
    showModal(`
      <h3>📥 Import Bank Statement</h3>
      <p style="color:var(--text-secondary);margin-bottom:16px;">Upload a CSV or PDF bank statement. Duplicate transactions will be automatically detected.</p>
      <form onsubmit="Transactions.importStatement(event)">
        <div class="form-group">
          <label>Statement File</label>
          <input type="file" class="form-control" id="statement-file" accept=".csv,.pdf" required>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="hideModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Import</button>
        </div>
      </form>
    `);
  },

  async importStatement(e) {
    e.preventDefault();
    const file = document.getElementById('statement-file').files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('statement', file);
    try {
      const result = await API.upload('/ai/import-statement', fd);
      hideModal();
      showToast(`Imported ${result.imported} transaction(s), ${result.duplicates} duplicate(s) skipped`, 'success');
      this.load();
    } catch (err) { showToast(err.error || 'Import failed', 'error'); }
  },
};
