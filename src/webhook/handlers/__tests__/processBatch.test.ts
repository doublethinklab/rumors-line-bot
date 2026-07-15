jest.mock('../handleReportMessage', () => jest.fn());

import processBatch from '../processBatch';
import originalHandleReportMessage from '../handleReportMessage';

const handleReportMessage = originalHandleReportMessage as jest.MockedFunction<
  typeof originalHandleReportMessage
>;

beforeEach(() => {
  handleReportMessage.mockReset();
});

it("processes each message in order and only keeps the last one's advanced-description prompt", async () => {
  handleReportMessage
    .mockResolvedValueOnce({
      context: { sessionId: 1, msgs: [] },
      replies: [
        { type: 'text', text: 'ack 1' },
        {
          type: 'template',
          altText: 'prompt 1',
          template: { type: 'confirm', text: 'p', actions: [] },
        },
      ],
    })
    .mockResolvedValueOnce({
      context: { sessionId: 2, msgs: [] },
      replies: [
        { type: 'text', text: 'ack 2' },
        {
          type: 'template',
          altText: 'prompt 2',
          template: { type: 'confirm', text: 'p', actions: [] },
        },
      ],
    });

  const result = await processBatch(
    [
      { id: 'm1', type: 'text', text: 'a' },
      { id: 'm2', type: 'text', text: 'b' },
    ],
    'user-1'
  );

  expect(handleReportMessage).toHaveBeenNthCalledWith(
    1,
    { id: 'm1', type: 'text', text: 'a' },
    'user-1'
  );
  expect(handleReportMessage).toHaveBeenNthCalledWith(
    2,
    { id: 'm2', type: 'text', text: 'b' },
    'user-1'
  );

  expect(result.context.sessionId).toBe(2);
  expect(result.replies).toEqual([
    { type: 'text', text: 'ack 1' },
    { type: 'text', text: 'ack 2' },
    {
      type: 'template',
      altText: 'prompt 2',
      template: { type: 'confirm', text: 'p', actions: [] },
    },
  ]);
});

it('caps the combined replies at the LINE 5-message limit', async () => {
  for (let i = 0; i < 6; i += 1) {
    handleReportMessage.mockResolvedValueOnce({
      context: { sessionId: i, msgs: [] },
      replies: [{ type: 'text', text: `ack ${i}` }],
    });
  }

  const messages = Array.from({ length: 6 }, (_, i) => ({
    id: `m${i}`,
    type: 'text' as const,
    text: `msg ${i}`,
  }));

  const result = await processBatch(messages, 'user-1');

  expect(result.replies).toHaveLength(5);
});
