<script>
  import { createEventDispatcher } from 'svelte';

  export let users = [];

  const dispatch = createEventDispatcher();

  const ROLE_LABEL = { viewer: '觀看者', editor: '調查員' };
  const ROLE_COLOR = { viewer: '#888', editor: '#06c755' };

  function formatDate(d) {
    return new Date(d).toLocaleString('zh-TW', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  async function toggleRole(user) {
    const newRole = user.role === 'editor' ? 'viewer' : 'editor';
    await fetch(`/api/issues/line-users/${user.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    dispatch('update');
  }
</script>

<div class="investigators-view">
  {#if users.length === 0}
    <p class="empty">尚無 LINE 登入紀錄</p>
  {:else}
    <table class="table">
      <thead>
        <tr>
          <th>頭像</th>
          <th>名稱</th>
          <th>角色</th>
          <th>最後登入</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {#each users as user (user.userId)}
          <tr>
            <td>
              <img src={user.pictureUrl} alt={user.name} class="avatar" />
            </td>
            <td class="name">{user.name}</td>
            <td>
              <span class="role-badge" style="background:{ROLE_COLOR[user.role]}">
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </td>
            <td class="date">{formatDate(user.lastLoginAt)}</td>
            <td>
              {#if user.role === 'editor'}
                <button class="btn btn-revoke" on:click={() => toggleRole(user)}>
                  撤銷調查員
                </button>
              {:else}
                <button class="btn btn-grant" on:click={() => toggleRole(user)}>
                  授予調查員
                </button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .investigators-view {
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

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }

  .name {
    font-weight: 500;
  }

  .role-badge {
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    border-radius: 4px;
    padding: 2px 8px;
    white-space: nowrap;
  }

  .date {
    color: #888;
    white-space: nowrap;
  }

  .btn {
    font-size: 12px;
    padding: 4px 12px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-grant { background: #06c755; color: #fff; }
  .btn-revoke { background: #e0e0e0; color: #333; }
</style>
