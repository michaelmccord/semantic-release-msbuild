const {isArray, isString, isPlainObject} = require('lodash');
const SemanticReleaseError = require('@semantic-release/error');
const fs = require('fs');
const path = require('path');
const execa = require('execa');
const getLogger = require('./get-logger');
const semver = require('semver');

let msbuildLocation = '';

function findVisualStudioInstallation() {
  const VS2017Ent = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Enterprise\\Common7\\Tools\\VsDevCmd.bat';
  const VS2017Pro = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Professional\\Common7\\Tools\\VsDevCmd.bat';
  const VS2017Comm = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Community\\Common7\\Tools\\VsDevCmd.bat';
  const VS2019Ent = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\Common7\\Tools\\VsDevCmd.bat';
  const VS2019Pro = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Professional\\Common7\\Tools\\VsDevCmd.bat';
  const VS2019Comm = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\Common7\\Tools\\VsDevCmd.bat';




  if(fs.existsSync(VS2017Ent))
    return VS2017Ent;

  if(fs.existsSync(VS2017Pro))
    return VS2017Pro;

  if(fs.existsSync(VS2017Comm))
    return VS2017Comm;

  if(fs.existsSync(VS2019Ent))
    return VS2019Ent;

  if(fs.existsSync(VS2019Pro))
    return VS2019Pro;

  if(fs.existsSync(VS2019Comm))
    return VS2019Comm;

  return null;
}

function verifyConditions(pluginConfig, context) {

  if(!pluginConfig.vsPath || (isString(pluginConfig.vsPath) && pluginConfig.vsPath.trim())) {
    pluginConfig.vsPath = process.env.VS_PATH;
  }

  if(pluginConfig.vsPath) {
    if(!isString(pluginConfig.vsPath) || !pluginConfig.vsPath.trim())
      throw new SemanticReleaseError('vsPath or VS_PATH not a path string', 'E_VS_PATH', 'vsPath must be a path string');
  } else {
    pluginConfig.vsPath = findVisualStudioInstallation();
  }

  const logger = getLogger(context);
  logger.info('Validating installation of msbuild');
  let msbuildExists = false;

  try {
    logger.info('Checking for msbuild on PATH');
    execa.sync(path.resolve(__dirname, 'Execute.bat'), ['', 'msbuild', '/version'], {
      cwd: context.cwd,
      env: context.env,
      stdout: context.stdout,
      stderr: context.stderr
    });
    msbuildExists = true;
    logger.info('MSBUILD found on PATH');
  } catch(error) {
    logger.error('msbuild not found');
  }

  if(!msbuildExists) {
    try {
      logger.info('Checking for msbuild via vsPath/VS_PATH');
      execa.sync(path.resolve(__dirname, 'Execute.bat'), [pluginConfig.vsPath, 'msbuild', '/version'], {
        cwd: context.cwd,
        env: context.env,
        stdout: context.stdout,
        stderr: context.stderr
      });
      msbuildExists = true;
      msbuildLocation = pluginConfig.vsPath;
      logger.info(`MSBUILD found via ${pluginConfig.vsPath}`);
    } catch(error) {
      logger.error('msbuild not found');
    }
  }

  if(!msbuildExists)
    throw new SemanticReleaseError('msbuild not found', 'E_MSBUILD_NOT_FOUND', 'MSBUILD was searched on the PATH and via vsPath/VS_PATH and could not be found.');


  if(!pluginConfig.projects
      || !isArray(pluginConfig.projects)
      || !pluginConfig.projects.every(v=>isPlainObject(v))) {
    throw new SemanticReleaseError('Bad projects config',
      'E_BAD_PROJECTS',
      '"projects" must be an array of project path strings');
  }


  pluginConfig.projects.forEach(p=>{
    logger.info(`Checking for existence of ${p.path}`);
    if(!fs.existsSync(path.isAbsolute(p.path) ? p.path : path.resolve(context.cwd,p.path)))
      throw new SemanticReleaseError('Project does not exist', 'E_PROJ_DNE', `The project at ${p.path} does not appear to exist`);
    if(p.targets && !isArray(p.targets))
      throw new SemanticReleaseError('targets must be array', 'E_TARGETS_ARRAY', '"targets" must be an array');
    if(p.properties && !isPlainObject(p.properties))
      throw new SemanticReleaseError('properties must be object', 'E_PROP_OBJ', '"properties" must a dictionary of key-value pairs');
    if(p.config && !isString(p.config))
      throw new SemanticReleaseError('config must be a string', 'E_CONFIG_STR', 'The config property must be a valid string');
    if(p.publishDir && !isString(p.publishDir))
      throw new SemanticReleaseError('publishDir must be a string', 'E_PUB_DIR', 'publishDir must be a valid path string');
  });
}


function verifyRelease(pluginConfig, context) {
  const logger = getLogger(context);
  const version = new semver.SemVer(context.nextRelease.version);
  pluginConfig.projects.forEach(p=>{
      logger.info(`Building project ${p.path}`);
      try {
      let projectPath = path.isAbsolute(p.path) ? p.path : path.resolve(context.cwd,p.path);
      let properties = p.properties
                       ? Object.keys(p.properties).map(k=>`/property:${k}=${p.properties[k]}`)
                       : [];
      let targets = p.targets
                    ? p.targets.map(t=>`/target:${t}`)
                    : ['/target:clean;publish'];
      let args = p.args
                    ? p.args
                    : [];
      let config = p.config
                    ? p.config
                    : 'Release';
      let projectName = path.basename(p.path);
      projectName = projectName.substr(0, projectName.lastIndexOf('.'));
      let publishDir = p.publishDir
                    ? !path.isAbsolute(p.publishDir) ? path.resolve(context.cwd, p.publishDir) : p.publishDir
                    : path.resolve(context.cwd, 'msbuild-publish', projectName, config)

      execa.sync(path.resolve(__dirname, 'Execute.bat'),
        [
          msbuildLocation,
          'msbuild',
          ...targets,
          ...properties,
          `/property:FileVersion=${version.major}.${version.minor}.${version.patch}`,
          `/property:AssemblyVersion=${version.major}.${version.minor}.${version.patch}`,
          `/property:InformationalVersion=${context.nextRelease.version}`,
          `/property:PackageVersion=${context.nextRelease.version}`,
          `/property:Configuration=${config}`,
          `/property:PublishDir=${publishDir}`,
          '/property:GenerateAssemblyInfo=true',
          ...args,
          projectPath,
        ],
      {
        cwd: context.cwd,
        env: context.env,
        stdout: context.stdout,
        stderr: context.stderr
      })
    } catch(error) {
      throw [
        new SemanticReleaseError('Error building project', 'E_PROJ_BUILD', `There was an error building the project at ${p.path}`),
        error
      ];
    }
    logger.info(`Project ${p.path} built successfully.`);
  });

  logger.info('All specified projects built.');
}


module.exports = {
  verifyConditions,
  verifyRelease
}
