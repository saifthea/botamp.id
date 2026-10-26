/**
 * MongoDB adapter — routing ke MongoDB VPS Hostinger
 * Interface sama dengan Firebase Firestore agar 27+ file API route tidak perlu diubah.
 * HANYA untuk server-side (API routes).
 *
 * Koleksi MongoDB: products, pesanan, customers, chats, komplain
 */

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://adminstore:passwordkuat123@31.97.223.157:27017/webstoreku?authSource=admin";
const MONGODB_DB  = process.env.MONGODB_DB || "webstoreku";

let _client: any = null;
let _db    : any = null;
let _mongoModule: any = null;

async function getMongoModule() {
  if (_mongoModule) return _mongoModule;
  const mod = await import("mongodb");
  _mongoModule = mod;
  return mod;
}

async function getDb() {
  if (_db) return _db;
  const mod = await getMongoModule();
  _client = new mod.MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10,
  });
  await _client.connect();
  _db = _client.db(MONGODB_DB);
  console.log(`[MongoDB] Connected → ${MONGODB_DB}`);
  return _db;
}

// ── Fake Firestore classes (for compatibility) ─────────────────────

export class Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
  constructor(seconds = 0, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static now() {
    const ms = Date.now();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1_000_000);
  }
  toDate() {
    return new Date(this.seconds * 1000);
  }
  toJSON() {
    return this.toDate().toISOString();
  }
  toString() {
    return this.toJSON();
  }
}

export function serverTimestamp() {
  return Timestamp.now();
}

export const db: any = Symbol("mongo-db");

export function doc<T extends Document = Document>(
  _database: any,
  collectionName: string,
  docId: string
): { collectionName: string; docId: string } {
  return { collectionName, docId };
}

export function collection(_database: any, collectionName: string): { collectionName: string } {
  return { collectionName };
}

// ── Query builders ─────────────────────────────────────────────────

export type FirestoreFieldFilterOp = "==";

export interface FirestoreQuery {
  collectionName: string;
  filters: Array<{ field: string; op: FirestoreFieldFilterOp; value: any }>;
  orderByField: string;
  orderByDir: "asc" | "desc";
  limitCount?: number;
}

export function query(coll: { collectionName: string }, ...filtersAndOrders: any[]): FirestoreQuery {
  const q: FirestoreQuery = {
    collectionName: coll.collectionName,
    filters: [],
    orderByField: "",
    orderByDir: "asc",
    limitCount: undefined,
  };
  for (const f of filtersAndOrders) {
    if (f && f._type === "where") {
      q.filters.push({ field: f.field, op: "==", value: f.value });
    } else if (f && f._type === "orderBy") {
      q.orderByField = f.field;
      q.orderByDir = f.direction;
    } else if (f && f._type === "limit") {
      q.limitCount = f.count;
    }
  }
  return q;
}

export function where(field: string, op: FirestoreFieldFilterOp, value: any) {
  return { _type: "where", field, op, value };
}

export function orderBy(field: string, direction: "asc" | "desc" = "asc") {
  return { _type: "orderBy", field, direction };
}

// ── CRUD operations ────────────────────────────────────────────────

async function getDocFilter(docId: string) {
  const mod = await getMongoModule();
  const filter: any = { $or: [{ id: docId }] };
  try {
    if (mod.ObjectId.isValid(docId)) {
      filter.$or.push({ _id: new mod.ObjectId(docId) });
    }
  } catch {}
  return filter;
}

export async function getDoc<T = any>(ref: { collectionName: string; docId: string }): Promise<{ exists(): boolean; id: string; data(): T }> {
  const dbConn = await getDb();
  const col = dbConn.collection(ref.collectionName);
  const filter = await getDocFilter(ref.docId);
  const record = await col.findOne(filter) as T & { _id?: any; id?: string };

  if (!record) {
    return { exists: () => false, id: ref.docId, data: () => ({} as T) };
  }
  return {
    exists: () => true,
    id: record.id ?? String(record._id),
    data: () => record as T,
  };
}

export async function setDoc<T = any>(
  ref: { collectionName: string; docId: string },
  data: Partial<T>,
  opts?: { merge?: boolean }
): Promise<void> {
  const dbConn = await getDb();
  const col = dbConn.collection(ref.collectionName);
  const filter = await getDocFilter(ref.docId);

  if (opts?.merge) {
    await col.updateOne(filter, { $set: data as any }, { upsert: true });
  } else {
    const fullData = { id: ref.docId, ...data };
    await col.updateOne(filter, { $set: fullData as any }, { upsert: true });
  }
}

export async function updateDoc<T = any>(
  ref: { collectionName: string; docId: string },
  data: Partial<T>
): Promise<void> {
  const dbConn = await getDb();
  const col = dbConn.collection(ref.collectionName);
  Object.keys(data).forEach((k) => {
    if (data[k as keyof T] === undefined) delete data[k as keyof T];
  });
  const filter = await getDocFilter(ref.docId);
  await col.updateOne(filter, { $set: data as any });
}

export async function deleteDoc(ref: { collectionName: string; docId: string }): Promise<void> {
  const dbConn = await getDb();
  const col = dbConn.collection(ref.collectionName);
  const filter = await getDocFilter(ref.docId);
  await col.deleteOne(filter);
}

export async function addDoc<T = any>(
  coll: { collectionName: string },
  data: T
): Promise<{ id: string }> {
  const dbConn = await getDb();
  const col = dbConn.collection(coll.collectionName);
  const result = await col.insertOne(data as any);
  return { id: String(result.insertedId) };
}

export async function getDocs<T = any>(q: FirestoreQuery): Promise<{ docs: Array<{ id: string; data(): T }> }> {
  const dbConn = await getDb();
  const col = dbConn.collection(q.collectionName);

  const mongoFilter: Record<string, any> = {};
  for (const f of q.filters) {
    mongoFilter[f.field] = f.value;
  }

  const mongoSort: Record<string, 1 | -1> = {};
  if (q.orderByField) {
    mongoSort[q.orderByField] = q.orderByDir === "desc" ? -1 : 1;
  }

  let cursor = col.find(mongoFilter as any).sort(mongoSort as any);
  if (q.limitCount) cursor = cursor.limit(q.limitCount);
  const records = await cursor.toArray();

  return {
    docs: records.map((r: any) => ({
      id: r.id ?? String(r._id),
      data: () => r as unknown as T,
    })),
  };
}

// ── runTransaction (simplified) ───────────────────────────────────
export async function runTransaction<T>(
  _db: any,
  updateFunction: (tx: { get: (ref: any) => Promise<{ exists(): boolean; data(): any }> }) => Promise<T>
): Promise<T> {
  const dbConn = await getDb();
  const mod = await getMongoModule();
  const txHelper = {
    get: async (ref: { collectionName: string; docId: string }) => {
      const col = dbConn.collection(ref.collectionName);
      let record = await col.findOne({ id: ref.docId });
      if (!record) {
        try { record = await col.findOne({ _id: new mod.ObjectId(ref.docId) }); } catch {}
      }
      return {
        exists: () => !!record,
        data: () => record,
      };
    },
  };
  return await updateFunction(txHelper);
}

// ── onSnapshot (polling-based mock for MongoDB) ────────────────────
export type Unsubscribe = () => void;

export function onSnapshot<T = any>(
  q: FirestoreQuery,
  onNext: (snapshot: { docs: Array<{ id: string; data(): T }> }) => void
): Unsubscribe {
  let cancelled = false;
  const POLL_MS = 3000;

  async function poll() {
    if (cancelled) return;
    try {
      const result = await getDocs<T>(q);
      onNext(result);
    } catch (e) {
      console.error("[onSnapshot] poll error:", e);
    }
    if (!cancelled) setTimeout(poll, POLL_MS);
  }

  poll();
  return () => { cancelled = true; };
}
