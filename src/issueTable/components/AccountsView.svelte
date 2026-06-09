<script>
  import { createEventDispatcher } from 'svelte';

  export let accounts = [];
  export let isAdmin = false;

  const dispatch = createEventDispatcher();

  const STATUS_LABEL = {
    watching: '監控中',
    discontinued: '停止追蹤',
    cleared: '已排除',
  };

  const STATUS_COLOR = {
    watching: '#27ae60',
    discontinued: '#e74c3c',
    cleared: '#95a5a6',
  };

  const PLATFORM_LABEL = {
    facebook: 'FB', twitter: 'X', instagram: 'IG',
    youtube: 'YT', tiktok: 'TT', threads: 'TH', unknown: '?',
  };

  let editingId = null;
  let editNotes = '';
  let editStatus = '';

  function startEdit(account) {
    editingId = String(account._id);
    editNotes = account.notes ?? '';
    editStatus = account.status;
  }

  async function saveEdit(account) {
    await fetch(`/api/issues/accounts/${account._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: editStatus, notes: editNotes }),
    });
    editingId = null;
    dispatch('update');
  }

  function cancelEdit() {
    editingId = null;
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('zh-TW');
  }
</script>

<div class="accounts-view">
  {#if accounts.length === 0}
    <p class="empty">尚無帳號紀錄</p>
  {:else}
    <table class="table">
      <thead>
        <tr>
          <th>平台</th>
          <th>帳號</th>
          <th>狀態</th>
          <th>議題數</th>
          <th>首次出現</th>
          <th>最近出現</th>
          <th>備註</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each accounts as account (String(account._id))}
          <tr class:discontinued={account.status === 'discontinued'}>
            <td>
              <span class="platform-chip">{PLATFORM_LABEL[account.platform] ?? account.platform}</span>
            </td>
            <td class="handle">
              {#if account.profileUrl}
                <a href={account.profileUrl} target="_blank" rel="noopener noreferrer">{account.handle}</a>
              {:else}
                {account.handle}
              {/if}
            </td>
            <td>
              {#if editingId === String(account._id)}
                <select bind:value={editStatus} class="select-status">
                  <option value="watching">監控中</option>
                  <option value="discontinued">停止追蹤</option>
                  <option value="cleared">已排除</option>
                </select>
              {:else}
                <span class="status-badge" style="background:{STATUS_COLOR[account.status]}">
                  {STATUS_LABEL[account.status]}
                </span>
              {/if}
            </td>
            <td class="center">{account.issueCount}</td>
            <td class="date">{formatDate(account.firstSeenAt)}</td>
            <td class="date">{formatDate(account.lastSeenAt)}</td>
            <td class="notes-cell">
              {#if editingId === String(account._id)}
                <textarea bind:value={editNotes} rows="2" class="notes-input" placeholder="備註…" />
              {:else}
                <span class="notes-text">{account.notes ?? '—'}</span>
              {/if}
            </td>
            {#if isAdmin}
              <td class="actions-cell">
                {#if editingId === String(account._id)}
                  <button class="btn-save" on:click={() => saveEdit(account)}>儲存</button>
                  <button class="btn-cancel" on:click={cancelEdit}>取消</button>
                {:else}
                  <button class="btn-edit" on:click={() => startEdit(account)}>編輯</button>
                {/if}
              </td>
            {:else}
              <td></td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .accounts-view {
    padding: 16px;
    overflow-x: auto;
  }

  .empty {
    color: #aaa;
    text-align: center;
    margin-top: 40px;
  }

  .table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  th {
    background: #f4f5f7;
    padding: 10px 12px;
    text-align: left;
    font-weight: 600;
    color: #555;
    border-bottom: 1px solid #e0e0e0;
  }

  td {
    padding: 10px 12px;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: middle;
  }

  tr.discontinued td {
    opacity: 0.55;
  }

  .platform-chip {
    font-size: 11px;
    font-weight: 700;
    background: #e8eaed;
    border-radius: 4px;
    padding: 2px 6px;
    color: #333;
  }

  .handle {
    font-family: monospace;
    font-size: 13px;
  }

  .handle a {
    color: #1a73e8;
    text-decoration: none;
  }

  .status-badge {
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    border-radius: 4px;
    padding: 2px 8px;
    white-space: nowrap;
  }

  .center { text-align: center; }

  .date {
    color: #888;
    white-space: nowrap;
  }

  .notes-cell { max-width: 200px; }

  .notes-text {
    color: #666;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .notes-input {
    width: 100%;
    font-size: 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 4px;
    resize: vertical;
  }

  .select-status {
    font-size: 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 3px 6px;
  }

  .actions-cell { white-space: nowrap; }

  .btn-edit, .btn-save, .btn-cancel {
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    margin-left: 4px;
  }

  .btn-edit { background: #e8eaed; color: #333; }
  .btn-save { background: #06c755; color: #fff; }
  .btn-cancel { background: #e0e0e0; color: #555; }
</style>
