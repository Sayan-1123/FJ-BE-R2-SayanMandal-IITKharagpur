/**
 * Shared UI Components
 */

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, duration);
}

function formatCurrency(amount, currency = 'USD') {
  const num = parseFloat(amount) || 0;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function renderSidebar(activePage, unreadCount = 0) {
  const items = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'transactions', icon: '💳', label: 'Transactions' },
    { id: 'budgets', icon: '🎯', label: 'Budgets' },
    { id: 'reports', icon: '📈', label: 'Reports' },
    { id: 'ai', icon: '🤖', label: 'AI Insights' },
    { id: 'notifications', icon: '🔔', label: 'Notifications', badge: unreadCount },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ];
  return `
    <div class="sidebar">
      <div class="sidebar-logo">💰 FinanceTracker</div>
      ${items.map(i => `
        <div class="nav-item ${activePage === i.id ? 'active' : ''}" onclick="App.navigate('${i.id}')">
          <span class="icon">${i.icon}</span>
          <span>${i.label}</span>
          ${i.badge ? `<span class="nav-badge">${i.badge}</span>` : ''}
        </div>
      `).join('')}
      <div style="margin-top:auto; padding-top:16px; border-top:1px solid var(--border-color);">
        <div class="nav-item" onclick="App.logout()">
          <span class="icon">🚪</span>
          <span>Logout</span>
        </div>
      </div>
    </div>
  `;
}

function renderTopbar(title, actions = '') {
  return `
    <div class="topbar">
      <h2>${title}</h2>
      <div class="topbar-actions">${actions}</div>
    </div>
  `;
}

function renderLayout(page, title, content, actions = '') {
  const unread = window._unreadNotifications || 0;
  return `
    <div class="app-layout">
      ${renderSidebar(page, unread)}
      <div class="main-content">
        ${renderTopbar(title, actions)}
        <div class="page-content">${content}</div>
      </div>
    </div>
  `;
}

function showModal(html) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.classList.remove('hidden');
  overlay.onclick = (e) => { if (e.target === overlay) hideModal(); };
}

function hideModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-overlay').innerHTML = '';
}
