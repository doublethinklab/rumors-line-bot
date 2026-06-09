import { ObjectId } from 'mongodb';
import mongoClient from '../mongoClient';
import type { Platform } from 'src/lib/urlParser';

export type AccountStatus = 'watching' | 'discontinued' | 'cleared';

export interface AccountDocument {
  _id?: ObjectId;
  platform: Platform;
  handle: string;
  profileUrl?: string;
  status: AccountStatus;
  notes?: string;
  issueCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'accounts';

async function getCollection() {
  const client = await mongoClient.getInstance();
  const col = client.collection(COLLECTION);
  // Unique index on (platform, handle)
  await col.createIndex({ platform: 1, handle: 1 }, { unique: true });
  return col;
}

const Account = {
  async findAll(): Promise<AccountDocument[]> {
    const col = await getCollection();
    return col.find({}).sort({ lastSeenAt: -1 }).toArray();
  },

  async findById(id: string): Promise<AccountDocument | null> {
    const col = await getCollection();
    return col.findOne({ _id: new ObjectId(id) });
  },

  async findByPlatformAndHandle(
    platform: Platform,
    handle: string
  ): Promise<AccountDocument | null> {
    const col = await getCollection();
    return col.findOne({ platform, handle });
  },

  /**
   * Insert if new, update lastSeenAt and issueCount if existing.
   * Returns { account, isNew }.
   */
  async upsert(
    platform: Platform,
    handle: string,
    profileUrl?: string
  ): Promise<{ account: AccountDocument; isNew: boolean }> {
    const col = await getCollection();
    const now = new Date();

    const existing = await col.findOne({ platform, handle });

    if (existing) {
      const updated = (
        await col.findOneAndUpdate(
          { platform, handle },
          {
            $set: { lastSeenAt: now, updatedAt: now, ...(profileUrl ? { profileUrl } : {}) },
            $inc: { issueCount: 1 },
          },
          { returnOriginal: false }
        )
      ).value!;
      return { account: updated, isNew: false };
    }

    const doc: AccountDocument = {
      platform,
      handle,
      profileUrl,
      status: 'watching',
      issueCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      updatedAt: now,
    };
    const result = await col.insertOne(doc);
    return { account: result.ops[0], isNew: true };
  },

  async updateStatus(
    id: string,
    status: AccountStatus,
    notes?: string
  ): Promise<AccountDocument | null> {
    const col = await getCollection();
    const $set: Partial<AccountDocument> = { status, updatedAt: new Date() };
    if (notes !== undefined) $set.notes = notes;
    return (
      await col.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set },
        { returnOriginal: false }
      )
    ).value;
  },

  async addNote(id: string, notes: string): Promise<AccountDocument | null> {
    const col = await getCollection();
    return (
      await col.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { notes, updatedAt: new Date() } },
        { returnOriginal: false }
      )
    ).value;
  },
};

export default Account;
