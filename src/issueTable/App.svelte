<script>
  import { onMount, onDestroy } from 'svelte';
  import Column from './components/Column.svelte';
  import AccountsView from './components/AccountsView.svelte';
  import NewIssueModal from './components/NewIssueModal.svelte';

  let issues = [];
  let accounts = [];
  let currentUser = null;
  let loading = true;
  let error = null;
  let activeTab = 'board'; // 'board' | 'accounts'
  let showNewIssueModal = false;

  let pollInterval;

  onMount(async () => {
    const meRes = await fetch('/api/issues/me');
    if (meRes.ok) {
      currentUser = await meRes.json();
    }

    await loadAll();
    pollInterval = setInterval(loadAll, 15000);
  });

  onDestroy(() => {
    clearInterval(pollInterval);
  });

  async function loadAll() {
    await Promise.all([loadIssues(), loadAccounts()]);
  }

  async function loadIssues() {
    try {
      const res = await fetch('/api/issues/issues');
      if (!res.ok) throw new Error('Failed to load issues');
      issues = await res.json();
      error = null;
    } catch (e) {
      error = '無法載入議題，請重新整理';
    } finally {
      loading = false;
    }
  }

  async function loadAccounts() {
    try {
      const res = await fetch('/api/issues/accounts');
      if (!res.ok) return;
      accounts = await res.json();
    } catch {}
  }

  $: newIssues = issues.filter(i => i.status === 'new');
  $: processingIssues = issues.filter(i => i.status === 'processing');
  $: resolvedIssues = issues.filter(i => i.status === 'resolved');
  $: discontinuedCount = accounts.filter(a => a.status === 'discontinued').length;
</script>

<div class="app">
  <header>
    <div class="header-left">
      <h1>議題追蹤</h1>
      <nav class="tabs">
        <button
          class="tab"
          class:active={activeTab === 'board'}
          on:click={() => (activeTab = 'board')}
        >
          議題看板
          <span class="tab-count">{issues.length}</span>
        </button>
        <button
          class="tab"
          class:active={activeTab === 'accounts'}
          on:click={() => (activeTab = 'accounts')}
        >
          帳號資料庫
          <span class="tab-count">{accounts.length}</span>
          {#if discontinuedCount > 0}
            <span class="tab-alert">{discontinuedCount} 停止</span>
          {/if}
        </button>
      </nav>
    </div>

    <div class="header-right">
      {#if currentUser?.role === 'admin'}
        <button class="btn-new" on:click={() => (showNewIssueModal = true)}>
          ＋ 新增議題
        </button>
        <div class="user">
          <img src={currentUser.pictureUrl} alt={currentUser.name} class="user-avatar" />
          <span>{currentUser.name}</span>
          <span class="role-badge" class:admin={currentUser.role === 'admin'}>
            {currentUser.role === 'admin' ? '管理員' : '觀看者'}
          </span>
          <a href="/issues-logout" class="logout-link">登出</a>
        </div>
      {/if}
    </div>
  </header>

  <NewIssueModal
    bind:open={showNewIssueModal}
    on:created={loadAll}
  />

  {#if loading}
    <p class="status">載入中…</p>
  {:else if !currentUser}
    <div class="login-page">
      <div class="login-card">
        <h2>議題追蹤平台</h2>
        <p class="login-desc">請選擇登入方式</p>

        <a href="/issues-google-login" class="login-btn login-btn-google">
          <svg viewBox="0 0 24 24" class="login-icon" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          以 Google 登入
          <span class="login-badge admin">管理員</span>
        </a>
        <p class="login-note">僅限 @doublethinklab.org 帳號</p>

        <div class="divider"><span>或</span></div>

        <a href="/issues-line-login" class="login-btn login-btn-line">
          <svg viewBox="0 0 24 24" class="login-icon" aria-hidden="true">
            <path fill="#06C755" d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
          </svg>
          以 LINE 登入
          <span class="login-badge viewer">觀看者</span>
        </a>
      </div>
    </div>
  {:else if error}
    <p class="status error">{error}</p>
  {:else if activeTab === 'board'}
    <div class="board">
      <Column title="新議題" issues={newIssues} {currentUser} on:update={loadAll} />
      <Column title="處理中" issues={processingIssues} {currentUser} on:update={loadAll} />
      <Column title="已處理" issues={resolvedIssues} {currentUser} on:update={loadAll} />
    </div>
  {:else}
    <AccountsView {accounts} isAdmin={currentUser?.role === 'admin'} on:update={loadAll} />
  {/if}
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #e8eaed;
  }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  header {
    background: #fff;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    height: 56px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 24px;
    height: 100%;
  }

  h1 {
    font-size: 17px;
    margin: 0;
    color: #333;
    white-space: nowrap;
  }

  .tabs {
    display: flex;
    height: 100%;
    gap: 4px;
    align-items: flex-end;
  }

  .tab {
    font-size: 13px;
    padding: 6px 14px;
    border: none;
    background: none;
    cursor: pointer;
    color: #666;
    border-bottom: 3px solid transparent;
    display: flex;
    align-items: center;
    gap: 5px;
    height: 100%;
  }

  .tab.active {
    color: #1a73e8;
    border-bottom-color: #1a73e8;
    font-weight: 600;
  }

  .tab-count {
    font-size: 11px;
    background: #e8eaed;
    border-radius: 10px;
    padding: 1px 6px;
    color: #555;
  }

  .tab-alert {
    font-size: 10px;
    background: #e74c3c;
    color: #fff;
    border-radius: 10px;
    padding: 1px 6px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-new {
    font-size: 13px;
    font-weight: 600;
    padding: 6px 14px;
    background: #1a73e8;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-new:hover { background: #1558b0; }

  .role-badge {
    font-size: 11px;
    padding: 2px 7px;
    border-radius: 10px;
    background: #e8eaed;
    color: #555;
  }
  .role-badge.admin { background: #e8f0fe; color: #1a73e8; }

  .logout-link {
    font-size: 12px;
    color: #999;
    text-decoration: none;
  }
  .logout-link:hover { color: #333; }

  /* Login page */
  .login-page {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .login-card {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    padding: 40px 36px;
    width: 360px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .login-card h2 {
    font-size: 20px;
    margin: 0 0 4px;
    color: #333;
  }

  .login-desc {
    font-size: 14px;
    color: #888;
    margin: 0 0 8px;
  }

  .login-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 11px 16px;
    border-radius: 8px;
    border: 1px solid #ddd;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    color: #333;
    background: #fff;
    transition: background 0.15s;
  }

  .login-btn:hover { background: #f5f5f5; }

  .login-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .login-badge {
    margin-left: auto;
    font-size: 11px;
    border-radius: 10px;
    padding: 2px 8px;
    font-weight: 600;
  }

  .login-badge.admin { background: #e8f0fe; color: #1a73e8; }
  .login-badge.viewer { background: #e8eaed; color: #555; }

  .login-note {
    font-size: 11px;
    color: #aaa;
    margin: -6px 0 4px;
    align-self: flex-start;
    padding-left: 4px;
  }

  .divider {
    width: 100%;
    text-align: center;
    position: relative;
    font-size: 12px;
    color: #ccc;
    margin: 4px 0;
  }

  .divider::before, .divider::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 42%;
    height: 1px;
    background: #eee;
  }

  .divider::before { left: 0; }
  .divider::after { right: 0; }

  .user {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #555;
  }

  .user-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
  }

  .board {
    display: flex;
    gap: 16px;
    padding: 20px;
    align-items: flex-start;
    overflow-x: auto;
    flex: 1;
  }

  .status {
    text-align: center;
    margin-top: 60px;
    font-size: 15px;
    color: #888;
  }

  .error { color: #c0392b; }
</style>
