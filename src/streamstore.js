const { Firestore } = require('@google-cloud/firestore')
const firestore = new Firestore()

const collectionRef = firestore.collection('justcast-streams')

async function get(humanId) {
  const doc = await collectionRef.doc(humanId).get()
  return doc.data()
}

async function create(humanId, data) {
  await collectionRef.doc(humanId).create(data)
}

module.exports = {
  get,
  create
}
