import { Firestore } from '@google-cloud/firestore'

const firestore = new Firestore()
const collectionRef = firestore.collection('justcast-streams')

async function getByHumanId(humanId) {
  const doc = await collectionRef.doc(humanId).get()
  return doc.data()
}

async function getByStreamId(streamId) {
  const list = await collectionRef.where('streamId', '==', streamId).get()
  if (list.size != 1) {
    return undefined
  }
  return list.docs[0].data()
}

async function create(humanId, data) {
  await collectionRef.doc(humanId).create(data)
}

export default {
  getByHumanId,
  getByStreamId,
  create
}
