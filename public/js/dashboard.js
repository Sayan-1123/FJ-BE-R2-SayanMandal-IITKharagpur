/**
 * Dashboard Module
 */
const Dashboard = {
  charts: {},

  async render() {
    const currency = Auth.currentUser?.default_currency || 'USD';
    const content = `
      <div class="stats-grid" id="stats-grid"><div class="loading"><div class="spinner"></div></div></div>
      <div class="chart-grid">
        <div class="card">
          <div class="card-header"><h3>📈 Income vs Expenses (30 Days)</h3></div>
          <div class="card-body"><div class="chart-container"><canvas id="trendChart"></canvas></div></div>
        </div>
        <div class="card">
          <div class="card-header"><h3>🍩 Expense Breakdown</h3></div>
          <div class="card-body"><div class="chart-container"><canvas id="categoryChart"></canvas></div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>🎯 Budget Progress</h3></div>
        <div class="card-body" id="budget-progress"><div class="loading"><div class="spinner"></div></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>🕐 Recent Transactions</h3></div>
        <div class="card-body" id="recent-tx"><div class="loading"><div class="spinner"></div></div></div>
      </div>
    `;

    const app = document.getElementById('app');
    app.innerHTML = renderLayout('dashboard', 'Dashboard', content);

    await this.loadData(currency);
  },

  async loadData(currency) {
    try {
      const data = await API.get('/dashboard');
      window._unreadNotifications = data.unread_notifications;

      // Stats
      const s = data.summary;
      document.getElementById('stats-grid').innerHTML = `
        <div class="stat-card income">
          <div class="stat-label">Monthly Income</div>
          <div class="stat-value">${formatCurrency(s.total_income, s.currency)}</div>
          ${data.comparison.income_change ? `<div class="stat-change ${parseFloat(data.comparison.income_change) >= 0 ? 'positive' : 'negative'}">${parseFloat(data.comparison.income_change) >= 0 ? '↑' : '↓'} ${Math.abs(data.comparison.income_change)}% vs last month</div>` : ''}
        </div>
        <div class="stat-card expense">
          <div class="stat-label">Monthly Expenses</div>
          <div class="stat-value">${formatCurrency(s.total_expenses, s.currency)}</div>
          ${data.comparison.expense_change ? `<div class="stat-change ${parseFloat(data.comparison.expense_change) <= 0 ? 'positive' : 'negative'}">${parseFloat(data.comparison.expense_change) <= 0 ? '↓' : '↑'} ${Math.abs(data.comparison.expense_change)}%</div>` : ''}
        </div>
        <div class="stat-card savings">
          <div class="stat-label">Net Savings</div>
          <div class="stat-value">${formatCurrency(s.savings, s.currency)}</div>
        </div>
        <div class="stat-card rate">
          <div class="stat-label">Savings Rate</div>
          <div class="stat-value">${s.savings_rate}%</div>
        </div>
      `;

      // Trend Chart
      this.renderTrendChart(data.daily_trend);

      // Category Chart
      this.renderCategoryChart(data.expense_by_category, s.currency);

      // Budget Progress
      this.renderBudgetProgress(data.budget_summaries, s.currency);

      // Recent Transactions
      this.renderRecentTx(data.recent_transactions, s.currency);

      // Update sidebar badge
      const badge = document.querySelector('.nav-item:nth-child(6) .nav-badge');
      if (badge && data.unread_notifications > 0) badge.textContent = data.unread_notifications;

    } catch (err) {
      showToast('Failed to load dashboard', 'error');
    }
  },

  renderTrendChart(dailyTrend) {
    if (this.charts.trend) this.charts.trend.destroy();
    const dates = [...new Set(dailyTrend.map(d => d.date))].sort();
    const incomeData = dates.map(d => {
      const entry = dailyTrend.find(t => t.date === d && t.type === 'income');
      return entry ? parseFloat(entry.dataValues?.total || entry.total) : 0;
    });
    const expenseData = dates.map(d => {
      const entry = dailyTrend.find(t => t.date === d && t.type === 'expense');
      return entry ? parseFloat(entry.dataValues?.total || entry.total) : 0;
    });

    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    this.charts.trend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [
          { label: 'Income', data: incomeData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 },
          { label: 'Expenses', data: expenseData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { ticks: { color: '#64748b', maxTicksLimit: 10 }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });
  },

  renderCategoryChart(categories, currency) {
    if (this.charts.category) this.charts.category.destroy();
    if (!categories.length) return;
    const labels = categories.map(c => c.category?.name || 'Uncategorized');
    const amounts = categories.map(c => parseFloat(c.dataValues?.total || c.total));
    const colors = categories.map(c => c.category?.color || '#6b7280');

    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    this.charts.category = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: amounts, backgroundColor: colors, borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#94a3b8', padding: 12, font: { size: 12 } } },
        },
        cutout: '65%',
      },
    });
  },

  renderBudgetProgress(budgets, currency) {
    const el = document.getElementById('budget-progress');
    if (!budgets.length) {
      el.innerHTML = '<div class="empty-state"><div class="icon">🎯</div><h3>No budgets set</h3><p>Create budgets to track your spending goals</p></div>';
      return;
    }
    el.innerHTML = budgets.map(b => {
      const pct = Math.min(b.percentage, 100);
      const cls = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'safe';
      return `
        <div style="margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span>${b.category?.icon || '📁'} ${b.category?.name || 'Overall'} <span style="color:var(--text-muted);font-size:12px;">(${b.period})</span></span>
            <span style="font-weight:600;">${formatCurrency(b.spent, currency)} / ${formatCurrency(b.amount, currency)}</span>
          </div>
          <div class="budget-progress"><div class="budget-progress-bar ${cls}" style="width:${pct}%"></div></div>
          <div style="text-align:right;font-size:12px;color:${pct >= 100 ? 'var(--accent-red)' : 'var(--text-muted)'};margin-top:4px;">${b.percentage}%</div>
        </div>
      `;
    }).join('');
  },

  renderRecentTx(transactions, currency) {
    const el = document.getElementById('recent-tx');
    if (!transactions.length) {
      el.innerHTML = '<div class="empty-state"><div class="icon">💳</div><h3>No transactions yet</h3><p>Add your first transaction to get started</p></div>';
      return;
    }
    el.innerHTML = `<table>
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead>
      <tbody>${transactions.map(tx => `
        <tr>
          <td>${formatDate(tx.date)}</td>
          <td>${tx.description || '—'} ${tx.is_anomaly ? '<span class="badge badge-anomaly">⚠️ Anomaly</span>' : ''}</td>
          <td>${tx.category ? `<span style="color:${tx.category.color}">${tx.category.icon} ${tx.category.name}</span>` : '<span style="color:var(--text-muted)">Uncategorized</span>'}</td>
          <td class="${tx.type === 'income' ? 'amount-positive' : 'amount-negative'}">${tx.type === 'income' ? '+' : '-'}${formatCurrency(Math.abs(tx.converted_amount || tx.amount), currency)}</td>
        </tr>
      `).join('')}</tbody>
    </table>`;
  },
};
