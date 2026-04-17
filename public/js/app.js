/**
 * App — Main Router & Entry Point
 */
const App = {
  currentPage: null,

  async init() {
    // Check for OAuth token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      API.setToken(tokenFromUrl);
      window.history.replaceState({}, '', '/');
    }

    // Check if user is authenticated
    if (API.token) {
      const user = await Auth.loadProfile();
      if (user) {
        // Fetch unread notification count
        try {
          const nData = await API.get('/notifications', { unread_only: 'true' });
          window._unreadNotifications = nData.unread_count || 0;
        } catch { window._unreadNotifications = 0; }

        this.navigate('dashboard');
        return;
      }
    }

    this.navigate('login');
  },

  navigate(page) {
    this.currentPage = page;

    if (page === 'login') {
      document.getElementById('app').innerHTML = Auth.renderLogin();
      return;
    }

    if (!Auth.currentUser) {
      this.navigate('login');
      return;
    }

    switch (page) {
      case 'dashboard':
        Dashboard.render();
        break;
      case 'transactions':
        Transactions.render();
        break;
      case 'budgets':
        Budgets.render();
        break;
      case 'reports':
        Reports.render();
        break;
      case 'ai':
        AI.render();
        break;
      case 'notifications':
        this.renderNotifications();
        break;
      case 'profile':
        document.getElementById('app').innerHTML = Auth.renderProfile();
        break;
      default:
        Dashboard.render();
    }
  },

  async renderNotifications() {
    const content = `
      <div class="card">
        <div class="card-header">
          <h3>🔔 Notifications</h3>
          <button class="btn btn-outline btn-sm" onclick="App.markAllRead()">Mark All Read</button>
        </div>
        <div class="card-body" id="notif-list"><div class="loading"><div class="spinner"></div></div></div>
      </div>
    `;
    document.getElementById('app').innerHTML = renderLayout('notifications', 'Notifications', content);

    try {
      const data = await API.get('/notifications');
      const el = document.getElementById('notif-list');

      if (!data.notifications.length) {
        el.innerHTML = '<div class="empty-state"><div class="icon">🔔</div><h3>No notifications</h3></div>';
        return;
      }

      el.innerHTML = `<div class="notif-list">${data.notifications.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="App.markRead('${n.id}', this)">
          <div class="notif-title">${n.type === 'budget_alert' ? '⚠️' : n.type === 'anomaly' ? '🔔' : 'ℹ️'} ${n.title}</div>
          <div class="notif-message">${n.message}</div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
      `).join('')}</div>`;
    } catch (err) { showToast('Failed to load notifications', 'error'); }
  },

  async markRead(id, el) {
    try {
      await API.put(`/notifications/${id}/read`);
      if (el) el.classList.remove('unread');
      window._unreadNotifications = Math.max(0, (window._unreadNotifications || 0) - 1);
    } catch {}
  },

  async markAllRead() {
    try {
      await API.put('/notifications/read-all');
      window._unreadNotifications = 0;
      showToast('All notifications marked as read', 'success');
      this.renderNotifications();
    } catch (err) { showToast('Failed', 'error'); }
  },

  logout() {
    API.setToken(null);
    Auth.currentUser = null;
    window._unreadNotifications = 0;
    this.navigate('login');
    showToast('Logged out', 'info');
  },
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
