<script>
  import { createEventDispatcher } from 'svelte';
  import IssueCard from './IssueCard.svelte';

  export let title;
  export let issues;
  export let currentUser;

  const dispatch = createEventDispatcher();
</script>

<div class="column">
  <div class="column-header">
    <span class="column-title">{title}</span>
    <span class="count">{issues.length}</span>
  </div>

  <div class="cards">
    {#if issues.length === 0}
      <p class="empty">無議題</p>
    {:else}
      {#each issues as issue (String(issue._id))}
        <IssueCard {issue} {currentUser} on:update={() => dispatch('update')} />
      {/each}
    {/if}
  </div>
</div>

<style>
  .column {
    flex: 1;
    min-width: 280px;
    max-width: 380px;
    background: #f4f5f7;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .column-title {
    font-size: 15px;
    font-weight: 600;
    color: #333;
  }

  .count {
    font-size: 12px;
    background: #ddd;
    border-radius: 10px;
    padding: 1px 8px;
    color: #555;
  }

  .cards {
    flex: 1;
    overflow-y: auto;
    max-height: calc(100vh - 180px);
  }

  .empty {
    font-size: 13px;
    color: #aaa;
    text-align: center;
    margin-top: 20px;
  }
</style>
