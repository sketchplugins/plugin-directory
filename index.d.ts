type SketchPlugin = {
  title: string, // from manifest.json
  description: string, // from manifest.json
  author: string, // from manifest.json
  homepage: string, // from manifest.json
  appcast?: string, // from manifest.json
  
  owner?: string, // GitHub user name
  name?: string, // GitHub repo name
  lastUpdated?: string, // last commit date
};

type SketchDirectory = SketchPlugin[];
