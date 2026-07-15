jest.mock('src/webhook/lineClient');
jest.mock('src/lib/ga');
jest.mock('src/lib/driveUpload');
jest.mock('src/lib/issueService');

import MockDate from 'mockdate';
import type { IssueDocument } from 'src/database/models/issue';
import handleMediaReport from '../processMedia';
import originalLineClient from 'src/webhook/lineClient';
import originalGa from 'src/lib/ga';
import { uploadToDrive } from 'src/lib/driveUpload';
import { upsertFromMedia } from 'src/lib/issueService';
import type { MockedGa } from 'src/lib/__mocks__/ga';

const lineClient = originalLineClient as jest.Mocked<typeof originalLineClient>;
const ga = originalGa as MockedGa;
const mockUploadToDrive = uploadToDrive as jest.MockedFunction<
  typeof uploadToDrive
>;
const mockUpsertFromMedia = upsertFromMedia as jest.MockedFunction<
  typeof upsertFromMedia
>;

beforeEach(() => {
  ga.clearAllMocks();
  lineClient.post.mockClear();
  mockUploadToDrive.mockReset();
  mockUpsertFromMedia.mockReset();
});

it('uploads an image to Drive, creates an issue, and asks for advanced description', async () => {
  MockDate.set('2020-01-01');

  lineClient.getContent.mockResolvedValueOnce({
    headers: new Map([['content-type', 'image/png']]),
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  mockUploadToDrive.mockResolvedValueOnce(
    'https://drive.google.com/file/d/xyz/view'
  );
  mockUpsertFromMedia.mockResolvedValueOnce({
    _id: 'issue-id-1',
  } as unknown as IssueDocument);

  const result = await handleMediaReport(
    { type: 'image', id: 'msg-1' },
    'user-1'
  );

  MockDate.reset();

  expect(mockUploadToDrive).toHaveBeenCalledWith(
    expect.stringContaining('msg-1'),
    expect.any(Buffer),
    'image/png'
  );
  expect(mockUpsertFromMedia).toHaveBeenCalledWith(
    'image',
    'https://drive.google.com/file/d/xyz/view',
    'user-1'
  );
  expect(result.replies).toMatchSnapshot();
});

it('uploads a video to Drive, creates an issue, and asks for advanced description', async () => {
  lineClient.getContent.mockResolvedValueOnce({
    headers: new Map([['content-type', 'video/mp4']]),
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  mockUploadToDrive.mockResolvedValueOnce(
    'https://drive.google.com/file/d/abc/view'
  );
  mockUpsertFromMedia.mockResolvedValueOnce({
    _id: 'issue-id-2',
  } as unknown as IssueDocument);

  const result = await handleMediaReport(
    { type: 'video', id: 'msg-2' },
    'user-1'
  );

  expect(mockUploadToDrive).toHaveBeenCalledWith(
    expect.stringContaining('msg-2'),
    expect.any(Buffer),
    'video/mp4'
  );
  expect(mockUpsertFromMedia).toHaveBeenCalledWith(
    'video',
    'https://drive.google.com/file/d/abc/view',
    'user-1'
  );
  expect(result.replies).toMatchSnapshot();
});
