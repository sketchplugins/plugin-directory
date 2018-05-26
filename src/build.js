const { readFile, writeFile } = require("fs").promises

main()

async function main() {
  try {
    // 1. revise plugins
    const p = await getPlugins()
    const plugins = await revise(p)
    savePlugins(plugins)

    // 2. generate directory
    const directory = plugins
      .sort(sortByName)
      .map(
        p => `- [${p.title}](${p.homepage}) by ${p.author}: ${p.description}`,
      )
      .join("\n")
    await replaceDirectoryInReadme(directory)

    // 3. done
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
async function revise(plugins) {
  return plugins
}
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

async function replaceDirectoryInReadme(directory) {
  try {
    const readme = await readFile("README.md", "utf8")
    const newReadme = readme.replace(
      /(<!-- directory_start -->).*(<!-- directory_end -->)/s,
      (string, start, end) => start + "\n" + directory + end,
    )
    await writeFile("README.md", newReadme)
  } catch {
    throw new Error("Error while replacing directory in readme")
  }
}

/**
 * @returns {Promise<SketchPlugin[]>}
 */
async function getPlugins() {
  try {
    const result = JSON.parse(await readFile("plugins.json", "utf8"))
    if (!(result instanceof Object)) {
      throw new Error()
    }
    return result
  } catch {
    throw new Error("Error occurred while reading plugins")
  }
}

async function savePlugins(plugins) {
  try {
    await writeFile("plugins.json", JSON.stringify(plugins))
  } catch {
    throw new Error("Error occurred while saving plugins")
  }
}
