# This is used on the titlefy function. The idea here is to ignore some word that should never be
# re-capitalised
IGNORE = %w(the of a and AE RTL PS HTML UI SF JSON SCSS px RGB HSL HEX iOS iPhone iPad VR SVGO SketchContentSync LayerRenamer SketchRunner Gridy Looper SizeArtboard Shapr)

def titlefy string
  if IGNORE.include? (string)
    return string
  end
  s = string.gsub('.sketchplugin','').gsub('-',' ').split(' ')
  if s.count == 1
    return string
  end
  # puts "Words: #{s}"
  s.map do |word|
    word_lowercase = word.downcase
    if IGNORE.include?(word)
      word
    # elsif IGNORE.include?(word_lowercase)
    #   word_lowercase
    else
      word.capitalize!
    end
  end
  s.join(' ')
end

