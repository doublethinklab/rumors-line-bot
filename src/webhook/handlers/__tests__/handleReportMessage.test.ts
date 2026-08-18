jest.mock('src/lib/issueService');
jest.mock('../processMedia', () => jest.fn());

import MockDate from 'mockdate';
import type { IssueDocument } from 'src/database/models/issue';
import handleReportMessage from '../handleReportMessage';
import { upsertFromMessage } from 'src/lib/issueService';
import originalHandleMediaReport from '../processMedia';

const mockUpsertFromMessage = upsertFromMessage as jest.MockedFunction<
  typeof upsertFromMessage
>;
const handleMediaReport = originalHandleMediaReport as jest.MockedFunction<
  typeof originalHandleMediaReport
>;

beforeEach(() => {
  MockDate.set(1000);
  mockUpsertFromMessage.mockReset();
  handleMediaReport.mockReset();
});

afterEach(() => {
  MockDate.reset();
});

it('acks a plain text report without asking for advanced description', async () => {
  mockUpsertFromMessage.mockResolvedValueOnce({
    _id: 'issue-1',
  } as unknown as IssueDocument);

  const result = await handleReportMessage(
    { id: 'm1', type: 'text', text: 'hello world' },
    'user-1'
  );
  expect(mockUpsertFromMessage).toHaveBeenCalledWith('hello world', 'user-1');
  expect(result.replies).toMatchSnapshot();
});

it('acks a link report and asks for advanced description, naming the platform', async () => {
  mockUpsertFromMessage.mockResolvedValueOnce({
    _id: 'issue-2',
  } as unknown as IssueDocument);

  const result = await handleReportMessage(
    {
      id: 'm2',
      type: 'text',
      text: '看看這個 https://www.facebook.com/someone/posts/123',
    },
    'user-1'
  );

  expect(result.replies).toMatchSnapshot();
});

it('delegates image/video messages to handleMediaReport', async () => {
  const mediaResult = {
    context: { sessionId: 1, msgs: [] },
    replies: [{ type: 'text' as const, text: 'media reply' }],
  };
  handleMediaReport.mockResolvedValueOnce(mediaResult);

  const message = { id: 'm3', type: 'image' as const };
  const result = await handleReportMessage(message, 'user-1');

  expect(handleMediaReport).toHaveBeenCalledWith(message, 'user-1');
  expect(result).toBe(mediaResult);
});
