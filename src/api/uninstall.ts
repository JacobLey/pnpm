import cbRimraf = require('rimraf')
import path = require('path')

import initCmd from './init_cmd'
import getSaveType from '../get_save_type'
import removeDeps from '../remove_deps'
import binify from '../binify'
import defaults from '../defaults'
import requireJson from '../fs/require_json'

export default function uninstallCmd (pkgsToUninstall, opts) {
  opts = Object.assign({}, defaults, opts)

  let cmd
  const uninstalledPkgs = []
  const saveType = getSaveType(opts)

  return initCmd(opts)
    .then(_ => { cmd = _ })
    .then(_ => {
      cmd.pkg.pkg.dependencies = cmd.pkg.pkg.dependencies || {}
      const pkgFullNames = pkgsToUninstall.map(dep => cmd.ctx.dependencies[cmd.pkg.path].find(_ => _.indexOf(dep + '@') === 0))
      tryUninstall(pkgFullNames.slice())
      if (cmd.ctx.dependencies[cmd.pkg.path]) {
        pkgFullNames.forEach(dep => {
          cmd.ctx.dependencies[cmd.pkg.path].splice(cmd.ctx.dependencies[cmd.pkg.path].indexOf(dep), 1)
        })
        if (!cmd.ctx.dependencies[cmd.pkg.path].length) {
          delete cmd.ctx.dependencies[cmd.pkg.path]
        }
      }
      return Promise.all(uninstalledPkgs.map(removePkgFromStore))
    })
    .then(_ => cmd.storeJsonCtrl.save({
      pnpm: cmd.ctx.pnpm,
      dependents: cmd.ctx.dependents,
      dependencies: cmd.ctx.dependencies
    }))
    .then(_ => Promise.all(pkgsToUninstall.map(dep => rimraf(path.join(cmd.ctx.root, 'node_modules', dep)))))
    .then(_ => saveType && removeDeps(cmd.pkg, pkgsToUninstall, saveType))
    .then(_ => cmd.unlock())
    .catch(err => {
      if (cmd && cmd.unlock) cmd.unlock()
      throw err
    })

  function canBeUninstalled (pkgFullName) {
    return !cmd.ctx.dependents[pkgFullName] || !cmd.ctx.dependents[pkgFullName].length ||
      cmd.ctx.dependents[pkgFullName].length === 1 && cmd.ctx.dependents[pkgFullName].indexOf(cmd.pkg.path) !== -1
  }

  function tryUninstall (pkgFullNames) {
    let numberOfUninstalls
    do {
      numberOfUninstalls = 0
      for (let i = 0; i < pkgFullNames.length; ) {
        if (canBeUninstalled(pkgFullNames[i])) {
          const uninstalledPkg = pkgFullNames.splice(i, 1)[0]
          removeBins(uninstalledPkg)
          uninstalledPkgs.push(uninstalledPkg)
          const deps = cmd.ctx.dependencies[uninstalledPkg] || []
          delete cmd.ctx.dependencies[uninstalledPkg]
          delete cmd.ctx.dependents[uninstalledPkg]
          deps.forEach(dep => removeDependency(dep, uninstalledPkg))
          tryUninstall(deps)
          numberOfUninstalls++
          continue
        }
        i++
      }
    } while (numberOfUninstalls)
  }

  function removeDependency (dependentPkgName, uninstalledPkg) {
    if (!cmd.ctx.dependents[dependentPkgName]) return
    cmd.ctx.dependents[dependentPkgName].splice(cmd.ctx.dependents[dependentPkgName].indexOf(uninstalledPkg), 1)
    if (!cmd.ctx.dependents[dependentPkgName].length) {
      delete cmd.ctx.dependents[dependentPkgName]
    }
  }

  function removeBins (uninstalledPkg) {
    const uninstalledPkgJson = requireJson(path.join(cmd.ctx.store, uninstalledPkg, '_/package.json'))
    const bins = binify(uninstalledPkgJson)
    Object.keys(bins).forEach(bin => cbRimraf.sync(path.join(cmd.ctx.root, 'node_modules/.bin', bin)))
  }

  function removePkgFromStore (pkgFullName) {
    return rimraf(path.join(cmd.ctx.store, pkgFullName))
  }

  function rimraf (filePath) {
    return new Promise((resolve, reject) => {
      cbRimraf(filePath, err => err ? reject(err) : resolve())
    })
  }
}
