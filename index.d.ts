type SketchDirectory = SketchPlugin[];

type SketchPlugin = {
  title: string,        // name from manifest.json non-empty string,
  description: string,  // from manifest.json
  author: string,       // from manifest.json non-empty string
  homepage: string,     // from manifest.json non-empty string
  appcast?: string,     // from manifest.json
  
  owner?: string,       // GitHub user name
  name?: string,        // GitHub repo name
  lastUpdated?: string, // last commit date
};
