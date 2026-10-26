import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://31.97.223.157:27017/webstoreku";

(async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  const orders = await db.collection("pesanan").find({
    $or: [
      { orderId: "1792049901898" },
      { "No.Pesanan": "1792049901898" },
      { id: "1792049901898" },
    ],
  }).toArray();

  console.log("Found orders:", orders.length);
  for (const o of orders) {
    console.log("Order:", JSON.stringify(o, null, 2));
  }

  await client.close();
})();