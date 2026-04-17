/**
 * Auth Module — Login, Register, Profile
 */
const Auth = {
  currentUser: null,

  renderLogin() {
    return `
    <div class="auth-container">
      <div class="auth-card">
        <div style="text-align:center;margin-bottom:8px;font-size:40px;">💰</div>
        <h1 style="text-align:center;">Finance Tracker</h1>
        <p class="subtitle" style="text-align:center;">Track your money, grow your wealth</p>
        <div class="auth-tabs">
          <button class="auth-tab active" onclick="Auth.showTab('login')">Sign In</button>
          <button class="auth-tab" onclick="Auth.showTab('register')">Sign Up</button>
        </div>
        <div id="auth-form">${this.loginForm()}</div>
        <div style="text-align:center;margin-top:16px;">
          <button class="btn btn-google btn-block" onclick="window.location.href='/api/auth/google'" style="margin-top:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>`;
  },

  loginForm() {
    return `
      <form onsubmit="Auth.login(event)">
        <div class="form-group">
          <label>Email</label>
          <input type="email" class="form-control" id="login-email" required placeholder="you@example.com">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" class="form-control" id="login-password" required placeholder="••••••••">
        </div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">Sign In</button>
      </form>`;
  },

  registerForm() {
    return `
      <form onsubmit="Auth.register(event)">
        <div class="form-group">
          <label>Name</label>
          <input type="text" class="form-control" id="reg-name" required placeholder="John Doe">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" class="form-control" id="reg-email" required placeholder="you@example.com">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" class="form-control" id="reg-password" required minlength="8" placeholder="Min 8 chars, 1 uppercase, 1 number">
        </div>
        <div class="form-group">
          <label>Default Currency</label>
          <select class="form-control" id="reg-currency">
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="INR">INR — Indian Rupee</option>
            <option value="JPY">JPY — Japanese Yen</option>
            <option value="CAD">CAD — Canadian Dollar</option>
            <option value="AUD">AUD — Australian Dollar</option>
          </select>
        </div>
        <button type="submit" class="btn btn-success btn-block btn-lg">Create Account</button>
      </form>`;
  },

  showTab(tab) {
    document.querySelectorAll('.auth-tab').forEach((t, i) => {
      t.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1));
    });
    document.getElementById('auth-form').innerHTML = tab === 'login' ? this.loginForm() : this.registerForm();
  },

  async login(e) {
    e.preventDefault();
    try {
      const data = await API.post('/auth/login', {
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value,
      });
      API.setToken(data.token);
      this.currentUser = data.user;
      showToast('Welcome back!', 'success');
      App.navigate('dashboard');
    } catch (err) {
      showToast(err.error || 'Login failed', 'error');
    }
  },

  async register(e) {
    e.preventDefault();
    try {
      const data = await API.post('/auth/register', {
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
        default_currency: document.getElementById('reg-currency').value,
      });
      API.setToken(data.token);
      this.currentUser = data.user;
      showToast('Account created!', 'success');
      App.navigate('dashboard');
    } catch (err) {
      showToast(err.error || err.details?.[0]?.message || 'Registration failed', 'error');
    }
  },

  async loadProfile() {
    try {
      const data = await API.get('/auth/me');
      this.currentUser = data.user;
      return data.user;
    } catch {
      return null;
    }
  },

  renderProfile() {
    const user = this.currentUser;
    return renderLayout('profile', 'Profile Settings', `
      <div class="card" style="max-width:600px;">
        <div class="card-header"><h3>👤 Profile Information</h3></div>
        <div class="card-body">
          <form onsubmit="Auth.updateProfile(event)">
            <div class="form-group">
              <label>Name</label>
              <input type="text" class="form-control" id="profile-name" value="${user?.name || ''}">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" class="form-control" value="${user?.email || ''}" disabled>
            </div>
            <div class="form-group">
              <label>Default Currency</label>
              <select class="form-control" id="profile-currency">
                ${['USD','EUR','GBP','INR','JPY','CAD','AUD','CHF','CNY','SGD'].map(c =>
                  `<option value="${c}" ${user?.default_currency === c ? 'selected' : ''}>${c}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" id="pref-budget" ${user?.notification_preferences?.email_budget_alerts ? 'checked' : ''}> Email budget alerts
              </label>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" id="pref-anomaly" ${user?.notification_preferences?.email_anomaly_alerts ? 'checked' : ''}> Email anomaly alerts
              </label>
            </div>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </form>
        </div>
      </div>
      <div class="card" style="max-width:600px;">
        <div class="card-header"><h3>🔒 Change Password</h3></div>
        <div class="card-body">
          <form onsubmit="Auth.changePassword(event)">
            <div class="form-group">
              <label>Current Password</label>
              <input type="password" class="form-control" id="current-password" required>
            </div>
            <div class="form-group">
              <label>New Password</label>
              <input type="password" class="form-control" id="new-password" required minlength="8">
            </div>
            <button type="submit" class="btn btn-primary">Update Password</button>
          </form>
        </div>
      </div>
    `);
  },

  async updateProfile(e) {
    e.preventDefault();
    try {
      const data = await API.put('/auth/profile', {
        name: document.getElementById('profile-name').value,
        default_currency: document.getElementById('profile-currency').value,
        notification_preferences: {
          email_budget_alerts: document.getElementById('pref-budget').checked,
          email_anomaly_alerts: document.getElementById('pref-anomaly').checked,
          in_app_notifications: true,
        },
      });
      this.currentUser = data.user;
      showToast('Profile updated!', 'success');
    } catch (err) { showToast(err.error || 'Update failed', 'error'); }
  },

  async changePassword(e) {
    e.preventDefault();
    try {
      await API.put('/auth/password', {
        current_password: document.getElementById('current-password').value,
        new_password: document.getElementById('new-password').value,
      });
      showToast('Password updated!', 'success');
      document.getElementById('current-password').value = '';
      document.getElementById('new-password').value = '';
    } catch (err) { showToast(err.error || 'Password update failed', 'error'); }
  },
};
