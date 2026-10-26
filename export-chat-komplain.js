const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const collections = ['chats', 'komplain'];

async function exportCollections() {
  for (const colName of collections) {
    try {
      const snapshot = await db.collection(colName).get();
      const data = [];
      
      snapshot.forEach(doc => {
        data.push({
          id: doc.id,
          ...doc.data()
        });
      });

      fs.writeFileSync(`${colName}.json`, JSON.stringify(data, null, 2));
      console.log(`Koleksi '${colName}' berhasil diekspor (${data.length} dokumen).`);
    } catch (error) {
      console.log(`Koleksi '${colName}' mungkin belum ada atau kosong:`, error.message);
    }
  }
}

exportCollections();