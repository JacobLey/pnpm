import { DependenciesField } from './misc'
import { ImporterManifest, PackageManifest } from './package'

export type LogBase = {
  level: 'debug' | 'error';
} | {
  level: 'info' | 'warn';
  prefix: string;
  message: string;
}

export type IncludedDependencies = {
  [dependenciesField in DependenciesField]: boolean
}

export interface ReadPackageHook {
  (pkg: PackageManifest): PackageManifest
  (pkg: ImporterManifest): ImporterManifest
}
