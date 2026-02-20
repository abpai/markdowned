import { describe, expect, test } from 'bun:test'
import { buildExportFileName, selectExportTitle, type ExportTitleInput } from './export-metadata.ts'

type FixtureCase = {
  name: string
  input: ExportTitleInput
  expectedTitle: string
  expectedFileNamePrefix: string
}

const fixturePath = new URL('./fixtures/export-title-cases.json', import.meta.url)
const fixtureCases = (await Bun.file(fixturePath).json()) as FixtureCase[]

describe('export file naming', () => {
  for (const fixtureCase of fixtureCases) {
    test(fixtureCase.name, () => {
      const resolvedTitle = selectExportTitle(fixtureCase.input)
      expect(resolvedTitle).toBe(fixtureCase.expectedTitle)

      const fileName = buildExportFileName(resolvedTitle, '2026-02-20T15:00:00.000Z')
      expect(fileName.startsWith(fixtureCase.expectedFileNamePrefix)).toBe(true)
      expect(fileName.endsWith('.md')).toBe(true)
    })
  }
})
