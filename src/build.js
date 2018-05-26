const { readFile, writeFile, readdir, stat } = require("fs").promises
const exec = require("util").promisify(require("child_process").exec)

main()

async function main() {
  try {
    // 1. get plugins
    const externalPlugins = await getExternalPlugins()
    const githubPlugins = await getGithubPlugins()
    const plugins = [...externalPlugins, ...githubPlugins]
    checkRequiredFields(plugins)

    // 2. generate plugins.json
    savePlugins(plugins)

    // 3. replace directory in readme.md
    const directory = plugins
      .sort(sortByTitle)
      .map(
        p => `- [${p.title}](${p.homepage}) by ${p.author}: ${p.description}`,
      )
      .join("\n")
    await replaceDirectoryInReadme(directory)

    // 4. done
    console.log("Done")
    process.exit(0)
  } catch (e) {
    console.log("Error", e instanceof Error ? e.message : e || "")
    process.exit(1)
  }
}

//
// Helpers
//
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
    i++
    const parts = repo.split("/")
    if (parts.length !== 2) {
      continue
    }
    const [owner, name] = parts

    try {
      const plugin = await getGithubPlugin(owner, name, i, repos.length)
      plugins.push(plugin)
    } catch (e) {
      console.log("Warning", e instanceof Error ? e.message : e || "")
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
  console.log(i + "/" + length + " " + url)

  // clone
  try {
    try {
      await spawn("git", ["pull"], { cwd: target })
    } catch {
      await spawn("git", ["clone", "--depth", 1, url, target])
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
    manifest = JSON.parse(await readFile(manifestJsonPath, "utf8"))
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
    const cmd = "git log -1 --format=%cd --date=unix"
    lastUpdated = unixToUTC((await exec(cmd, { cwd: target })).stdout)
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
 * @param {string} directory
 * @returns {Promise<void>}
 */
async function replaceDirectoryInReadme(directory) {
  try {
    const readme = await readFile("README.md", "utf8")
    const newReadme = readme.replace(
      /(<!-- directory_start -->).*(<!-- directory_end -->)/s,
      (string, start, end) => start + "\n" + directory + "\n" + end,
    )
    await writeFile("README.md", newReadme)
  } catch {
    throw new Error("Error while replacing directory in readme")
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
    const spawnProcess = require("child_process").spawn(...args)
    spawnProcess.on("error", error => {
      reject(error)
    })
    spawnProcess.on("close", code => {
      code ? reject() : resolve()
    })
  })
}
