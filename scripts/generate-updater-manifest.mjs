import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const assetsDirectory = resolve(process.argv[2] || 'release-assets');
const version = process.env.GITHUB_REF_NAME?.replace(/^v/, '') || process.env.ROHRRUNNER_VERSION;
if (!version) throw new Error('GITHUB_REF_NAME oder ROHRRUNNER_VERSION fehlt.');

const files = await readdir(assetsDirectory);
const linux = files.find(file => /\.AppImage$/i.test(file));
const linuxSignature = linux && files.find(file => file === `${linux}.sig`);
const windows = files.find(file => /-setup\.exe$/i.test(file)) || files.find(file => /\.exe$/i.test(file));
const windowsSignature = windows && files.find(file => file === `${windows}.sig`);
if (!linux || !linuxSignature) throw new Error('Linux-AppImage oder Signatur fehlt.');
if (!windows || !windowsSignature) throw new Error('Windows-NSIS-Installer oder Signatur fehlt.');

const baseUrl = `https://github.com/MrK235/RohrRunner/releases/download/v${version}/`;
const platform = (url, signature) => ({
  url: `${baseUrl}${url}`,
  signature,
});
const signature = async file => (await readFile(join(assetsDirectory, file), 'utf8')).trim();
const [linuxSig, windowsSig] = await Promise.all([signature(linuxSignature), signature(windowsSignature)]);
const manifest = {
  version,
  notes: `RohrRunner ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'linux-x86_64': platform(basename(linux), linuxSig),
    'linux-x86_64-appimage': platform(basename(linux), linuxSig),
    'windows-x86_64': platform(basename(windows), windowsSig),
    'windows-x86_64-nsis': platform(basename(windows), windowsSig),
  },
};

await writeFile(join(assetsDirectory, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Updater-Manifest erzeugt: ${join(assetsDirectory, 'latest.json')}`);
