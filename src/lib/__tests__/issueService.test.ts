jest.mock('src/database/models/issue');
jest.mock('src/database/models/account');
jest.mock('src/lib/urlSafety');
jest.mock('src/lib/queues', () => ({ scrapeQueue: { add: jest.fn() } }));
jest.mock('src/lib/sheets');

import Issue, { IssueDocument } from 'src/database/models/issue';
import { checkUrlSafety } from 'src/lib/urlSafety';
import { appendIssueRow } from 'src/lib/sheets';
import { upsertFromMessage } from 'src/lib/issueService';

const mockedIssue = Issue as jest.Mocked<typeof Issue>;
const mockedCheckUrlSafety = checkUrlSafety as jest.MockedFunction<
  typeof checkUrlSafety
>;
const mockedAppendIssueRow = appendIssueRow as jest.MockedFunction<
  typeof appendIssueRow
>;

beforeEach(() => {
  mockedIssue.createLink.mockReset();
  mockedCheckUrlSafety.mockReset();
  mockedAppendIssueRow.mockReset();
  mockedCheckUrlSafety.mockResolvedValue({ safe: false, whitelisted: false });
  mockedAppendIssueRow.mockResolvedValue();
});

it('creates a separate issue for each report of the same URL', async () => {
  mockedIssue.createLink
    .mockResolvedValueOnce({ _id: 'first' } as unknown as IssueDocument)
    .mockResolvedValueOnce({ _id: 'second' } as unknown as IssueDocument);

  const url = 'https://example.com/posts/123';
  await upsertFromMessage(url, 'reporter-1');
  await upsertFromMessage(url, 'reporter-2');

  expect(mockedIssue.createLink).toHaveBeenCalledTimes(2);
  expect(mockedIssue.createLink).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ canonicalText: url }),
    'reporter-1'
  );
  expect(mockedIssue.createLink).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ canonicalText: url }),
    'reporter-2'
  );
  expect(mockedIssue.findByUrl).not.toHaveBeenCalled();
});
