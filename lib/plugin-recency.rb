# encoding: utf-8

require 'json'
require 'net/http'
require 'rexml/document'
require 'time'
require 'uri'

module PluginDirectory
  class GithubMetadata
    BATCH_SIZE = 50

    def initialize(token)
      @token = token
    end

    def fetch(plugins)
      repositories = plugins.each_with_object([]) do |plugin, result|
        owner = plugin['owner']
        name = plugin['name']
        next unless valid_repository_part?(owner) && valid_repository_part?(name)

        result << [owner, name]
      end.uniq

      repositories.each_slice(BATCH_SIZE).each_with_object({}) do |batch, metadata|
        query_fields = batch.each_with_index.map do |(owner, name), index|
          <<~GRAPHQL
            repo#{index}: repository(owner: #{owner.to_json}, name: #{name.to_json}) {
              pushedAt
              latestRelease {
                isDraft
                isPrerelease
                publishedAt
                url
                releaseAssets(first: 20) {
                  nodes { name downloadUrl }
                }
              }
            }
          GRAPHQL
        end.join("\n")

        response = post_graphql("query {\n#{query_fields}\nrateLimit { cost remaining resetAt }\n}")
        data = response.fetch('data', {})

        batch.each_with_index do |(owner, name), index|
          repository = data["repo#{index}"]
          metadata["#{owner}/#{name}"] = repository if repository
        end

        if response['errors']
          warn "GitHub GraphQL returned #{response['errors'].length} error(s) while reading plugin metadata"
        end
      end
    end

    private

    def valid_repository_part?(value)
      value.is_a?(String) && value.match?(/\A[A-Za-z0-9_.-]+\z/)
    end

    def post_graphql(query)
      uri = URI('https://api.github.com/graphql')
      request = Net::HTTP::Post.new(uri)
      request['Authorization'] = "Bearer #{@token}"
      request['Accept'] = 'application/vnd.github+json'
      request['User-Agent'] = 'sketch-plugin-directory'
      request['X-GitHub-Api-Version'] = '2022-11-28'
      request.body = JSON.generate(query: query)

      response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
        http.request(request)
      end
      raise "GitHub GraphQL request failed with HTTP #{response.code}" unless response.is_a?(Net::HTTPSuccess)

      JSON.parse(response.body)
    end
  end

  class RecencyUpdater
    MAX_COMMIT_SCAN = 10
    ROOT_DOCUMENTATION = /\A(?:readme|license|contributing|code_of_conduct)(?:\..*)?\z/i
    DOCUMENTATION_DIRECTORIES = %r{\A(?:\.github|docs)/}i
    DISTRIBUTABLE_ASSET = /(?:\.sketchplugin|\.zip)\z/i

    def initialize(github_client:, appcast_loader: nil)
      @github_client = github_client
      @appcast_loader = appcast_loader || method(:load_url)
    end

    def update(plugin, metadata)
      pushed_at = parse_time(metadata['pushedAt'])
      return false unless pushed_at

      formatted_push = format_time(pushed_at)
      return false if plugin['lastPushedAt'] == formatted_push

      repository = "#{plugin['owner']}/#{plugin['name']}"
      candidates = []
      release = release_candidate(metadata['latestRelease'])
      candidates << release if release

      appcast = appcast_candidate(plugin['appcast'], repository)
      candidates << appcast[:candidate] if appcast[:candidate]

      code = code_candidate(repository, appcast[:path], appcast[:has_items])
      candidates << code if code

      latest = candidates.compact.max_by { |candidate| candidate[:date] }
      if latest
        plugin['lastUpdated'] = format_time(latest[:date])
        plugin['lastUpdatedSource'] = latest[:source]
      elsif plugin['lastUpdated'] && !plugin['lastUpdatedSource']
        plugin['lastUpdatedSource'] = 'legacy'
      end

      plugin['lastPushedAt'] = formatted_push
      true
    rescue StandardError => error
      warn "Could not update #{plugin['owner']}/#{plugin['name']}: #{error.message}"
      false
    end

    private

    def release_candidate(release)
      return nil unless release
      return nil if release['isDraft'] || release['isPrerelease']

      assets = release.dig('releaseAssets', 'nodes') || []
      return nil unless assets.any? { |asset| asset['name'].to_s.match?(DISTRIBUTABLE_ASSET) }

      date = parse_time(release['publishedAt'])
      date ? { date: date, source: 'release' } : nil
    end

    def appcast_candidate(url, repository)
      return { candidate: nil, has_items: nil, path: nil } if url.to_s.empty?

      feed = parse_appcast(@appcast_loader.call(url))
      location = github_appcast_location(url)
      candidate = nil

      if feed[:has_items]
        date = feed[:dates].max
        if !date && location && location[:repository].casecmp(repository).zero?
          commit = @github_client.commits(repository, path: location[:path], per_page: 1).first
          date = commit_date(commit) if commit
        end
        candidate = { date: date, source: 'appcast' } if date
      end

      { candidate: candidate, has_items: feed[:has_items], path: location && location[:path] }
    end

    def code_candidate(repository, appcast_path, appcast_has_items)
      commits = @github_client.commits(repository, per_page: MAX_COMMIT_SCAN)
      commits.each do |commit|
        detail = @github_client.commit(repository, commit_sha(commit))
        files = Array(value(detail, :files)).map { |file| value(file, :filename).to_s }
        next unless meaningful_files?(files, appcast_path, appcast_has_items)

        date = commit_date(commit)
        return { date: date, source: 'code' } if date
      end
      nil
    end

    def meaningful_files?(files, appcast_path, appcast_has_items)
      relevant = files.reject { |path| documentation_path?(path) }
      return false if relevant.empty?

      if appcast_has_items == false && appcast_path
        non_appcast = relevant.reject { |path| path.casecmp(appcast_path).zero? }
        return false if non_appcast.empty?
      end

      true
    end

    def documentation_path?(path)
      path.match?(DOCUMENTATION_DIRECTORIES) || (!path.include?('/') && path.match?(ROOT_DOCUMENTATION))
    end

    def parse_appcast(body)
      stripped = body.to_s.lstrip
      return parse_json_appcast(stripped) if stripped.start_with?('{', '[')

      document = REXML::Document.new(stripped)
      items = REXML::XPath.match(document, '//item')
      dates = items.flat_map do |item|
        %w[pubDate date updated published published_at releaseDate].map do |field|
          element = item.elements[field]
          parse_time(element.text) if element
        end
      end.compact
      { has_items: !items.empty?, dates: dates }
    end

    def parse_json_appcast(body)
      data = JSON.parse(body)
      entries = if data.is_a?(Array)
                  data
                else
                  data['items'] || data['releases'] || data['versions'] || (data['version'] ? [data] : [])
                end
      dates = entries.flat_map do |entry|
        next [] unless entry.is_a?(Hash)

        %w[pubDate date updated published published_at releaseDate].map { |field| parse_time(entry[field]) }
      end.compact
      { has_items: !entries.empty?, dates: dates }
    end

    def github_appcast_location(url)
      uri = URI(url)
      parts = uri.path.split('/').reject(&:empty?)
      if uri.host == 'raw.githubusercontent.com' && parts.length >= 4
        path_start = parts[2] == 'refs' && parts[3] == 'heads' ? 5 : 3
        return { repository: "#{parts[0]}/#{parts[1]}", path: parts.drop(path_start).join('/') }
      end
      if uri.host == 'github.com' && parts[2] == 'raw' && parts.length >= 5
        return { repository: "#{parts[0]}/#{parts[1]}", path: parts.drop(4).join('/') }
      end

      nil
    rescue URI::InvalidURIError
      nil
    end

    def load_url(url, redirects = 3)
      raise 'Too many redirects while loading appcast' if redirects < 0

      uri = URI(url)
      response = Net::HTTP.get_response(uri)
      return response.body if response.is_a?(Net::HTTPSuccess)
      return load_url(URI.join(url, response['location']).to_s, redirects - 1) if response.is_a?(Net::HTTPRedirection)

      raise "Appcast request failed with HTTP #{response.code}"
    end

    def value(object, key)
      return object[key] || object[key.to_s] if object.is_a?(Hash)

      object.public_send(key) if object.respond_to?(key)
    end

    def commit_sha(commit)
      value(commit, :sha)
    end

    def commit_date(commit)
      commit_data = value(commit, :commit)
      committer = value(commit_data, :committer)
      parse_time(value(committer, :date))
    end

    def parse_time(value)
      return value.utc if value.is_a?(Time)
      return nil if value.to_s.empty?

      Time.parse(value.to_s).utc
    rescue ArgumentError
      nil
    end

    def format_time(value)
      value.utc.strftime('%Y-%m-%d %H:%M:%S UTC')
    end
  end
end
