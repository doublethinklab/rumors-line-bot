import askingMediaSource from '../askingMediaSource';
import { Context } from 'src/types/chatbotState';

const baseContext: Context = { sessionId: 123, msgs: [] };

it('asks for a source URL and remembers the media report when the user chooses 是', async () => {
  const result = await askingMediaSource({
    context: baseContext,
    postbackData: {
      state: 'ASKING_MEDIA_SOURCE',
      sessionId: 123,
      input: { choice: 'yes', issueId: 'issue-1', inputType: 'image' },
    },
    userId: 'user-1',
  });

  expect(result.context.awaitingMediaSource).toEqual({
    issueId: 'issue-1',
    inputType: 'image',
  });
  expect(result.replies).toEqual([
    { type: 'text', text: '請附上該圖片原始來源（請附上連結）。' },
  ]);
});

it('continues to the advanced-description question when the user chooses 否', async () => {
  const result = await askingMediaSource({
    context: baseContext,
    postbackData: {
      state: 'ASKING_MEDIA_SOURCE',
      sessionId: 123,
      input: { choice: 'no', issueId: 'issue-2', inputType: 'video' },
    },
    userId: 'user-1',
  });

  expect(result.context).toBe(baseContext);
  expect(result.replies[0]).toMatchObject({
    type: 'template',
    altText: expect.stringContaining('影片內容'),
  });
});
