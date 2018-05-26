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
  return []
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
