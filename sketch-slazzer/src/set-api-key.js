import sketch from 'sketch'
var Settings = require('sketch/settings')


export default function() {
  return new Promise((resolve, reject) => {
    sketch.UI.getInputFromUser('Enter Slazzer API Key', {
      description: 'To get your API key visit https://www.slazzer.com/account#api-key.',
      okButton: 'Save'
    }, (err, value) => {
      if (err) {
        return reject(err)
      }
      Settings.setSettingForKey('api-key', value)
      return resolve(value)
    })
  })
}
