import sketch from 'sketch'

export default function() {
  return new Promise((resolve, reject) => {
    sketch.UI.getInputFromUser('Enter Slazzer API Key', {
      description: 'To get your API key on https://www.slazzer.com/account#api-key.',
      okButton: 'Save'
    }, (err, value) => {
      console.log(err)
      console.log(value)
      if (err) {
        return reject(err)
      }
      sketch.Settings.setSettingForKey('slazzer-key', value)
      return resolve(value)
    }).catch((err) => { console.log("atch exception log...." + err.toString()) });
  })
}
