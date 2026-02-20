import { resolve } from 'node:path'

const extensionDir = resolve('extension')
const manifestTemplatePath = resolve(extensionDir, 'manifest.template.json')
const manifestOutputPath = resolve(extensionDir, 'manifest.json')
const contentScriptEntryPoint = resolve(extensionDir, 'content-src.ts')

const manifestTemplate = await Bun.file(manifestTemplatePath).text()

await Bun.write(manifestOutputPath, manifestTemplate)
console.info('Generated extension/manifest.json')

const buildResult = await Bun.build({
  entrypoints: [contentScriptEntryPoint],
  outdir: extensionDir,
  target: 'browser',
  naming: 'content.js',
})

if (!buildResult.success) {
  console.error('Extension content script build failed:')
  for (const log of buildResult.logs) {
    console.error(log)
  }
  process.exit(1)
}

console.info('Built extension/content.js')
