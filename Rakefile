require 'json'
require 'time'

GITHUB_AUTH_TOKEN = `git config com.bohemiancoding.qa.token`.strip
USERNAME = `git config github.user`.strip

# This is used on the titlefy function. The idea here is to ignore some word that should never be
# re-capitalised
IGNORE = %w(the of a and PS HTML UI SF px RGB HSL HEX iOS iPhone iPad VR SVGO SketchContentSync LayerRenamer SketchRunner Gridy Looper SizeArtboard Shapr)

def titlefy string
  if IGNORE.include? (string)
    return string
  end
  s = string.gsub('.sketchplugin','').gsub('-',' ').split(' ')
  s.map do |word|
    word_lowercase = word.downcase
    if IGNORE.include?(word_lowercase)
      word_lowercase
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
    if plugin['lastUpdated']
      last_update = Time.parse(plugin['lastUpdated'])
      now = Time.now
      if ( (now - last_update) > 60_000_000 )
        puts "Outdated plugin"
        next
      end
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
    if plugin['lastUpdated']
      last_update = Time.parse(plugin['lastUpdated'])
      now = Time.now
      if ( (now - last_update) > 60_000_000 )
        next
      end
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
    puts "Updating #{plugin['name']}"
    if plugin['owner'] && plugin['name']
      plugin_url = plugin['owner'] + "/" + plugin['name']
      repo = client.repo(plugin_url)
      user = client.user(plugin['owner'])

      if plugin['lastUpdated'] != repo.updated_at
        puts "— Plugin was updated at #{repo.updated_at}"
        plugin['lastUpdated'] = repo.updated_at
      else
        puts "— Plugin was NOT updated since last check"
      end

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

desc "Interactive JSON"
task :interactive_update_json_readme do
    begin
        plugin = prompt_for_plugin()

        # Save JSON
        save_json(plugin)
        STDOUT.puts "plugins.json saved."

        # Create readme
        Rake::Task["readme"].invoke
        STDOUT.puts "README.md updated."

        STDOUT.puts "To commit your plugin to the plugin directory, open a pull request for https://github.com/sketchplugins/plugin-directory/."
    rescue SystemExit, Interrupt # Allow for interupt to leave script
        exit
    end
end

def prompt_for_plugin()
    if prompt_yes_no("Is your plugin hosted on GitHub?")
        return prompt_gh_plugin()
    else
        return prompt_inputs({}, false)
    end
end

def prompt_gh_plugin()
    STDOUT.puts "What is the URL of your GitHub project?"
    input = STDIN.gets.strip
    matches = input.match('(https?://)?github.com/([a-zA-Z0-9\-_]+)/([a-zA-Z0-9\-_]+)/?')
    owner = matches[2]
    name = matches[3]

    if owner && name
        STDOUT.puts "Repository owner: '#{owner}', name: '#{name}'"

        # Get info from GitHub
        gh_defaults = get_gh_defaults(owner, name)

        # Use branch to get manifest.json, but don't include in final saved JSON
        branch = gh_defaults.delete("branch")

        # Get info from manifest.json file hosted on Git?Hub
        manifest_defaults = get_manifest_defaults(owner, name, branch)

        # Combine info into default values
        defaults = gh_defaults.merge(manifest_defaults)

        # Prompt for plugin
        return prompt_inputs(defaults, true)
    else
        STDOUT.puts "ERROR: '#{input}' is not a valid GitHub repoistory."
        prompt_gh_url()
    end
end

def prompt_inputs(defaults, has_github)
    plugin = defaults
    if !has_github
        plugin['owner'] = prompt_owner()
    end

    plugin['title'] = prompt_item("Enter a title for your plugin", defaults["title"], !has_github)
    plugin['description'] = prompt_item("Describe your plugin in 1-2 sentences", defaults["description"], true)
    plugin['homepage'] = prompt_item("Enter a the homepage for your plugin", defaults["homepage"], !has_github)
    plugin['author'] = prompt_item("Enter your name", defaults["author"], false)

    # Filter out nil values
    plugin = plugin.select{|k,v| v != nil}

    # Get string representation of plugin options
    str = plugin.map{|k,v| "\t#{k}: #{v}"}.join("\n")

    STDOUT.puts "Your plugin:\n" + str

    if !prompt_yes_no("Is the above information correct?")
        return prompt_inputs(defaults, has_github)
    end

    return plugin
end

def prompt_owner()
    owner = prompt_item("Enter the person or organization who owns this plugin (no spaces or special characters)", nil, true)

    if !(owner =~ /^[a-zA-Z0-9_\-]+$/)
        STDOUT.puts "ERROR: Owner can only contain letters, numbers, hyphen, or underscores."
        return prompt_owner()
    end

    return owner
end

def prompt_item(prompt, default, required)
    if required
        prompt = prompt + " (required)"
    else
        prompt = prompt + " (optional)"
    end

    prompt = prompt + ": "

    if default
        prompt = prompt + "#{default}"
    end

    STDOUT.puts prompt
    input = STDIN.gets.strip

    if input.to_s.empty? && default
        return default
    elsif input.to_s.empty? && !required
        return nil
    elsif !(input.to_s.empty?)
        return input
    end

    STDOUT.puts "ERROR: Required field"
    return prompt_item(prompt, default, required)
end

def get_gh_defaults(owner, name)
    require 'octokit'
    client = Octokit::Client.new()
    repo_name = "#{owner}/#{name}"
    defaults = {}

    STDOUT.puts "Checking for '#{repo_name}' on GitHub..."
    begin
        repo = client.repo(repo_name)

        defaults["owner"] = owner
        defaults["name"] = name

        if !(repo.homepage.to_s.empty?)
            defaults["homepage"] = repo.homepage
        else
            defaults["homepage"] = repo.html_url
        end

        if !(repo.description.to_s.empty?)
            defaults["description"] = repo.description
        end

        defaults["lastUpdated"] = repo.updated_at
        defaults["branch"] = repo.default_branch

        return defaults
    rescue SystemExit, Interrupt # Allow for interupt to leave script
        exit
    rescue # Error contacting GitHub API
        STDOUT.puts "ERROR: The repository '#{repo_name}' does not exist or is not publically accessible on GitHub."
        exit
    end
end

def get_manifest_defaults(owner, name, branch)
    content = get_manifest_content(owner, name, branch)
    if !content
        return {}
    end

    defaults = {}
    begin
        manifest = JSON.parse(content)

        name = manifest['name']
        description = manifest['description']
        author = manifest['author']
        homepage = manifest['homepage']
        identifier = manifest['identifier']
        version = manifest['version']

        error = false
        if identifier.to_s.empty?
            error = true
            STDOUT.puts "ERROR: The manifest.json file does not contain an identifier."
        end
        if version.to_s.empty?
            error = true
            STDOUT.puts "ERROR: The manifest.json file does not contain a version."
        end

        if error
            STDOUT.puts "\tWe suggest that you update your plugin's manifest.json file to contain these values before adding it to the plugin-directory."
            STDOUT.puts "\tSee Sketch's requirements for plugin bundles: http://developer.sketchapp.com/introduction/plugin-bundles/"

            prompt_continue()
        end

        if !(name.to_s.empty?)
            defaults['title'] = name
        end
        if !(author.to_s.empty?)
            defaults['author'] = author
        end
        if !(homepage.to_s.empty?)
            defaults['homepage'] = homepage
        end
        if !(description.to_s.empty?)
            defaults['description'] = description
        end

        return defaults

    rescue JSON::ParserError
        STDOUT.puts "ERROR: The manifest.json file for this plugin is not valid JSON."
        STDOUT.puts "\tWe suggest that you update your plugin to contain a valid manifest.json file before adding it to the plugin-directory."
        STDOUT.puts "\tTry using a JSON validator to check its contents: https://jsonformatter.curiousconcept.com/"

        prompt_continue()

        return {}
    end
end

def get_manifest_content(owner, name, branch)
    require 'octokit'
    client = Octokit::Client.new()
    repo_name = "#{owner}/#{name}"

    STDOUT.puts "Checking for manifest.json file in '#{repo_name}' on GitHub..."
    begin
        tree = client.tree(repo_name, branch, :recursive => true)

        tree.tree.each do |item|
            path = item.path
            if !(path.downcase.end_with? "manifest.json")
                next
            end

            sha = item.sha

            blob = client.blob(repo_name, sha)
            encoding = blob.encoding
            content = blob.content
            if encoding == "base64"
                content = Base64.decode64(content)
            end

            return content
        end

        STDOUT.puts "ERROR: The plugin in the repository '#{repo_name}' does not have a manifest.json file."
        STDOUT.puts "\tWe suggest that you update your plugin to contain a valid manifest.json file before adding it to the plugin-directory."
        STDOUT.puts "\tSee Sketch's requirements for plugin bundles: http://developer.sketchapp.com/introduction/plugin-bundles/"

        prompt_continue()

        return nil

    rescue SystemExit, Interrupt # Allow for interupt to leave script
        exit
    rescue # Error contacting GitHub API
        puts e
        STDOUT.puts "ERROR: The repository '#{repo_name}' does not exist or is not publically accessible on GitHub."
        exit
    end
end

def prompt_continue()
    if !prompt_yes_no("Are you sure you want to continue?")
        exit
    end
end

def prompt_yes_no(prompt)
    STDOUT.puts prompt + " (y/n)"
    input = STDIN.gets.strip
    if input.downcase.start_with?('y')
        return true
    elsif input.downcase.start_with?('n')
        return false
    else
        STDOUT.puts "ERROR: Respond with 'y' or 'n'."
        return prompt_yes_no(prompt)
    end
end

def save_json(plugin)
    # Get current plugins
    plugins = get_plugins_from_json

    # Check for duplicates
    existing_plugin_index = check_for_duplicates(plugin, plugins)

    if existing_plugin_index >= 0
        if prompt_yes_no("Would you like to update the existing plugin instead?")
            plugins[existing_plugin_index] = plugin
        else
            exit
        end
    else
        plugins << plugin
    end

    File.open("plugins.json","w") do |f|
      f.write(JSON.pretty_generate(plugins, :indent => "  "))
    end
end

def check_for_duplicates(plugin, plugins)
    plugins.each_with_index do |saved_plugin, index|
        if (plugin["name"] == nil || saved_plugin["name"] == nil) && plugin["owner"] == saved_plugin["owner"] && plugin["title"] == saved_plugin["title"]
            STDOUT.puts "ERROR: Found another plugin with the same owner & title."
            return index
        elsif plugin["name"] == saved_plugin["name"] && plugin["owner"] == saved_plugin["owner"]
            STDOUT.puts "ERROR: Found another plugin with the same name & owner."
            return index
        end
    end

    return -1
end

desc "Default: prompt user for information about their plugin and generate plugins.json and README.md"
task :default => :interactive_update_json_readme
