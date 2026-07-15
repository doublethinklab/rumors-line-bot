import askingAdvancedDescription from '../askingAdvancedDescription';
import { Context } from 'src/types/chatbotState';

const baseContext: Context = { sessionId: 1, msgs: [] };

it('replies with the decline message when the user chooses 否', async () => {
  const result = await askingAdvancedDescription({
    context: baseContext,
    postbackData: {
      state: 'ASKING_ADVANCED_DESCRIPTION',
      sessionId: 1,
      input: { choice: 'no', issueId: 'issue-1' },
    },
    userId: 'user-1',
  });

  expect(result.context).toBe(baseContext);
  expect(result.replies).toMatchSnapshot();
});

it('asks for the description text and remembers the issue id when the user chooses 是', async () => {
  const result = await askingAdvancedDescription({
    context: baseContext,
    postbackData: {
      state: 'ASKING_ADVANCED_DESCRIPTION',
      sessionId: 1,
      input: { choice: 'yes', issueId: 'issue-1' },
    },
    userId: 'user-1',
  });

  expect(result.context.awaitingDescriptionForIssueId).toBe('issue-1');
  expect(result.replies).toMatchSnapshot();
});
