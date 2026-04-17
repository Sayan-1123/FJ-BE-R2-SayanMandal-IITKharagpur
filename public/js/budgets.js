/**
 * Budgets Module
 */
const Budgets = {
  categories: [],

  async render() {
    try {
      const catData = await API.get('/categories', { type: 'expense' });
      this.categories = catData.categories;
    } catch { this.categories = []; }

    const content = `
      <div class="card">
        <div class="card-header">
          <h3>🎯 Budget Goals</h3>
          <button class="btn btn-primary btn-sm" onclick="Budgets.showAddModal()">+ Add Budget</button>
        </div>
        <div class="card-body" id="budgets-list"><div class="loading"><div class="spinner"></div></div></div>
      </div>
    `;
    document.getElementById('app').innerHTML = renderLayout('budgets', 'Budgets', content);
    await this.load();
  },

  async load() {
    try {
      const data = await API.get('/budgets');
      const currency = Auth.currentUser?.default_currency || 'USD';
      const el = document.getElementById('budgets-list');

      if (!data.budgets.length) {
        el.innerHTML = '<div class="empty-state"><div class="icon">🎯</div><h3>No budgets yet</h3><p>Set budget goals to track your spending</p></div>';
        return;
      }

      el.innerHTML = `<table>
        <thead><tr><th>Category</th><th>Period</th><th>Budget</th><th>Spent</th><th>Progress</th><th>Actions</th></tr></thead>
        <tbody>${data.budgets.map(b => {
          const pct = Math.min(b.percentage, 100);
          const cls = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'safe';
          return `
            <tr>
              <td>${b.category ? `${b.category.icon} ${b.category.name}` : '📊 Overall'}</td>
              <td style="text-transform:capitalize;">${b.period}</td>
              <td>${formatCurrency(b.amount, currency)}</td>
              <td class="${pct >= 100 ? 'amount-negative' : ''}">${formatCurrency(b.spent, currency)}</td>
              <td style="min-width:150px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div class="budget-progress" style="flex:1;"><div class="budget-progress-bar ${cls}" style="width:${pct}%"></div></div>
                  <span style="font-size:12px;font-weight:600;color:${pct>=100?'var(--accent-red)':pct>=80?'var(--accent-amber)':'var(--accent-green)'}">${b.percentage}%</span>
                </div>
              </td>
              <td>
                <button class="btn btn-outline btn-sm" onclick="Budgets.showEditModal('${b.id}', ${b.amount}, '${b.period}', ${b.alert_threshold})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="Budgets.delete('${b.id}')">🗑️</button>
              </td>
            </tr>`;
        }).join('')}</tbody>
      </table>`;
    } catch (err) { showToast('Failed to load budgets', 'error'); }
  },

  showAddModal() {
    showModal(`
      <h3>Add Budget</h3>
      <form onsubmit="Budgets.create(event)">
        <div class="form-group">
          <label>Category</label>
          <select class="form-control" id="budget-category">
            <option value="">Overall (all expenses)</option>
            ${this.categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Budget Amount</label><input type="number" step="0.01" min="0.01" class="form-control" id="budget-amount" required placeholder="1000.00"></div>
        <div class="form-group">
          <label>Period</label>
          <select class="form-control" id="budget-period">
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div class="form-group"><label>Start Date</label><input type="date" class="form-control" id="budget-start" value="${new Date().toISOString().split('T')[0]}" required></div>
        <div class="form-group"><label>Alert Threshold (%)</label><input type="number" min="1" max="100" class="form-control" id="budget-threshold" value="80"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="hideModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Budget</button>
        </div>
      </form>
    `);
  },

  async create(e) {
    e.preventDefault();
    try {
      await API.post('/budgets', {
        category_id: document.getElementById('budget-category').value || null,
        amount: document.getElementById('budget-amount').value,
        period: document.getElementById('budget-period').value,
        start_date: document.getElementById('budget-start').value,
        alert_threshold: parseInt(document.getElementById('budget-threshold').value) || 80,
      });
      hideModal();
      showToast('Budget created!', 'success');
      this.load();
    } catch (err) { showToast(err.error || err.details?.[0]?.message || 'Failed', 'error'); }
  },

  showEditModal(id, amount, period, threshold) {
    showModal(`
      <h3>Edit Budget</h3>
      <form onsubmit="Budgets.update(event, '${id}')">
        <div class="form-group"><label>Amount</label><input type="number" step="0.01" min="0.01" class="form-control" id="edit-budget-amount" value="${amount}" required></div>
        <div class="form-group">
          <label>Period</label>
          <select class="form-control" id="edit-budget-period">
            <option value="monthly" ${period==='monthly'?'selected':''}>Monthly</option>
            <option value="weekly" ${period==='weekly'?'selected':''}>Weekly</option>
            <option value="yearly" ${period==='yearly'?'selected':''}>Yearly</option>
          </select>
        </div>
        <div class="form-group"><label>Alert Threshold (%)</label><input type="number" min="1" max="100" class="form-control" id="edit-budget-threshold" value="${threshold}"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="hideModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);
  },

  async update(e, id) {
    e.preventDefault();
    try {
      await API.put(`/budgets/${id}`, {
        amount: document.getElementById('edit-budget-amount').value,
        period: document.getElementById('edit-budget-period').value,
        alert_threshold: parseInt(document.getElementById('edit-budget-threshold').value),
      });
      hideModal();
      showToast('Budget updated!', 'success');
      this.load();
    } catch (err) { showToast(err.error || 'Update failed', 'error'); }
  },

  async delete(id) {
    if (!confirm('Delete this budget?')) return;
    try {
      await API.delete(`/budgets/${id}`);
      showToast('Budget deleted', 'success');
      this.load();
    } catch (err) { showToast(err.error || 'Delete failed', 'error'); }
  },
};
