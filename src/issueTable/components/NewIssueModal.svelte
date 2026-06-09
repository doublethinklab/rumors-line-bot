<script>
  import { createEventDispatcher } from 'svelte';

  export let open = false;

  const dispatch = createEventDispatcher();

  let content = '';
  let notes = '';
  let submitting = false;
  let error = null;

  function close() {
    if (submitting) return;
    open = false;
    content = '';
    notes = '';
    error = null;
  }

  async function submit() {
    const trimmed = content.trim();
    if (!trimmed) return;

    submitting = true;
    error = null;

    try {
      const res = await fetch('/api/issues/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed, notes: notes.trim() || undefined }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      dispatch('created');
      close();
    } catch (e) {
      error = e.message;
    } finally {
      submitting = false;
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
  }

  // Detect whether content looks like a URL for placeholder hint
  $: looksLikeUrl = /^https?:\/\//i.test(content.trim());
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <!-- Backdrop -->
  <div class="backdrop" on:click={close} aria-hidden="true" />

  <div class="modal" role="dialog" aria-modal="true" aria-label="新增議題">
    <div class="modal-header">
      <h2>新增議題</h2>
      <button class="close-btn" on:click={close} aria-label="關閉">✕</button>
    </div>

    <div class="modal-body">
      <label class="field">
        <span class="label">內容 <span class="required">*</span></span>
        <textarea
          bind:value={content}
          rows="4"
          placeholder="貼上 URL 或輸入訊息文字…"
          class="textarea"
          disabled={submitting}
          autofocus
        />
        {#if looksLikeUrl}
          <span class="hint">偵測到 URL，將自動解析平台與帳號</span>
        {/if}
      </label>

      <label class="field">
        <span class="label">備註（選填）</span>
        <textarea
          bind:value={notes}
          rows="2"
          placeholder="初步觀察、來源說明…"
          class="textarea"
          disabled={submitting}
        />
      </label>

      {#if error}
        <p class="error-msg">{error}</p>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn-cancel" on:click={close} disabled={submitting}>取消</button>
      <button
        class="btn-submit"
        on:click={submit}
        disabled={submitting || !content.trim()}
      >
        {submitting ? '送出中…' : '新增議題'}
      </button>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 100;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 101;
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
    width: 480px;
    max-width: calc(100vw - 32px);
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    border-bottom: 1px solid #f0f0f0;
  }

  h2 {
    margin: 0;
    font-size: 16px;
    color: #333;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 16px;
    color: #999;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
  }

  .close-btn:hover { color: #333; }

  .modal-body {
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .label {
    font-size: 13px;
    font-weight: 600;
    color: #444;
  }

  .required {
    color: #e74c3c;
  }

  .textarea {
    font-size: 13px;
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    resize: vertical;
    font-family: inherit;
    line-height: 1.5;
    transition: border-color 0.15s;
  }

  .textarea:focus {
    outline: none;
    border-color: #4a90d9;
  }

  .hint {
    font-size: 11px;
    color: #1a73e8;
  }

  .error-msg {
    font-size: 12px;
    color: #e74c3c;
    margin: 0;
    background: #fde8e8;
    border-radius: 4px;
    padding: 6px 10px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px 16px;
    border-top: 1px solid #f0f0f0;
  }

  .btn-cancel, .btn-submit {
    font-size: 13px;
    padding: 7px 18px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
  }

  .btn-cancel {
    background: #e8eaed;
    color: #333;
  }

  .btn-submit {
    background: #1a73e8;
    color: #fff;
    font-weight: 600;
  }

  .btn-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-cancel:hover:not(:disabled) { background: #ddd; }
  .btn-submit:hover:not(:disabled) { background: #1558b0; }
</style>
