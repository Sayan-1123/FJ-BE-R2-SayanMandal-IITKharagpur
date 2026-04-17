/**
 * AI Module — Insights, Chat, Anomalies
 */
const AI = {
  chatMessages: [],

  async render() {
    const content = `
      <div class="stats-grid">
        <div class="card" style="grid-column:1/-1;">
          <div class="card-header">
            <h3>🤖 AI Financial Insights</h3>
            <button class="btn btn-primary btn-sm" onclick="AI.loadInsights()">🔄 Refresh</button>
          </div>
          <div class="card-body" id="ai-insights"><div class="loading"><div class="spinner"></div></div></div>
        </div>
      </div>
      <div class="chart-grid">
        <div class="card">
          <div class="card-header"><h3>💬 Financial Chatbot</h3></div>
          <div class="chat-container">
            <div class="chat-messages" id="chat-messages">
              <div class="chat-message ai">Hi! I'm your AI financial assistant. Ask me anything about your finances, budgeting tips, or investment advice!</div>
            </div>
            <div class="chat-input-bar">
              <input type="text" class="form-control" id="chat-input" placeholder="Ask about your finances..." onkeydown="if(event.key==='Enter')AI.sendChat()">
              <button class="btn btn-primary" onclick="AI.sendChat()">Send</button>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>⚠️ Anomaly Detection</h3>
            <button class="btn btn-outline btn-sm" onclick="AI.loadAnomalies()">Scan</button>
          </div>
          <div class="card-body" id="anomaly-list"><div class="loading"><div class="spinner"></div></div></div>
        </div>
      </div>
    `;
    document.getElementById('app').innerHTML = renderLayout('ai', 'AI Insights', content);
    this.loadInsights();
    this.loadAnomalies();
  },

  async loadInsights() {
    try {
      const data = await API.get('/ai/insights', { days: 30 });
      const el = document.getElementById('ai-insights');

      let html = '';
      if (data.health_score !== undefined) {
        const score = data.health_score;
        const color = score >= 70 ? 'var(--accent-green)' : score >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)';
        html += `<div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:48px;font-weight:800;color:${color};">${score}</div>
          <div style="color:var(--text-secondary);font-size:14px;">Financial Health Score</div>
        </div>`;
      }

      if (data.insights?.length) {
        html += '<div style="display:grid;gap:12px;margin-bottom:20px;">';
        data.insights.forEach(i => {
          const icon = i.type === 'positive' ? '✅' : i.type === 'negative' ? '❌' : 'ℹ️';
          const bg = i.type === 'positive' ? 'rgba(16,185,129,0.1)' : i.type === 'negative' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)';
          html += `<div style="background:${bg};padding:16px;border-radius:8px;">
            <div style="font-weight:600;margin-bottom:4px;">${icon} ${i.title}</div>
            <div style="font-size:13px;color:var(--text-secondary);">${i.description}</div>
          </div>`;
        });
        html += '</div>';
      }

      if (data.recommendations?.length) {
        html += '<h4 style="margin-bottom:8px;">💡 Recommendations</h4><ul style="padding-left:20px;color:var(--text-secondary);font-size:14px;">';
        data.recommendations.forEach(r => { html += `<li style="margin-bottom:6px;">${r}</li>`; });
        html += '</ul>';
      }

      el.innerHTML = html || '<div class="empty-state">No insights available yet. Add some transactions first!</div>';
    } catch (err) { showToast('Failed to load insights', 'error'); }
  },

  async sendChat() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';

    const messagesEl = document.getElementById('chat-messages');
    messagesEl.innerHTML += `<div class="chat-message user">${message}</div>`;
    messagesEl.innerHTML += '<div class="chat-message ai" id="chat-typing">Thinking...</div>';
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const data = await API.post('/ai/chat', { message });
      document.getElementById('chat-typing').textContent = data.response;
    } catch (err) {
      document.getElementById('chat-typing').textContent = 'Sorry, something went wrong.';
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  },

  async loadAnomalies() {
    try {
      const data = await API.get('/ai/anomalies', { days: 30 });
      const el = document.getElementById('anomaly-list');
      const currency = Auth.currentUser?.default_currency || 'USD';

      if (!data.anomalies.length) {
        el.innerHTML = '<div class="empty-state"><div class="icon">✅</div><h3>No anomalies detected</h3><p>Your spending looks normal!</p></div>';
        return;
      }

      el.innerHTML = data.anomalies.map(a => `
        <div style="padding:12px;background:rgba(245,158,11,0.08);border-radius:8px;margin-bottom:8px;border-left:3px solid var(--accent-amber);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:600;">⚠️ ${a.description || 'Transaction'}</span>
            <span class="badge badge-${a.type}">${a.type}</span>
          </div>
          <div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">
            ${formatCurrency(a.amount, a.currency)} — ${formatDate(a.date)}
          </div>
          <div style="font-size:12px;color:var(--accent-amber);margin-top:4px;">${a.reasons.join(' • ')}</div>
        </div>
      `).join('');
    } catch (err) { showToast('Failed to scan anomalies', 'error'); }
  },
};
