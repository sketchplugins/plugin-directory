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
    throw new Error("Error occurred while reading plugins.json")
  }
}

async function savePlugins(plugins) {
  try {
    await writeFile("plugins.json", JSON.stringify(plugins))
  } catch {
    throw new Error("Error occurred while saving plugins.json")
  }
}
