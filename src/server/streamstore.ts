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

async function create(info: StreamInfo) {
  await collectionRef.doc(info.humanId).create(info)
}

export default {
  getByHumanId,
  getByStreamId,
  create
}
