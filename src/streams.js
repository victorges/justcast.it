const livepeer = require('./livepeer')
const streamstore = require('./streamstore')

const {
  uniqueNamesGenerator,
  adjectives,
  animals,
  names,
} = require('unique-names-generator')
const hidConfig = {
  dictionaries: [adjectives, animals, names],
  separator: '-',
}
const humanIdGen = () => uniqueNamesGenerator(hidConfig).toLowerCase()

async function getOrCreateStream(prevStreamId) {
  if (prevStreamId) {
    const info = await streamstore.getByStreamId(prevStreamId)
    if (info) {
      return info
    }
  }

  const humanId = humanIdGen()
  const lpInfo = prevStreamId
    ? await livepeer.getStream(prevStreamId)
    : await livepeer.createStream(`justcast-it-${humanId}`)

  const info = { ...lpInfo, humanId }
  await streamstore.create(humanId, info)
  return info
}

module.exports = { getOrCreateStream }
