# This is used on the titlefy function. The idea here is to ignore some word that should never be
# re-capitalised
IGNORE = %w(the of a and to for as by in with px iOS iPhone iPad SketchContentSync LayerRenamer SketchRunner Gridy Looper SizeArtboard Shapr nSlicer Click-Thru ColorSpark ImageOptim LaTeX PaintCode RealtimeBoard DevTools TinyFaces NoPrint CloudApp ViewController SelectPlus)
UPCASE = %w(ae ps html ui sf css rtl ps html ui sf json jsx scss rgb hsl hex vr svg svgo pdf png sd ds afux qr wcag vk)

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
  # puts title
  return title
end
