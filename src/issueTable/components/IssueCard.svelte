<script>
  import { createEventDispatcher } from 'svelte';

  export let issue;
  export let currentUser;

  const dispatch = createEventDispatcher();

  const STATUS_ACTIONS = {
    processing: 'resolved',
    resolved: 'new',
    cofacts_resolved: 'new',
  };
  const STATUS_ACTION_LABELS = {
    processing: '標記已處理',
    resolved: '重新開啟',
    cofacts_resolved: '重新開啟',
  };

  const SOCIAL_PLATFORMS = new Set([
    'facebook',
    'twitter',
    'instagram',
    'youtube',
    'tiktok',
    'threads',
    'weibo',
  ]);

  const SOCIAL_HOSTS = new Set([
    'facebook.com', 'www.facebook.com', 'fb.com', 'fb.watch', 'm.facebook.com', 'l.facebook.com',
    'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com', 'mobile.twitter.com',
    'instagram.com', 'www.instagram.com',
    'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com',
    'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com',
    'threads.net', 'www.threads.net',
    'weibo.com', 'www.weibo.com', 'weibo.cn', 'm.weibo.cn',
    'linkedin.com', 'www.linkedin.com',
    'dcard.tw', 'www.dcard.tw',
    'ptt.cc', 'www.ptt.cc', 'disp.cc',
    'line.me', 'liff.line.me',
  ]);

  const NEWS_HOSTS = new Set([
    'udn.com', 'www.udn.com',
    'ltn.com.tw', 'news.ltn.com.tw', 'www.ltn.com.tw',
    'chinatimes.com', 'www.chinatimes.com',
    'ettoday.net', 'www.ettoday.net',
    'setn.com', 'www.setn.com',
    'tvbs.com.tw', 'news.tvbs.com.tw', 'www.tvbs.com.tw',
    'cts.com.tw', 'news.cts.com.tw', 'www.cts.com.tw',
    'pts.org.tw', 'news.pts.org.tw', 'www.pts.org.tw',
    'cna.com.tw', 'www.cna.com.tw',
    'storm.mg', 'www.storm.mg',
    'newtalk.tw', 'www.newtalk.tw',
    'today.line.me',
    'yahoo.com', 'tw.yahoo.com', 'tw.news.yahoo.com',
    'pchome.com.tw', 'www.pchome.com.tw',
    'nownews.com', 'www.nownews.com',
    'mirrormedia.mg', 'www.mirrormedia.mg',
    'businessweekly.com.tw', 'www.businessweekly.com.tw',
    'wealth.com.tw', 'www.wealth.com.tw',
    'commonwealthmag.com', 'www.commonwealthmag.com',
    'bnext.com.tw', 'www.bnext.com.tw',
    'technews.tw', 'technews.com.tw',
    'ithome.com.tw', 'www.ithome.com.tw',
    'inside.com.tw', 'www.inside.com.tw',
    'thenewslens.com', 'www.thenewslens.com',
    'twreporter.org', 'www.twreporter.org',
    'cw.com.tw', 'www.cw.com.tw',
  ]);

  const CATEGORY_META = {
    social: { label: '社群網站', color: '#2563eb' },
    news: { label: '新聞網站', color: '#047857' },
    unknown: { label: '未知網站', color: '#e67e22' },
    text: { label: '純文字', color: '#6b7280' },
    image: { label: '圖片', color: '#7c3aed' },
  };

  let showInvestigators = false;
  let commentText = '';
  let isCommentSubmitting = false;

  async function changeStatus() {
    if (!STATUS_ACTIONS[issue.status]) return;

    await fetch(`/api/issues/${issue._id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: STATUS_ACTIONS[issue.status] }),
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

  async function submitComment() {
    const text = commentText.trim();
    if (!text || isCommentSubmitting) return;

    isCommentSubmitting = true;
    const res = await fetch(`/api/issues/${issue._id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    isCommentSubmitting = false;

    if (res.ok) {
      commentText = '';
      dispatch('update');
    }
  }

  function onDragStart(e) {
    e.dataTransfer.setData('issueId', String(issue._id));
    e.dataTransfer.setData('issueStatus', issue.status);
    e.dataTransfer.effectAllowed = 'move';
  }

  function openWithWarning(url) {
    const confirmed = window.confirm(
      '安全提醒\n\n此連結可能含有風險，請確認您信任此來源後再繼續。\n\n前往：' + url
    );
    if (confirmed) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  $: isAdmin = currentUser?.role === 'admin';
  $: canInteract = currentUser?.role === 'admin' || currentUser?.role === 'editor';
  $: isClaimed = canInteract && issue.investigators.some(inv => inv.userId === currentUser.userId);
  $: canClaim = canInteract && !isClaimed && issue.investigators.length < 5;
  $: isLink = issue.inputType === 'link';
  $: category = getIssueCategory(issue);
  $: categoryMeta = CATEGORY_META[category] ?? CATEGORY_META.unknown;
  $: comments = issue.comments ?? [];
  $: canSubmitComment = commentText.trim().length > 0 && !isCommentSubmitting;

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

  function getIssueCategory(issue) {
    if (issue.inputType === 'image') return 'image';
    if (issue.inputType !== 'link') return 'text';
    if (SOCIAL_PLATFORMS.has(issue.platform)) return 'social';

    try {
      const hostname = new URL(issue.canonicalText).hostname.toLowerCase();
      if (SOCIAL_HOSTS.has(hostname)) return 'social';
      return NEWS_HOSTS.has(hostname) ? 'news' : 'unknown';
    } catch {
      return 'unknown';
    }
  }
</script>

<div
  class="card"
  class:unsafe={issue.isUnsafe}
  class:draggable={canInteract}
  draggable={canInteract}
  on:dragstart={onDragStart}
>
  <!-- Content category badge -->
  <div class="category-row">
    <span class="category-badge" style="background:{categoryMeta.color}">
      {categoryMeta.label}
    </span>
    {#if isLink}
      {#if issue.accountHandle}
        <span class="account">{issue.accountHandle}</span>
      {/if}
      {#if issue.isUnsafe}
        <span class="unsafe-flag">危險連結</span>
      {:else if issue.accountDiscontinued}
        <span class="discontinued-flag">帳號停止追蹤</span>
      {:else if issue.isUnknownSite}
        <span class="unknown-flag">待審查</span>
      {/if}
    {/if}
  </div>

  <!-- Message text / URL display -->
  {#if isLink}
    <button
      class="text link-btn"
      title={issue.canonicalText}
      on:click={() => openWithWarning(issue.canonicalText)}
    >
      {shortUrl(issue.canonicalText)}
    </button>
  {:else}
    <p class="text">{issue.canonicalText}</p>
  {/if}

  <div class="meta">
    <span class="badge">回報 {issue.reporterIds.length} 人</span>
    <button
      class="badge badge-btn"
      class:has-investigators={issue.investigators.length > 0}
      on:click={() => (showInvestigators = !showInvestigators)}
      title="點擊查看認領調查員"
    >
      認領 {issue.investigators.length}/5
    </button>
    <span class="time">{formatDate(issue.createdAt)}</span>
  </div>

  {#if showInvestigators}
    <div class="investigators-popover">
      {#if issue.investigators.length === 0}
        <span class="no-inv">尚無認領</span>
      {:else}
        {#each issue.investigators as inv}
          <div class="inv-row">
            <img src={inv.pictureUrl} alt={inv.name} class="avatar" />
            <span class="inv-name">{inv.name}</span>
          </div>
        {/each}
      {/if}
    </div>
  {/if}

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

  {#if comments.length > 0 || canInteract}
    <div class="comments">
      {#if comments.length > 0}
        <div class="comment-list">
          {#each comments as comment}
            <div class="comment">
              <img src={comment.pictureUrl} alt={comment.name} class="comment-avatar" />
              <div class="comment-body">
                <div class="comment-meta">
                  <span class="comment-name">{comment.name}</span>
                  <span class="comment-time">{formatDate(comment.createdAt)}</span>
                </div>
                <p class="comment-text">{comment.text}</p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
      {#if canInteract}
        <form class="comment-form" on:submit|preventDefault={submitComment}>
          <textarea
            bind:value={commentText}
            class="comment-input"
            rows="2"
            placeholder="留言…"
            disabled={isCommentSubmitting}
            on:mousedown|stopPropagation
            on:dragstart|stopPropagation
          />
          <button
            type="submit"
            class="comment-submit"
            disabled={!canSubmitComment}
            on:mousedown|stopPropagation
          >
            送出
          </button>
        </form>
      {/if}
    </div>
  {/if}

  {#if canInteract}
    <div class="actions">
      {#if isClaimed}
        <button class="btn btn-secondary" on:click={toggleClaim}>取消認領</button>
      {:else if canClaim}
        <button class="btn btn-primary" on:click={toggleClaim}>認領調查</button>
      {/if}
      {#if isAdmin && STATUS_ACTIONS[issue.status]}
        <button class="btn btn-move" on:click={changeStatus}>{STATUS_ACTION_LABELS[issue.status]}</button>
      {/if}
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

  .card.draggable {
    cursor: grab;
  }

  .card.draggable:active { cursor: grabbing; }

  .card.unsafe {
    border-left: 3px solid #e74c3c;
    background: #fff8f8;
  }

  .category-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .category-badge {
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

  .unsafe-flag {
    font-size: 11px;
    background: #c0392b;
    color: #fff;
    border-radius: 4px;
    padding: 2px 6px;
    margin-left: auto;
    font-weight: 600;
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

  .link-btn {
    display: block;
    width: 100%;
    text-align: left;
    font-size: 14px;
    line-height: 1.5;
    margin: 0 0 8px;
    padding: 0;
    border: none;
    background: none;
    color: #1a73e8;
    cursor: pointer;
    word-break: break-all;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: inherit;
  }

  .link-btn:hover { text-decoration: underline; }

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

  .badge-btn {
    border: none;
    cursor: pointer;
    font-family: inherit;
  }

  .badge-btn.has-investigators {
    background: #e8f0fe;
    color: #1a73e8;
  }

  .badge-btn:hover {
    background: #d2e3fc;
    color: #1558b0;
  }

  .time {
    font-size: 11px;
    color: #999;
    margin-left: auto;
  }

  .investigators-popover {
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .inv-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .inv-name {
    font-size: 12px;
    color: #333;
  }

  .no-inv {
    font-size: 12px;
    color: #aaa;
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  .comments {
    margin-bottom: 8px;
  }

  .comment-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 8px;
  }

  .comment {
    display: flex;
    gap: 8px;
  }

  .comment-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .comment-body {
    min-width: 0;
    flex: 1;
  }

  .comment-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
  }

  .comment-name {
    font-size: 11px;
    font-weight: 600;
    color: #555;
  }

  .comment-time {
    font-size: 10px;
    color: #aaa;
  }

  .comment-text {
    font-size: 12px;
    line-height: 1.45;
    color: #333;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .comment-form {
    display: flex;
    gap: 6px;
    align-items: flex-end;
  }

  .comment-input {
    flex: 1;
    min-width: 0;
    resize: vertical;
    font-family: inherit;
    font-size: 12px;
    line-height: 1.4;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 5px 7px;
  }

  .comment-input:focus {
    outline: none;
    border-color: #1a73e8;
  }

  .comment-submit {
    font-size: 12px;
    padding: 5px 9px;
    border-radius: 4px;
    border: none;
    background: #1a73e8;
    color: #fff;
    cursor: pointer;
  }

  .comment-submit:disabled {
    background: #ddd;
    color: #888;
    cursor: not-allowed;
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
