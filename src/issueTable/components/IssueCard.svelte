<script>
  import { createEventDispatcher } from 'svelte';

  export let issue;
  export let currentUser;

  const dispatch = createEventDispatcher();

  const NEXT_STATUS = { new: 'processing', processing: 'resolved', resolved: 'new' };
  const NEXT_LABEL = { new: '移至處理中', processing: '標記已處理', resolved: '重新開啟' };

  const PLATFORM_LABEL = {
    facebook: 'Facebook',
    twitter: 'X / Twitter',
    instagram: 'Instagram',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    threads: 'Threads',
    unknown: '未知網站',
  };

  const PLATFORM_COLOR = {
    facebook: '#1877f2',
    twitter: '#000',
    instagram: '#e1306c',
    youtube: '#ff0000',
    tiktok: '#010101',
    threads: '#000',
    unknown: '#e67e22',
  };

  async function changeStatus() {
    await fetch(`/api/issues/${issue._id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: NEXT_STATUS[issue.status] }),
    });
    dispatch('update');
  }

  async function toggleClaim() {
    if (isClaimed) {
      await fetch(`/api/issues/${issue._id}/investigators`, { method: 'DELETE' });
    } else {
      await fetch(`/api/issues/${issue._id}/investigators`, { method: 'POST' });
    }
    dispatch('update');
  }

  $: isAdmin = currentUser?.role === 'admin';
  $: isClaimed = isAdmin && issue.investigators.some(inv => inv.userId === currentUser.userId);
  $: canClaim = isAdmin && !isClaimed && issue.investigators.length < 5;
  $: isLink = issue.inputType === 'link';
  $: platformColor = PLATFORM_COLOR[issue.platform] ?? '#888';

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString('zh-TW', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function shortUrl(url) {
    try {
      const u = new URL(url);
      return u.hostname + u.pathname.slice(0, 30) + (u.pathname.length > 30 ? '…' : '');
    } catch {
      return url.slice(0, 40);
    }
  }
</script>

<div class="card">
  <!-- Platform badge for link-type issues -->
  {#if isLink}
    <div class="platform-row">
      <span class="platform-badge" style="background:{platformColor}">
        {PLATFORM_LABEL[issue.platform] ?? issue.platform}
      </span>
      {#if issue.accountHandle}
        <span class="account">{issue.accountHandle}</span>
      {/if}
      {#if issue.accountDiscontinued}
        <span class="discontinued-flag">帳號停止追蹤</span>
      {:else if issue.isUnknownSite}
        <span class="unknown-flag">待審查</span>
      {/if}
    </div>
  {/if}

  <!-- Message text / URL display -->
  {#if isLink}
    {#if issue.isUnknownSite}
      <p class="text defanged" title={issue.canonicalText}>{issue.defangedUrl}</p>
    {:else}
      <a class="text link" href={issue.canonicalText} target="_blank" rel="noopener noreferrer">
        {shortUrl(issue.canonicalText)}
      </a>
    {/if}
  {:else}
    <p class="text">{issue.canonicalText}</p>
  {/if}

  <div class="meta">
    <span class="badge">回報 {issue.reporterIds.length} 人</span>
    <span class="badge">調查員 {issue.investigators.length}/5</span>
    <span class="time">{formatDate(issue.createdAt)}</span>
  </div>

  <!-- Analyst notes (shown when present) -->
  {#if issue.analystNotes}
    <p class="analyst-notes">{issue.analystNotes}</p>
  {/if}

  <!-- AI summary (shown when available) -->
  {#if issue.aiSummary}
    <details class="summary-block">
      <summary>AI 摘要</summary>
      <p class="summary-text">{issue.aiSummary}</p>
    </details>
  {:else if issue.scrapeStatus === 'pending'}
    <p class="scrape-pending">分析中…</p>
  {:else if issue.scrapeStatus === 'failed'}
    <p class="scrape-failed">無法擷取內容</p>
  {/if}

  {#if issue.investigators.length > 0}
    <div class="investigators">
      {#each issue.investigators as inv}
        <img src={inv.pictureUrl} alt={inv.name} title={inv.name} class="avatar" />
      {/each}
    </div>
  {/if}

  {#if isAdmin}
    <div class="actions">
      {#if isClaimed}
        <button class="btn btn-secondary" on:click={toggleClaim}>取消認領</button>
      {:else if canClaim}
        <button class="btn btn-primary" on:click={toggleClaim}>認領調查</button>
      {/if}
      <button class="btn btn-move" on:click={changeStatus}>{NEXT_LABEL[issue.status]}</button>
    </div>
  {/if}
</div>

<style>
  .card {
    background: #fff;
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  }

  .platform-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .platform-badge {
    font-size: 10px;
    font-weight: 600;
    color: #fff;
    border-radius: 4px;
    padding: 2px 6px;
    white-space: nowrap;
  }

  .account {
    font-size: 12px;
    color: #555;
    font-family: monospace;
  }

  .unknown-flag {
    font-size: 11px;
    background: #ffeeba;
    color: #856404;
    border-radius: 4px;
    padding: 2px 6px;
    margin-left: auto;
  }

  .discontinued-flag {
    font-size: 11px;
    background: #fde8e8;
    color: #c0392b;
    border-radius: 4px;
    padding: 2px 6px;
    margin-left: auto;
  }

  .text {
    font-size: 14px;
    line-height: 1.5;
    margin: 0 0 8px;
    word-break: break-all;
    max-height: 80px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }

  a.text.link {
    color: #1a73e8;
    text-decoration: none;
    display: block;
  }

  a.text.link:hover {
    text-decoration: underline;
  }

  .defanged {
    font-family: monospace;
    font-size: 12px;
    color: #e67e22;
    background: #fff8e1;
    border-radius: 4px;
    padding: 4px 6px;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }

  .badge {
    font-size: 11px;
    background: #f0f0f0;
    border-radius: 4px;
    padding: 2px 6px;
    color: #555;
  }

  .time {
    font-size: 11px;
    color: #999;
    margin-left: auto;
  }

  .investigators {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }

  .avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  .btn {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
  }

  .btn-primary { background: #06c755; color: #fff; }
  .btn-secondary { background: #e0e0e0; color: #333; }
  .btn-move { background: #4a90d9; color: #fff; margin-left: auto; }

  .summary-block {
    margin-bottom: 8px;
    font-size: 12px;
  }

  .summary-block summary {
    cursor: pointer;
    color: #555;
    user-select: none;
  }

  .summary-text {
    margin: 4px 0 0;
    line-height: 1.5;
    color: #333;
    background: #f9f9f9;
    border-left: 3px solid #4a90d9;
    padding: 6px 8px;
    border-radius: 0 4px 4px 0;
    white-space: pre-wrap;
  }

  .scrape-pending {
    font-size: 11px;
    color: #aaa;
    margin: 0 0 8px;
  }

  .scrape-failed {
    font-size: 11px;
    color: #e74c3c;
    margin: 0 0 8px;
  }

  .analyst-notes {
    font-size: 12px;
    color: #555;
    background: #fffbe6;
    border-left: 3px solid #f5a623;
    border-radius: 0 4px 4px 0;
    padding: 5px 8px;
    margin: 0 0 8px;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
