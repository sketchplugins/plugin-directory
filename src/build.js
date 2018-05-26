const { readFile, writeFile, readdir } = require("fs").promises
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
      .sort(sortByName)
      .map(
        p => `- [${p.title}](${p.homepage}) by ${p.author}: ${p.description}`,
      )
      .join("\n")
    await replaceDirectoryInReadme(directory)

    // 4. done
    console.log("Done")
    process.exit(0)
  } catch (e) {
    console.log(e instanceof Error ? e.message : e)
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
  const fields = ["title", "description", "author", "homepage"]
  for (const plugin of plugins) {
    for (const field of fields) {
      if (typeof plugin[field] === "string") {
        continue
      }
      throw new Error(
        "Field " + field + " not found in\n" + JSON.stringify(plugin, null, 2),
      )
    }
  }
}

/**
 * @returns {Promise<SketchDirectory>}
 */
async function getGithubPlugins() {
  try {
    await spawn("rm", ["-rf", "clones"])
  } catch {}

  const plugins = []
  const repos = (await readFile("directory/github.txt", "utf8")).split("\n")
  let i = 0
  for (const repo of repos) {
    i++
    const parts = repo.split("/")
    if (parts.length !== 2) {
      continue
    }
    const [owner, name] = parts

    try {
      console.log(i + "/" + repos.length)
      const plugin = await getGithubPlugin(owner, name)
      plugins.push(plugin)
    } catch (e) {
      console.log("Can't get plugin", e instanceof Error ? e.message : e || "")
    } finally {
      console.log("\n\n")
    }
  }
  return plugins
}

/**
 * @param {string} owner
 * @param {string} name
 * @returns {Promise<SketchPlugin>}
 */
async function getGithubPlugin(owner, name) {
  // clone
  const url = ("https://github.com/" + owner + "/" + name).replace(/ /g, "%20")
  const target = "clones/" + owner + "/" + name
  await spawn("git", ["clone", "--depth", 1, url, target], { stdio: "inherit" })

  // find Sketch plugin
  let pluginPath
  try {
    pluginPath = (await readdir(target)).find(f => f.endsWith(".sketchplugin"))
    if (!pluginPath) {
      throw new Error()
    }
  } catch {
    throw new Error("Can't find any Sketch plugin")
  }

  // find manifest.json
  let manifest
  try {
    const manifestJsonPath =
      target + "/" + pluginPath + "/Contents/Sketch/manifest.json"
    manifest = JSON.parse(await readFile(manifestJsonPath))
    if (!(manifest instanceof Object)) {
      throw new Error()
    }
  } catch {
    throw new Error("Can't get manifest.json")
  }
  const { title, description, author, homepage, appcast } = manifest

  // update lastUpdated
  let lastUpdated
  try {
    lastUpdated = unixToUTC(
      (await exec("git log -1 --format=%cd --date=unix")).stdout,
    )
  } catch {
    throw new Error("Can't compute lastUpdated field")
  }

  return {
    owner,
    name,

    title: typeof title === "string" ? title : name,
    description: typeof description === "string" ? description : "",
    author: typeof author === "string" ? author : owner,
    homepage: typeof homepage === "string" ? homepage : url,
    appcast: typeof appcast === "string" ? appcast : undefined,

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

/**
 * @param {SketchPlugin[]} plugins
 * @returns {Promise<SketchPlugin[]>}
 */
async function revise(plugins) {
  return plugins
}

/**
 * @param {SketchPlugin} a
 * @param {SketchPlugin} b
 * @returns {number}
 */
function sortByName(a, b) {
  const nameA = a.name.toLowerCase()
  const nameB = b.name.toLowerCase()
  if (nameA < nameB) {
    return -1
  }
  if (nameA > nameB) {
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
    await writeFile("plugins.json", JSON.stringify(plugins))
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
