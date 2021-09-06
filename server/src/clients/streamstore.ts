import { Firestore } from '@google-cloud/firestore'
import { Stream } from './livepeer'

export interface StreamInfo {
  humanId: string
  streamId: string
  streamKey?: string
  streamUrl: string
  playbackId: string
  playbackUrl: string
  stream?: Stream
}

const credentials = JSON.parse(process.env.GCLOUD_CREDENTIALS || 'null')
const firestore = new Firestore({
  projectId: credentials?.project_id,
  credentials,
})
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
  create,
}
