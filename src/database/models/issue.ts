import { ObjectId } from 'mongodb';
import mongoClient from '../mongoClient';
import type { Platform } from 'src/lib/urlParser';

export type IssueStatus = 'new' | 'processing' | 'resolved' | 'cofacts_resolved';
export type InputType = 'text' | 'link';

export interface Investigator {
  userId: string;
  name: string;
  pictureUrl: string;
  claimedAt: Date;
}

export type ScrapeStatus = 'pending' | 'done' | 'failed';

export interface IssueDocument {
  _id?: ObjectId;
  inputType: InputType;
  canonicalText: string;   // for text issues: message content; for link issues: original URL
  status: IssueStatus;
  reporterIds: string[];
  investigators: Investigator[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  // link-specific fields
  platform?: Platform;
  accountHandle?: string;
  accountId?: ObjectId;      // ref to accounts collection
  isUnknownSite?: boolean;
  defangedUrl?: string;      // legacy field — no longer written to new issues
  accountDiscontinued?: boolean; // true when account was already known+discontinued
  isUnsafe?: boolean;        // true when URL failed safety checks
  // analyst-submitted notes
  analystNotes?: string;
  // scraping fields
  scrapeStatus?: ScrapeStatus;
  scrapedText?: string;
  aiSummary?: string;
  scrapedAt?: Date;
}

const COLLECTION = 'issues';

async function getCollection() {
  const client = await mongoClient.getInstance();
  return await client.collection(COLLECTION);
}

const Issue = {
  async findAll(): Promise<IssueDocument[]> {
    const col = await getCollection();
    return col.find({}).sort({ createdAt: -1 }).toArray();
  },

  async findById(id: string): Promise<IssueDocument | null> {
    const col = await getCollection();
    return col.findOne({ _id: new ObjectId(id) });
  },

  async findByUrl(url: string): Promise<IssueDocument | null> {
    const col = await getCollection();
    return col.findOne({ inputType: 'link', canonicalText: url });
  },

  async findByAccount(
    platform: Platform,
    accountHandle: string
  ): Promise<IssueDocument | null> {
    const col = await getCollection();
    return col.findOne({ inputType: 'link', platform, accountHandle });
  },

  async createText(
    canonicalText: string,
    reporterUserId: string
  ): Promise<IssueDocument> {
    const col = await getCollection();
    const doc: IssueDocument = {
      inputType: 'text',
      canonicalText,
      status: 'new',
      reporterIds: [reporterUserId],
      investigators: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await col.insertOne(doc);
    return result.ops[0];
  },

  async createLink(
    fields: Pick<
      IssueDocument,
      | 'canonicalText'
      | 'platform'
      | 'accountHandle'
      | 'accountId'
      | 'isUnknownSite'
      | 'accountDiscontinued'
      | 'scrapeStatus'
      | 'isUnsafe'
    >,
    reporterUserId: string
  ): Promise<IssueDocument> {
    const col = await getCollection();
    const doc: IssueDocument = {
      inputType: 'link',
      status: 'new',
      reporterIds: [reporterUserId],
      investigators: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...fields,
    };
    const result = await col.insertOne(doc);
    return result.ops[0];
  },

  // kept for backward compat with text-only call sites
  async create(
    canonicalText: string,
    reporterUserId: string
  ): Promise<IssueDocument> {
    return Issue.createText(canonicalText, reporterUserId);
  },

  async addReporter(id: ObjectId, reporterUserId: string): Promise<void> {
    const col = await getCollection();
    await col.updateOne(
      { _id: id },
      {
        $addToSet: { reporterIds: reporterUserId },
        $set: { updatedAt: new Date() },
      }
    );
  },

  async updateStatus(
    id: string,
    status: IssueStatus
  ): Promise<IssueDocument | null> {
    const col = await getCollection();
    const $set: Partial<IssueDocument> & { resolvedAt?: Date } = {
      status,
      updatedAt: new Date(),
    };
    if (status === 'resolved') {
      $set.resolvedAt = new Date();
    }
    return (
      await col.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set },
        { returnOriginal: false }
      )
    ).value;
  },

  async addInvestigator(
    id: string,
    investigator: Investigator
  ): Promise<IssueDocument | null> {
    const col = await getCollection();
    return (
      await col.findOneAndUpdate(
        {
          _id: new ObjectId(id),
          'investigators.userId': { $ne: investigator.userId },
          $expr: { $lt: [{ $size: '$investigators' }, 5] },
        },
        {
          $push: { investigators: investigator as any },
          $set: { updatedAt: new Date() },
        },
        { returnOriginal: false }
      )
    ).value;
  },

  async removeInvestigator(
    id: string,
    userId: string
  ): Promise<IssueDocument | null> {
    const col = await getCollection();
    return (
      await col.findOneAndUpdate(
        { _id: new ObjectId(id) },
        {
          $pull: { investigators: { userId } as any },
          $set: { updatedAt: new Date() },
        },
        { returnOriginal: false }
      )
    ).value;
  },

  async markCofactsResolvedForUser(userId: string): Promise<void> {
    const col = await getCollection();
    await col.updateMany(
      { reporterIds: userId, status: { $in: ['new', 'processing'] } },
      { $set: { status: 'cofacts_resolved', updatedAt: new Date() } }
    );
  },
};

export default Issue;
