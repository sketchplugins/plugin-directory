require 'json'

data = IO.read('plugins.json')
data.force_encoding('utf-8')
plugins = JSON.parse(data)

desc "Clones all repositories to the 'clones' folder"
task :clone do
  mkdir "clones"
  plugins.each do |plugin|
    name  = plugin['name']
    owner = plugin['owner']
    url   = "https://github.com/#{owner}/#{name}"
    system("git clone #{url} clones/#{owner}-#{name}")
  end
end

desc "Updates all clones in the 'clones' folder"
task :update do
  plugins.each do |plugin|
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

  output = <<EOF
# Sketch Plugin Directory

A list of Sketch plugins hosted at GitHub, in alphabetical order.

**Note:** if you want to add yours, just open an issue with the URL, or send a pull request.

EOF

  plugins.sort_by { |k, v| k["owner"].downcase + "/" + k["name"].downcase }.each do |plugin|
    name  = plugin['name']
    owner = plugin['owner']
    url   = "https://github.com/#{owner.downcase}/#{name.downcase}"
    desc  = plugin['description'].strip
    output << "- [#{owner}/#{name}](#{url})"
    if !desc.empty?
      output << " #{desc}"
    end
    output << "\n"
  end

  IO.write('README.md',output)
end

desc "List authors"
task :authors do
  puts plugins.collect { |plugin| plugin['owner'] }.uniq.sort
  puts plugins.collect { |plugin| plugin['owner'] }.uniq.sort.size
end

desc "Default: generate README.md from plugin"
task :default => :readme
