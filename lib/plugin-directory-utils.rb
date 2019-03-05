# This is used on the titlefy function. The idea here is to ignore some word that should never be
# re-capitalised
IGNORE = %w(the of a and AE RTL PS HTML UI SF JSON SCSS px RGB HSL HEX iOS iPhone iPad VR SVGO SketchContentSync LayerRenamer SketchRunner Gridy Looper SizeArtboard Shapr)
UPCASE = %w(rtl ps html ui sf json scss rgb hsl hex vr svgo pdf png sd ds afux)

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
    elsif UPCASE.include? (word.downcase)
      word.upcase
    else
      word.capitalize!
    end
  end
  title = s.join(' ')
  puts title
  return title
end
