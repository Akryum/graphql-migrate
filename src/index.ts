export { default as migrate } from './migrate'
export { default as generateAbstractDatabase } from './abstract/generateAbstractDatabase'
export { default as computeDiff } from './diff/computeDiff'
export { default as read } from './connector/read'
export { default as write } from './connector/write'

// Test
require('./test')
