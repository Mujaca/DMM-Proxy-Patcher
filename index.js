require('dotenv').config()
const axios = require('axios').default;
const fs = require('fs');
const cron = require('cron')
const yaml = require('js-yaml');
const _7z = require('7zip-min');
const asar = require('asar');
const { Webhook, MessageBuilder } = require('discord-webhook-node');

const hook = new Webhook(process.env.WEBHOOK_URL);


axios.defaults.baseURL = "https://dlapp-dmmgameplayer.games.dmm.com"
if (!fs.existsSync('./data')) fs.mkdirSync('./data')

const job = new cron.CronJob(
    '0 */12 * * *', // cronTime
    checkVersion, // onTick
    null, // onComplete
    true, // start
    'Europe/Berlin' // timeZone
);

checkVersion();
async function checkVersion() {
    const response = await axios.get("latest.yml");
    const data = yaml.load(response.data)
    const currentVersion = getCurrentVersion();
    if (!compareVersions(currentVersion, data.version)) return;

    if(fs.existsSync('./data/asar/')) fs.rmSync('./data/asar/', {recursive: true, force: true})
    await downloadFile(data.files[0].url, './data/installer.exe')
    await extractArchive('./data/installer.exe', './data/installer/')

    asar.extractAll('./data/installer/resources/app.asar', './data/asar/')

    let template = fs.readFileSync('./template.js', 'utf-8');
    template = template.replace('$PROXY_URL', process.env.HTTP_PROXY_URL);
    fs.writeFileSync('./data/asar/dist/index.js', template);
    fs.copyFileSync('./data/asar/package.json', './data/package.json');

    const packageJson = JSON.parse(fs.readFileSync('./data/asar/package.json', 'utf-8'))
    packageJson.main = './dist/index.js'
    fs.writeFileSync('./data/asar/package.json', JSON.stringify(packageJson)); 

    await asar.createPackage('./data/asar/', './data/app.asar')

    sendWebhookMessage(packageJson.version, data.releaseDate)
    console.log("VERSION UPDATE RELEASED!")
}

function getCurrentVersion() {
    if (!fs.existsSync('./data/package.json')) return '0.0.0';

    try {
        const data = JSON.parse(fs.readFileSync('./data/package.json', 'utf8'));
        return data.version
    } catch (error) {
        return '0.0.0'
    }
}

function compareVersions(old_version, new_version) {
    if (old_version === new_version) return false;

    const oldVersionAsNumber = parseInt(old_version.replaceAll('.', ''));
    const newVersionAsNumber = parseInt(new_version.replaceAll('.', ''));

    if (oldVersionAsNumber < newVersionAsNumber) return true;
    return false;
}

function downloadFile(fileUrl, output) {
    return new Promise((resolve) => {
        const outputStream = fs.createWriteStream(output)
        axios.get(fileUrl, {
            responseType: 'stream'
        }).then((response) => {
            response.data.pipe(outputStream)
        })

        outputStream.on('close', resolve)
    })
}

function extractArchive(archive, outputFolder) {
    return new Promise((resolve) => {
        _7z.unpack(archive, outputFolder, err => {
            resolve()
        })
    })
}

function sendWebhookMessage(version, releaseDate) {
    const unit = selectRandomMessage();

    hook.setUsername(unit.username)
    hook.setAvatar(unit.avatar)

    const embed = new MessageBuilder()
    .setTitle('new DMM version!')
    .setDescription(unit.message)
    .setFooter(`Version ${version} was released at ${new Date(releaseDate).toUTCString()} (UTC)`)
    .setColor('#0ac977')

    hook.send(embed)
    hook.sendFile('./data/app.asar')
}

function selectRandomMessage() {
    const characters = require('./character.json')
    const length = characters.length;
    const entry = randomInRange(0, length - 1);

    return characters[entry];
}

function randomInRange(start,end){
    return Math.floor(Math.random() * (end - start + 1) + start);
}