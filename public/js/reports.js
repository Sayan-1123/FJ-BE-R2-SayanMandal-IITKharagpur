/**
 * Reports Module
 */
const Reports = {
  chart: null,

  async render() {
    const content = `
      <div class="filters-bar">
        <select class="form-control" id="report-type" onchange="Reports.loadReport()">
          <option value="monthly">Monthly Income vs Expenses</option>
          <option value="category">Category Breakdown</option>
          <option value="trends">Spending Trends</option>
          <option value="summary">Period Summary</option>
        </select>
        <input type="date" class="form-control" id="report-start" onchange="Reports.loadReport()">
        <input type="date" class="form-control" id="report-end" onchange="Reports.loadReport()">
        <select class="form-control" id="report-period" onchange="Reports.loadReport()" style="display:none;">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly" selected>Monthly</option>
        </select>
      </div>
      <div class="chart-grid">
        <div class="card" style="grid-column:1/-1;">
          <div class="card-header"><h3 id="report-title">📈 Monthly Income vs Expenses</h3></div>
          <div class="card-body"><div class="chart-container" style="height:350px;"><canvas id="reportChart"></canvas></div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>📋 Report Data</h3></div>
        <div class="card-body" id="report-data"><div class="loading"><div class="spinner"></div></div></div>
      </div>
    `;
    document.getElementById('app').innerHTML = renderLayout('reports', 'Reports', content);
    this.loadReport();
  },

  async loadReport() {
    const type = document.getElementById('report-type').value;
    const start = document.getElementById('report-start').value;
    const end = document.getElementById('report-end').value;

    document.getElementById('report-period').style.display = type === 'trends' ? '' : 'none';

    if (type === 'monthly') await this.loadMonthly();
    else if (type === 'category') await this.loadCategory(start, end);
    else if (type === 'trends') await this.loadTrends();
    else if (type === 'summary') await this.loadSummary(start, end);
  },

  async loadMonthly() {
    try {
      document.getElementById('report-title').textContent = '📈 Monthly Income vs Expenses';
      const data = await API.get('/reports/monthly', { months: 12 });
      const currency = data.currency;

      if (this.chart) this.chart.destroy();
      const ctx = document.getElementById('reportChart');
      this.chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.report.map(r => r.month),
          datasets: [
            { label: 'Income', data: data.report.map(r => parseFloat(r.income)), backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4 },
            { label: 'Expenses', data: data.report.map(r => parseFloat(r.expenses)), backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#94a3b8' } } },
          scales: {
            x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          },
        },
      });

      document.getElementById('report-data').innerHTML = `<table>
        <thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net</th><th>Savings Rate</th></tr></thead>
        <tbody>${data.report.map(r => `
          <tr>
            <td>${r.month}</td>
            <td class="amount-positive">${formatCurrency(r.income, currency)}</td>
            <td class="amount-negative">${formatCurrency(r.expenses, currency)}</td>
            <td class="${parseFloat(r.net)>=0?'amount-positive':'amount-negative'}">${formatCurrency(r.net, currency)}</td>
            <td>${r.savings_rate}%</td>
          </tr>
        `).join('')}</tbody>
      </table>`;
    } catch (err) { showToast('Failed to load report', 'error'); }
  },

  async loadCategory(start, end) {
    try {
      document.getElementById('report-title').textContent = '🍩 Expense by Category';
      const params = {};
      if (start) params.start_date = start;
      if (end) params.end_date = end;
      const data = await API.get('/reports/category', params);

      if (this.chart) this.chart.destroy();
      const ctx = document.getElementById('reportChart');
      this.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: data.report.map(r => r.category?.name || 'Uncategorized'),
          datasets: [{ data: data.report.map(r => parseFloat(r.total)), backgroundColor: data.report.map(r => r.category?.color || '#6b7280'), borderWidth: 0 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { color: '#94a3b8', padding: 12 } } },
          cutout: '60%',
        },
      });

      document.getElementById('report-data').innerHTML = `<table>
        <thead><tr><th>Category</th><th>Total</th><th>Count</th><th>Average</th><th>% of Total</th></tr></thead>
        <tbody>${data.report.map(r => `
          <tr>
            <td>${r.category?.icon || '📁'} ${r.category?.name || 'Uncategorized'}</td>
            <td>${formatCurrency(r.total, data.currency)}</td>
            <td>${r.count}</td>
            <td>${formatCurrency(r.average, data.currency)}</td>
            <td>${r.percentage}%</td>
          </tr>
        `).join('')}</tbody>
      </table>`;
    } catch (err) { showToast('Failed to load report', 'error'); }
  },

  async loadTrends() {
    try {
      document.getElementById('report-title').textContent = '📊 Spending Trends';
      const period = document.getElementById('report-period').value;
      const data = await API.get('/reports/trends', { period, days: 90 });

      if (this.chart) this.chart.destroy();
      const ctx = document.getElementById('reportChart');
      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.trends.map(t => t.date),
          datasets: [
            { label: 'Income', data: data.trends.map(t => parseFloat(t.income)), borderColor: '#10b981', fill: false, tension: 0.3 },
            { label: 'Expenses', data: data.trends.map(t => parseFloat(t.expenses)), borderColor: '#ef4444', fill: false, tension: 0.3 },
            { label: 'Net', data: data.trends.map(t => parseFloat(t.net)), borderColor: '#8b5cf6', borderDash: [5,5], fill: false, tension: 0.3 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#94a3b8' } } },
          scales: {
            x: { ticks: { color: '#64748b', maxTicksLimit: 15 }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          },
        },
      });

      document.getElementById('report-data').innerHTML = '<p style="color:var(--text-secondary);">Trend data displayed in chart above.</p>';
    } catch (err) { showToast('Failed to load trends', 'error'); }
  },

  async loadSummary(start, end) {
    try {
      document.getElementById('report-title').textContent = '📋 Period Summary';
      const params = {};
      if (start) params.start_date = start;
      if (end) params.end_date = end;
      const data = await API.get('/reports/summary', params);

      if (this.chart) { this.chart.destroy(); this.chart = null; }
      const ctx = document.getElementById('reportChart');
      ctx.parentElement.innerHTML = '<canvas id="reportChart"></canvas>';

      document.getElementById('report-data').innerHTML = `
        <div class="stats-grid">
          <div class="stat-card income"><div class="stat-label">Total Income</div><div class="stat-value">${formatCurrency(data.total_income, data.currency)}</div></div>
          <div class="stat-card expense"><div class="stat-label">Total Expenses</div><div class="stat-value">${formatCurrency(data.total_expenses, data.currency)}</div></div>
          <div class="stat-card savings"><div class="stat-label">Net Savings</div><div class="stat-value">${formatCurrency(data.net_savings, data.currency)}</div></div>
          <div class="stat-card rate"><div class="stat-label">Savings Rate</div><div class="stat-value">${data.savings_rate}%</div></div>
        </div>
        <div style="margin-top:16px;color:var(--text-secondary);">
          <p>📅 Period: ${formatDate(data.period.start)} — ${formatDate(data.period.end)}</p>
          <p>📊 Total Transactions: ${data.transaction_count}</p>
          <p>💸 Avg Daily Expense: ${formatCurrency(data.avg_daily_expense, data.currency)}</p>
        </div>
      `;
    } catch (err) { showToast('Failed to load summary', 'error'); }
  },
};
