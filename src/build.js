const { readFile, writeFile, readdir, stat } = require("fs").promises
const execFile = require("util").promisify(require("child_process").execFile)
const JSON5 = require("json5")

main()

async function main() {
  try {
    // 1. get plugins
    console.log("1. collecting plugins")
    const externalPlugins = await getExternalPlugins()
    const githubPlugins = await getGithubPlugins()
    const plugins = [...externalPlugins, ...githubPlugins]
    checkRequiredFields(plugins)

    // 2. save plugins into plugins.json
    console.log("2. saving " + plugins.length + " plugins into plugins.json")
    savePlugins(plugins)

    // 3. replace directory in readme.md
    console.log("3. saving readme.md")
    const directory = plugins
      .sort(sortByTitle)
      .map(
        p => `- [${p.title}](${p.homepage}) by ${p.author}: ${p.description}`,
      )
      .join("\n")
    await replaceInReadme("directory", directory)

    // 4. done
    console.log("done")
    process.exit(0)
  } catch (e) {
    console.log("error", e instanceof Error ? e.message : e || "")
    process.exit(1)
  }
}

/**
 * @returns {Promise<SketchDirectory>}
 */
async function getGithubPlugins() {
  try {
    const plugins = []
    const repos = (await readFile("directory/github.txt", "utf8"))
      .trim()
      .split("\n")
    let i = 0
    for (const repo of repos) {
      try {
        i++
        const parts = repo.split("/")
        if (parts.length !== 2) {
          throw new Error("Can't parse repository name " + repo)
        }
        const [owner, name] = parts

        const plugin = await getGithubPlugin(owner, name, i, repos.length)
        plugins.push(plugin)
      } catch (e) {
        console.log("warning", e instanceof Error ? e.message : e || "")
      }
    }
    return plugins
  } catch {
    throw new Error("Error occurred while reading GitHub plugins")
  }
}

/**
 * @param {string} owner
 * @param {string} name
 * @param {number} i
 * @param {number} length
 * @returns {Promise<SketchPlugin>}
 */
async function getGithubPlugin(owner, name, i, length) {
  const url = ("https://github.com/" + owner + "/" + name).replace(/ /g, "%20")
  const target = "clones/" + owner + "/" + name
  console.log(i + "/" + length + "\t" + url)

  // clone
  try {
    try {
      await spawn("git", ["pull"], { cwd: target })
    } catch {
      await spawn("git", ["clone", "--depth", 1, url, target], {
        stdio: "inherit",
      })
    }
  } catch {
    throw new Error("Can't clone repository")
  }

  // find manifest.json
  let manifestJsonPath
  try {
    try {
      manifestJsonPath = target + "/src/manifest.json"
      await stat(manifestJsonPath)
    } catch {
      const pluginPath = (await readdir(target)).find(f =>
        f.endsWith(".sketchplugin"),
      )
      if (!pluginPath) {
        throw new Error()
      }
      manifestJsonPath =
        target + "/" + pluginPath + "/Contents/Sketch/manifest.json"
      await stat(manifestJsonPath)
    }
  } catch {
    throw new Error("Can't find manifest.json")
  }

  // read manifest.json
  let manifest
  try {
    manifest = JSON5.parse(await readFile(manifestJsonPath, "utf8"))
    if (!(manifest instanceof Object)) {
      throw new Error()
    }
  } catch {
    throw new Error("Can't read manifest.json")
  }
  const { name: title, description, author, homepage, appcast } = manifest

  // update lastUpdated
  let lastUpdated
  try {
    const args = "log -1 --format=%cd --date=unix".split(" ")
    lastUpdated = unixToUTC(
      (await execFile("git", args, { cwd: target })).stdout,
    )
  } catch {
    throw new Error("Can't compute lastUpdated field")
  }

  return {
    owner,
    name,

    title: isNonEmptyString(title) ? title : name,
    description: isNonEmptyString(description) ? description : "",
    author: isNonEmptyString(author) ? author : owner,
    homepage: isNonEmptyString(homepage) ? homepage : url,
    appcast: isNonEmptyString(appcast) ? appcast : undefined,

    lastUpdated,
  }
}

function unixToUTC(unixTimestamp) {
  const d = new Date(unixTimestamp * 1000)
  return (
    d.getFullYear() +
    "-" +
    d.getMonth() +
    "-" +
    d.getDate() +
    " " +
    d.getHours() +
    ":" +
    d.getMinutes() +
    ":" +
    d.getSeconds() +
    " UTC"
  )
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length
}

/**
 * @param {SketchDirectory} plugins
 */
function checkRequiredFields(plugins) {
  for (const plugin of plugins) {
    if (
      isNonEmptyString(plugin.title) &&
      typeof plugin.description === "string" &&
      isNonEmptyString(plugin.author) &&
      isNonEmptyString(plugin.homepage)
    ) {
      continue
    }
    throw new Error(
      "Required fields missing in\n" + JSON.stringify(plugin, null, 2),
    )
  }
}

/**
 * @param {SketchPlugin} a
 * @param {SketchPlugin} b
 * @returns {number}
 */
function sortByTitle(a, b) {
  const titleA = a.title.toLowerCase()
  const titleB = b.title.toLowerCase()
  if (titleA < titleB) {
    return -1
  }
  if (titleA > titleB) {
    return 1
  }
  return 0
}

/**
 * @param {string} section
 * @param {string} content
 * @returns {Promise<void>}
 */
async function replaceInReadme(section, content) {
  try {
    const readme = await readFile("README.md", "utf8")
    const regex = new RegExp(
      "(<!-- " + section + "_start -->).*(<!-- " + section + "_end -->)",
      "s",
    )
    const newReadme = readme.replace(
      regex,
      (string, start, end) => start + "\n" + content + "\n" + end,
    )
    await writeFile("README.md", newReadme)
  } catch {
    throw new Error("Error while replacing readme")
  }
}

/**
 * @returns {Promise<SketchDirectory>}
 */
async function getExternalPlugins() {
  try {
    const result = JSON.parse(await readFile("directory/external.json", "utf8"))
    if (!(result instanceof Object)) {
      throw new Error()
    }
    return result
  } catch {
    throw new Error("Error occurred while reading external plugins")
  }
}

/**
 * @param {SketchDirectory} plugins
 * @returns {Promise<void>}
 */
async function savePlugins(plugins) {
  try {
    await writeFile("plugins.json", JSON.stringify(plugins, null, 2))
  } catch {
    throw new Error("Error occurred while saving plugins")
  }
}

async function spawn(...args) {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    const spawnProcess = require("child_process").spawn(...args)
    spawnProcess.on("error", error => {
      reject(error)
    })
    spawnProcess.on("close", code => {
      code ? reject() : resolve()
    })
  })
}
