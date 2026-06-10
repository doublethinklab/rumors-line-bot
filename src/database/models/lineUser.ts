import { ObjectId } from 'mongodb';
import mongoClient from '../mongoClient';

export type LineUserRole = 'viewer' | 'editor';

export interface LineUserDocument {
  _id?: ObjectId;
  userId: string;
  name: string;
  pictureUrl: string;
  role: LineUserRole;
  firstLoginAt: Date;
  lastLoginAt: Date;
}

const COLLECTION = 'lineUsers';

async function getCollection() {
  const client = await mongoClient.getInstance();
  const col = await client.collection(COLLECTION);
  await col.createIndex({ userId: 1 }, { unique: true });
  return col;
}

const LineUser = {
  async findAll(): Promise<LineUserDocument[]> {
    const col = await getCollection();
    return col.find({}).sort({ lastLoginAt: -1 }).toArray();
  },

  async upsert(
    userId: string,
    name: string,
    pictureUrl: string
  ): Promise<LineUserDocument> {
    const col = await getCollection();
    const now = new Date();
    const existing = await col.findOne({ userId });
    if (existing) {
      return (
        await col.findOneAndUpdate(
          { userId },
          { $set: { name, pictureUrl, lastLoginAt: now } },
          { returnOriginal: false }
        )
      ).value!;
    }
    const doc: LineUserDocument = {
      userId,
      name,
      pictureUrl,
      role: 'viewer',
      firstLoginAt: now,
      lastLoginAt: now,
    };
    const result = await col.insertOne(doc);
    return result.ops[0];
  },

  async updateRole(
    userId: string,
    role: LineUserRole
  ): Promise<LineUserDocument | null> {
    const col = await getCollection();
    return (
      await col.findOneAndUpdate(
        { userId },
        { $set: { role } },
        { returnOriginal: false }
      )
    ).value;
  },
};

export default LineUser;
