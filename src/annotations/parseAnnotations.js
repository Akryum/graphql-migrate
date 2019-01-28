const safeEval = require('safe-eval')

/**
 * @param {string?} description
 * @returns {Object.<string, any>}
 */
module.exports = function (description) {
  if (description) {
    const lines = description.split('\n').map(line => line.trim())
      .filter(line => line.startsWith('@db.'))
    return lines.reduce((obj, line) => {
      line = line.substr(4)
      const separatorIndex = line.indexOf(':')
      if (separatorIndex === -1) {
        obj[line] = true
      } else {
        const name = line.substr(0, separatorIndex).trim()
        const value = line.substr(separatorIndex + 1).trim()
        try {
          obj[name] = safeEval(value)
        } catch (e) {
          console.error(`Can't parse annotation ${line}: ${e.message}`)
        }
      }
      return obj
    }, {})
  }
  return {}
}
