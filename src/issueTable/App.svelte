<script>
  import { onMount, onDestroy } from 'svelte';
  import Column from './components/Column.svelte';
  import AccountsView from './components/AccountsView.svelte';

  let issues = [];
  let accounts = [];
  let currentUser = null;
  let loading = true;
  let error = null;
  let activeTab = 'board'; // 'board' | 'accounts'

  let pollInterval;

  onMount(async () => {
    const meRes = await fetch('/api/issues/me');
    if (!meRes.ok) {
      window.location.href = '/issues-login';
      return;
    }
    currentUser = await meRes.json();

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

    {#if currentUser}
      <div class="user">
        <img src={currentUser.pictureUrl} alt={currentUser.name} class="user-avatar" />
        <span>{currentUser.name}</span>
      </div>
    {/if}
  </header>

  {#if loading}
    <p class="status">載入中…</p>
  {:else if error}
    <p class="status error">{error}</p>
  {:else if activeTab === 'board'}
    <div class="board">
      <Column title="新議題" issues={newIssues} {currentUser} on:update={loadAll} />
      <Column title="處理中" issues={processingIssues} {currentUser} on:update={loadAll} />
      <Column title="已處理" issues={resolvedIssues} {currentUser} on:update={loadAll} />
    </div>
  {:else}
    <AccountsView {accounts} on:update={loadAll} />
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
