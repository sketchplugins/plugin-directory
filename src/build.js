//
// Helpers
//
async function revise(plugins) {
  return plugins
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
