'use strict';
// Compatibility entrypoint: delegate to the single hardened engine.
module.exports=require('../../installer-forge/installer-forge.cjs');
if(require.main===module){console.error('Use installer-forge/installer-forge.cjs CLI');process.exitCode=1}
