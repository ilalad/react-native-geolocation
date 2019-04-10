#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const xcode = require('xcode');
const PbxFile = require('xcode/lib/pbxFile');
const helpers = require('./xcode-helpers');

const projectDirectory = process.cwd();
const moduleDirectory = path.resolve(__dirname, '..');
const sourceDirectory = path.join(projectDirectory, 'ios');
const xcodeProjectDirectory = helpers.findProject(sourceDirectory);

const projectConfig = {
    sourceDir: sourceDirectory,
    pbxprojPath: path.join(
        projectDirectory,
        'ios',
        xcodeProjectDirectory,
        'project.pbxproj'
    ),
};

const pathToFramework = path.relative(
    projectConfig.sourceDir,
    path.join(
        moduleDirectory,
        'ios',
        'RNBackgroundGeolocation',
        'TSLocationManager.framework'
    )
);

const project = xcode.project(projectConfig.pbxprojPath).parseSync();

const file = new PbxFile(pathToFramework);
file.target = project.getFirstTarget().uuid;

project.removeFromPbxBuildFileSection(file);
project.removeFromPbxFileReferenceSection(file);
if (project.pbxGroupByName('Frameworks')) {
    project.removeFromFrameworksPbxGroup(file);
}
project.removeFromPbxFrameworksBuildPhase(file);

// Is this a Cocoapods installation?
const podFile = path.join(sourceDirectory, 'Podfile');
const hasPodfile = fs.existsSync(podFile);
if (!hasPodfile) {
    helpers.removeFromFrameworkSearchPaths(
        project,
        '$(PROJECT_DIR)/' +
        path.relative(
            projectConfig.sourceDir,
            path.join(moduleDirectory, 'ios')
        )
    );
}

// disable BackgroundModes and remove "fetch" mode from plist file
const systemCapabilities = helpers.getTargetAttributes(project).SystemCapabilities;
if (systemCapabilities && systemCapabilities['com.apple.BackgroundModes']) {
    delete systemCapabilities['com.apple.BackgroundModes'].enabled;
    if (Object.keys(systemCapabilities['com.apple.BackgroundModes']).length === 0) {
        delete systemCapabilities['com.apple.BackgroundModes'];
    }

    if (Object.keys(systemCapabilities).length === 0) {
        project.removeTargetAttribute('SystemCapabilities');
    }
}

const plist = helpers.readPlist(projectConfig.sourceDir, project);
if (Array.isArray(plist.UIBackgroundModes)) {
    plist.UIBackgroundModes = plist.UIBackgroundModes.filter(
        mode => mode !== 'location'
    );
    if (plist.UIBackgroundModes.length === 0) {
        delete plist.UIBackgroundModes;
    }
}

helpers.writePlist(projectConfig.sourceDir, project, plist);
fs.writeFileSync(projectConfig.pbxprojPath, project.writeSync());
