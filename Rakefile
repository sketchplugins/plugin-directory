require 'json'
require 'time'

GITHUB_AUTH_TOKEN = `git config com.bohemiancoding.qa.token`.strip
USERNAME = `git config github.user`.strip

# This is used on the titlefy function. The idea here is to ignore some word that should never be
# re-capitalised
IGNORE = %w(the of a and AE RTL PS HTML UI SF JSON SCSS px RGB HSL HEX iOS iPhone iPad VR SVGO SketchContentSync LayerRenamer SketchRunner Gridy Looper SizeArtboard Shapr)

def titlefy string
  if IGNORE.include? (string)
    return string
  end
  s = string.gsub('.sketchplugin','').gsub('-',' ').split(' ')
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

def fix_plugin_title plugin
  if (plugin['name'] == plugin['title'] && !(IGNORE.include? plugin['title'])) || plugin['title'] == nil
    puts "— #{plugin['name']} - #{plugin['title']}: Plugin title is wrong, fixing"
    plugin['title'] = titlefy(plugin['name'])
  end
end

def get_plugins_from_json
  data = IO.read('plugins.json')
  data.force_encoding('utf-8')
  JSON.parse(data)
end

def is_plugin_too_old? plugin
  if plugin['lastUpdated']
    last_update = Time.parse(plugin['lastUpdated'])
    return (Time.now - last_update) > 60_000_000
  else
    return false
  end
end

desc "Clones all repositories to the 'clones' folder"
task :clone do
  mkdir "clones" unless File.directory? "clones"
  get_plugins_from_json.each do |plugin|
    name  = plugin['name']
    owner = plugin['owner']
    url   = "https://github.com/#{owner}/#{name}"
    system("git clone #{url} clones/#{owner}-#{name}")
  end
end

desc "Updates all clones in the 'clones' folder"
task :update do
  get_plugins_from_json.each do |plugin|
    name  = plugin['name']
    owner = plugin['owner']
    url   = "https://github.com/#{owner}/#{name}"

    if File.directory? "clones/#{owner}-#{name}"
      puts "Updating #{owner}-#{name} to latest version"
      system("cd clones/#{owner}-#{name}/ && git up")
    else
      puts "Cloning #{owner}-#{name} to latest version"
      system("git clone #{url} clones/#{owner}-#{name}")
    end
  end
end

desc "Generate README.md from plugins.json"
task :readme do

  plugins = get_plugins_from_json

  output = <<EOF
# Sketch Plugin Directory

A list of Sketch plugins hosted at GitHub, in alphabetical order.

**Note:** if you want to add yours, just open an issue with the URL, or send a pull request.

EOF

  plugins.sort_by { |k| [ (k["title"] ? k["title"].downcase : k["name"].downcase), (k["owner"] ? k["owner"].downcase : k["author"].downcase) ] }.each do |plugin|
    if is_plugin_too_old? plugin
      next
    end

    if plugin['hidden'] == true
      next
    end

    name   = plugin['name']
    owner  = plugin['owner']
    author = plugin['author'] || owner
    title  = plugin['title'] || name
    url    = plugin['homepage'] || "https://github.com/#{owner.downcase}/#{name.downcase}"
    desc   = plugin['description'].strip
    output << "- [#{title}](#{url}), by #{author}:"
    if !desc.empty?
      output << " #{desc}"
    end
    output << "\n"
  end

  output << "\n\n## Sorted by last update (newest on top)\n\n"

  plugins.reject { |k| k["lastUpdated"] == nil }.sort_by { |k| Date.parse(k["lastUpdated"]).strftime("%s").to_i }.reverse.each do |plugin|
    if is_plugin_too_old? plugin
      next
    end

    if plugin['hidden'] == true
      next
    end

    name   = plugin['name']
    owner  = plugin['owner']
    author = plugin['author'] || owner
    title  = plugin['title'] || name
    url    = plugin['homepage'] || "https://github.com/#{owner.downcase}/#{name.downcase}"
    desc   = plugin['description'].strip
    output << "- [#{title}](#{url}), by #{author}:"
    if !desc.empty?
      output << " #{desc}"
    end
    output << "\n"
  end

  IO.write('README.md',output)
end

desc "Fix plugin titles"
task :fixtitles do
  json_data = get_plugins_from_json
  json_data.each do |plugin|
    fix_plugin_title plugin
  end
  File.open("plugins-titles-fixed.json","w") do |f|
    f.write(JSON.pretty_generate(json_data, :indent => "  "))
  end
end

desc "Update `lastUpdated` field for all plugin in JSON"
task :lastUpdated do

  require 'octokit'
  client = Octokit::Client.new(:access_token => GITHUB_AUTH_TOKEN)

  json_data = get_plugins_from_json

  json_data.each do |plugin|
    # Only check for last push date for plugins with a repo
    if plugin['owner'] && plugin['name']
      puts "Updating #{titlefy(plugin['name'])}"
      plugin_url = plugin['owner'] + "/" + plugin['name']
      repo = client.repo(plugin_url)
      user = client.user(plugin['owner'])

      puts "— Plugin was updated at #{repo.pushed_at}"
      plugin['lastUpdated'] = repo.pushed_at

      # if plugin['name'] == plugin['title'] && plugin['title'] == nil
      #   puts "— Plugin title is wrong, fixing"
      #   plugin['title'] = titlefy(plugin['name'])
      # end
    end
    puts
  end

  File.open("plugins-new.json","w") do |f|
    f.write(JSON.pretty_generate(json_data, :indent => "  "))
  end

end

desc "List authors"
task :authors do
  plugins = get_plugins_from_json
  authors = plugins.collect { |plugin| (plugin['author'] ? plugin['author'].downcase + " (" + plugin['owner'].downcase + ")" : plugin['owner'].downcase ) }.uniq.sort
  puts authors
  puts "\n" + authors.size.to_s + " unique authors."
end

desc "Default: generate README.md from plugin"
task :default => :readme
