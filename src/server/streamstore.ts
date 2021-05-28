import { Firestore } from '@google-cloud/firestore'

import { LivepeerStream } from './livepeer'

export interface StreamInfo extends LivepeerStream {
  humanId: string
}

const firestore = new Firestore()
const collectionRef = firestore.collection('justcast-streams')

async function getByHumanId(humanId: string) {
  const doc = await collectionRef.doc(humanId).get()
  return doc.data() as StreamInfo | undefined
}

async function getByStreamId(streamId: string) {
  const list = await collectionRef.where('streamId', '==', streamId).get()
  if (list.size != 1) {
    return undefined
  }
  return list.docs[0].data() as StreamInfo
}

async function create(humanId: string, data: StreamInfo) {
  await collectionRef.doc(humanId).create(data)
}

export default {
  getByHumanId,
  getByStreamId,
  create
}
