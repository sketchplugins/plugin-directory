# encoding: utf-8

require 'minitest/autorun'
require_relative '../lib/plugin-recency'

class FakeGithubClient
  attr_reader :calls

  def initialize(commits: [], details: {}, appcast_commits: [], error: nil)
    @commits = commits
    @details = details
    @appcast_commits = appcast_commits
    @error = error
    @calls = []
  end

  def commits(repository, options = {})
    @calls << [:commits, repository, options]
    raise @error if @error

    options[:path] ? @appcast_commits : @commits
  end

  def commit(repository, sha)
    @calls << [:commit, repository, sha]
    @details.fetch(sha)
  end
end

class PluginRecencyTest < Minitest::Test
  def commit(sha, date)
    { sha: sha, commit: { committer: { date: date } } }
  end

  def metadata(pushed_at, release = nil)
    { 'pushedAt' => pushed_at, 'latestRelease' => release }
  end

  def plugin(overrides = {})
    {
      'owner' => 'example',
      'name' => 'plugin',
      'lastUpdated' => '2020-01-01 00:00:00 UTC'
    }.merge(overrides)
  end

  def test_uses_newest_meaningful_signal
    source_commit = commit('source', '2024-03-01T00:00:00Z')
    client = FakeGithubClient.new(
      commits: [source_commit],
      details: { 'source' => { files: [{ filename: 'README.md' }, { filename: 'src/plugin.js' }] } }
    )
    release = {
      'publishedAt' => '2024-01-01T00:00:00Z',
      'isDraft' => false,
      'isPrerelease' => false,
      'releaseAssets' => { 'nodes' => [{ 'name' => 'plugin.sketchplugin.zip' }] }
    }
    appcast = '<rss><channel><item><pubDate>1 Feb 2024 00:00:00 UTC</pubDate></item></channel></rss>'
    record = plugin('appcast' => 'https://example.com/appcast.xml')

    updater = PluginDirectory::RecencyUpdater.new(github_client: client, appcast_loader: ->(_url) { appcast })
    updater.update(record, metadata('2024-03-01T00:00:00Z', release))

    assert_equal '2024-03-01 00:00:00 UTC', record['lastUpdated']
    assert_equal 'code', record['lastUpdatedSource']
  end

  def test_readme_warning_does_not_make_turkish_data_recent
    appcast_commit = commit('appcast', '2021-05-08T08:18:19Z')
    warning_commit = commit('warning', '2026-07-28T11:21:08Z')
    code_commit = commit('code', '2021-05-08T08:18:18Z')
    client = FakeGithubClient.new(
      commits: [warning_commit, code_commit],
      appcast_commits: [appcast_commit],
      details: {
        'warning' => { files: [{ filename: 'README.md' }] },
        'code' => { files: [{ filename: 'src/plugin.js' }] }
      }
    )
    feed = '<rss><channel><item><enclosure url="plugin.zip" /></item></channel></rss>'
    record = plugin(
      'owner' => 'ozgurgunes',
      'name' => 'Sketch-Turkish-Data',
      'appcast' => 'https://raw.githubusercontent.com/ozgurgunes/Sketch-Turkish-Data/master/.appcast.xml'
    )

    updater = PluginDirectory::RecencyUpdater.new(github_client: client, appcast_loader: ->(_url) { feed })
    updater.update(record, metadata('2026-07-28T11:21:08Z'))

    assert_equal '2021-05-08 08:18:19 UTC', record['lastUpdated']
    assert_equal 'appcast', record['lastUpdatedSource']
  end

  def test_empty_deprecation_appcast_preserves_previous_activity
    deprecation = commit('deprecation', '2026-07-15T07:48:48Z')
    client = FakeGithubClient.new(
      commits: [deprecation],
      details: {
        'deprecation' => { files: [{ filename: '.appcast.xml' }, { filename: 'README.md' }] }
      }
    )
    record = plugin(
      'appcast' => 'https://raw.githubusercontent.com/example/plugin/master/.appcast.xml',
      'lastUpdated' => '2025-07-22 12:54:03 UTC',
      'lastUpdatedSource' => 'appcast'
    )
    empty_feed = '<rss><channel><title>Deprecated</title></channel></rss>'

    updater = PluginDirectory::RecencyUpdater.new(github_client: client, appcast_loader: ->(_url) { empty_feed })
    updater.update(record, metadata('2026-07-15T07:48:48Z'))

    assert_equal '2025-07-22 12:54:03 UTC', record['lastUpdated']
    assert_equal 'appcast', record['lastUpdatedSource']
    assert_equal '2026-07-15 07:48:48 UTC', record['lastPushedAt']
  end

  def test_unchanged_push_skips_deep_inspection
    client = FakeGithubClient.new(error: 'should not be called')
    record = plugin('lastPushedAt' => '2026-01-01 00:00:00 UTC')
    updater = PluginDirectory::RecencyUpdater.new(github_client: client)

    refute updater.update(record, metadata('2026-01-01T00:00:00Z'))
    assert_empty client.calls
  end

  def test_api_failure_preserves_previous_values_for_retry
    client = FakeGithubClient.new(error: 'temporary failure')
    record = plugin(
      'lastUpdated' => '2024-01-01 00:00:00 UTC',
      'lastUpdatedSource' => 'code',
      'lastPushedAt' => '2024-01-01 00:00:00 UTC'
    )
    updater = PluginDirectory::RecencyUpdater.new(github_client: client)

    refute updater.update(record, metadata('2026-01-01T00:00:00Z'))
    assert_equal '2024-01-01 00:00:00 UTC', record['lastUpdated']
    assert_equal '2024-01-01 00:00:00 UTC', record['lastPushedAt']
  end
end
