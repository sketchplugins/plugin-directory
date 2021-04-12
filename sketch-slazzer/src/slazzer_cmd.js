import sketch from 'sketch'
import setApiKey from './set-api-key'
var Settings = require('sketch/settings')


function getApiKey() {
  const apiKey = Settings.settingForKey('api-key')  
  console.log('log>>',apiKey)
  if (!apiKey) {
    return setApiKey().catch(() => {})
  } else {
    return Promise.resolve(apiKey)
  }
}

 function removeBackground(objectWithImage, apiKey) {
  sketch.UI.message('Removing background...')
  const data = objectWithImage.image.nsdata
  const formData = new FormData();
  formData.append(
    'source_image_file', {
    fileName: 'image.jpg',
    mimeType: 'image/jpg', // or whichever mime type is your file
    data: data
  });

  return fetch('https://api.slazzer.com/v2.0/remove_image_background', {
    method: 'POST',
    headers: {
      'API-KEY': apiKey
    },
    body: formData
  }).then(res => {
    
     
    if (!res.ok) {
      console.log('!! Issues with API response :(')

      
      return res.text().then(text => {
        let message = text
        try {
          const json = JSON.parse(message)

          if (json && json.error) {
            message = json.error
            console.log(message)
          }
        } catch (err) {}
        throw new Error(message)
      })
    } 
    return res.blob()

   }) 
 
  .then(response => {
   console.log(response)
    objectWithImage.image = response
    
  })
  .catch(err => {
    console.error(err)
    sketch.UI.message(`Error: ${err.message}`)

  })
}

export default function() {
  const document = sketch.getSelectedDocument()
  if (!document) {
    return
  }
  const selection = document.selectedLayers
  if (!selection.length) {
    console.log('log>>')
    sketch.UI.message('Please select an image first')
    return
  }

  getApiKey().then(apiKey => {
    if (!apiKey) {
      sketch.UI.message('Please enter your Slazzer API key')
      return
    }
    selection.forEach(layer => {
      if (layer.type === 'Image') {
        return removeBackground(layer, apiKey)
      }
      if (layer.style && layer.style.fills.length) {
        layer.style.fills.forEach(fill => {
          if (fill.fill === 'Pattern' && fill.pattern && fill.pattern.patternType === 'Fill') {
            return removeBackground(fill.pattern, apiKey)
          }
        })
      }
    })
  })
}


